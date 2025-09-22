const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const db = require("../db");
const qs = require('qs');
const { createModuleLogger, logApiCallDetailed } = require("../utils/logger");

// Create module-specific logger for external API calls
const logger = createModuleLogger('dynamic-recharge');


async function dynamicRechargeCall(apiProviderId, apiId, paramMap = {}) {
  try {
    // 1. Fetch provider and API config
    const [[provider]] = await db.query('SELECT * FROM api_providers WHERE id = ?', [apiProviderId]);
    const [[api]] = await db.query('SELECT * FROM apis WHERE id = ?', [apiId]);

    if (!provider || !api) throw new Error('API config not found');

    logger.debug({ 
      providerId: apiProviderId, 
      providerName: provider.name,
      apiId: apiId,
      apiName: api.name 
    }, 'API configuration loaded');

    if(api.status === 0 ){
      return {
        status: 'error',
        message: 'API is disabled',
      }

    }

    // 2. Replace placeholders in all configs using paramMap
    const replacePlaceholders = (input) => {
        if (!input) return {};
      
        // Support both JSON strings and direct objects
        let parsed;
        if (typeof input === 'string') {
          try {
            parsed = JSON.parse(input);
          } catch (err) {
            logger.error({ input, error: err.message }, "Invalid JSON configuration");
            return {};
          }
        } else if (typeof input === 'object') {
          parsed = input;
        } else {
          return {};
        }
      
        const replaced = {};
        for (const key in parsed) {
          let val = parsed[key];
          if (typeof val === 'string') {
            val = val.replace(/\[([^\]]+)\]/g, (_, k) => paramMap[k] || '');
          }
          replaced[key] = val;
        }
      
        return replaced;
      };
      
    const headers = {
      ...replacePlaceholders(provider.headers),
      ...replacePlaceholders(api.headers),
    };

    const bodyParams = {
      ...replacePlaceholders(provider.body_params),
      ...replacePlaceholders(api.body_params),
    };

    const queryParams = {
        ...replacePlaceholders(provider.query_params),
        ...replacePlaceholders(api.query_params),
      };
  
    logger.debug({ 
      headers, 
      bodyParamsCount: Object.keys(bodyParams).length,
      queryParamsCount: Object.keys(queryParams).length
    }, 'Request parameters prepared');
  

    // 3. Build URL
    let fullUrl;
     let config = {};
    if (api.request_url_endpoint?.toLowerCase().startsWith('http')) {
      // If endpoint is a complete URL, use it directly, and don't build extra body/params
      fullUrl = api.request_url_endpoint.replace(/\[([^\]]+)\]/g, (_, k) => paramMap[k] || '');

      config = {
      method: api.request_type?.toLowerCase() || 'get',
      url: fullUrl,
      headers,
      timeout: (api.timeout_seconds || 30) * 1000,
      };

      // If it's a POST/PUT/PATCH, try to use paramMap as body if needed
      if (['post', 'put', 'patch'].includes(config.method)) {
      if (headers['Content-Type'] === 'application/json') {
        config.data = paramMap;
      } else if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        config.data = qs.stringify(paramMap);
      } else {
        config.data = paramMap;
      }
      }

      logger.debug({ 
        method: config.method, 
        url: fullUrl, 
        timeout: config.timeout,
        hasData: !!config.data
      }, 'Direct URL configuration prepared');

      // Skip further param/body/query building
      // Return config here to avoid duplicate declaration below
    } else {
      // Otherwise combine with provider base URL
      const port = api.request_port && api.request_port !== '0' ? `:${api.request_port}` : '';
      fullUrl = `${provider.base_url}${port}${api.request_url_endpoint}`.replace(/\[([^\]]+)\]/g, (_, k) => paramMap[k] || '');

      logger.debug({ 
        baseUrl: provider.base_url, 
        port, 
        endpoint: api.request_url_endpoint, 
        fullUrl 
      }, 'Composite URL built');
     
      // 4. Axios config
      if(api.request_type?.toLowerCase() === 'get'){
      config = {
        method: api.request_type?.toLowerCase() || 'get',
        url: fullUrl,
        headers,
        timeout: (api.timeout_seconds || 30) * 1000,
        params: queryParams,
      };
      } else {
      config = {
        method: api.request_type?.toLowerCase() || 'get',
        url: fullUrl,
        headers,
        data: bodyParams,
        timeout: (api.timeout_seconds || 30) * 1000,
      };

      if (headers['Content-Type'] === 'application/json') {
        config.data = bodyParams;
      } else if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        config.data = qs.stringify(bodyParams);
      } else {
        config.data = bodyParams;
      }
      }
    }


    // Log external API call attempt
    const apiCallStart = Date.now();
    logger.info({
      provider: provider.name,
      api: api.name,
      method: config.method?.toUpperCase(),
      url: config.url,
      timeout: config.timeout
    }, '🔄 External API call initiated');

    // 5. Make API request
    let response;
    try {
      response = await axios(config);
      const duration = Date.now() - apiCallStart;
      
      logApiCallDetailed(
        provider.name,
        api.name,
        paramMap,
        response.data,
        duration
      );

    } catch (error) {
      const duration = Date.now() - apiCallStart;
      response = error.response;
      
      logApiCallDetailed(
        provider.name,
        api.name,
        paramMap,
        error.response?.data || error.message,
        duration,
        error
      );
    }

    logger.debug({ 
      responseFormat: api.response_format_type?.toLowerCase(),
      statusCode: response?.status 
    }, 'Processing API response');

    const responseCheckData = await responseCheck(api , response);

    let newMessage = responseCheckData?.messageToforward;

    if (newMessage) {
      newMessage = newMessage.replace(/\[([^\]]+)\]/g, (_, key) => {
      return responseCheckData.filters?.[key] || paramMap[key] || '';
      });
    }


    const responses = {...responseCheckData,
      raw: {
        config,
        responseData: response.data,
      },
      message : newMessage,
    }

 return responses;


  } catch (err) {
    logger.error({ 
      error: err.message, 
      stack: err.stack,
      apiProviderId,
      apiId 
    }, '❌ Dynamic recharge call failed');
    
    return {
      status: 'error',
      error: err.message,
    };
  }
}

async function responseCheck(api, response) {
  logger.debug({ 
    apiName: api.name, 
    responseFormat: api.response_format_type,
    statusCode: response?.status 
  }, 'Response check initiated');
  
  const divider = api.divider || '&';

  // Parse response based on format
  const format = api.response_format_type?.toLowerCase() || 'json{}';
  let parsedData;
  
  if (format === 'json{}' || format === 'json') {
    parsedData = typeof response.data === 'object' ? response.data : JSON.parse(response.data);
  } else if (format === 'json[]') {
    parsedData = Array.isArray(response.data) ? response.data : JSON.parse(response.data);
  } else if (format === 'xml') {
    parsedData = await parseStringPromise(response.data);
  } else if (format === 'text') {


    function parseKeyValueString(responseText, divider = '|') {
      const result = {};
      const parts = responseText.trim().split(divider);

    
      for (const part of parts) {
        // Support both '=' and ':' as key-value separators
        let key, value;
        if (part.includes('=')) {
          [key, ...rest] = part.split('=');
          value = rest.join('=');
        } else if (part.includes(':')) {
          [key, ...rest] = part.split(':');
          value = rest.join(':');
        } else {
          key = part;
          value = '';
        }
        if (key) {
          result[key.trim().toLowerCase()] = value.trim();
        }
      }
    
      return result;
    }

    // If response is HTML, parse head and body separately
    if (/^\s*<(!DOCTYPE|html|HTML)/.test(response.data.toString())) {
      const headMatch = response.data.toString().match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      const bodyMatch = response.data.toString().match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      parsedData = {
        head: headMatch ? headMatch[1].trim() : '',
        body: bodyMatch ? bodyMatch[1].trim() : ''
      };
    } else {
      // Handle various balance keys like "All User Balance:34821.87", "Balance: 123", "All Users: 456"
      let respText = response.data.toString();
      
      // SPECIAL CASE: If response is just a simple text like "ok", "success", etc.
      // Store it as both key and value for matching
      if (!respText.includes('=') && !respText.includes(':') && !respText.includes(divider)) {
        const simpleText = respText.trim().toLowerCase();
        parsedData = {
          [simpleText]: simpleText // key and value are the same
        };
        logger.info('Detected simple text response without key-value pairs', simpleText);

      } else {
        // Try to match any key with a number value
        const balanceRegex = /([a-zA-Z ]+)[=:]\s*([0-9.]+)/g;
        let match;
        parsedData = {};
        let found = false;
        while ((match = balanceRegex.exec(respText)) !== null) {
          parsedData[match[1].trim().toLowerCase()] = match[2];
          found = true;
        }
        if (!found) {
          parsedData = parseKeyValueString(respText, divider);
        }
      }
    }

    console.log('Parsed String:', parsedData);
  } else {
    throw new Error('Unsupported response format');
  }

  logger.debug({ 
    parsedDataType: typeof parsedData,
    dataSize: JSON.stringify(parsedData).length 
  }, 'Response data parsed successfully');

  const key1 = api.key1;
  const key2 = api.key2;

  const [rules] = await db.query('SELECT * FROM rules WHERE api_id = ?', [api.id]);
  console.log(rules);

  let status = 'pending';
  let verifingrule = null;

  if (format === 'text') {
    const textObj = {};

    // Map rule keys to values directly from parsedData
    for (const rule of rules) {
      if (rule.key1) textObj[rule.key1] = parsedData[rule.key1.toLowerCase()] || '';
      if (rule.key2) textObj[rule.key2] = parsedData[rule.key2.toLowerCase()] || '';
    }
  
    verifingrule = evaluateRulesOnDataWithKeyMatching(rules, textObj, parsedData);

  } else if (format.startsWith('json')) {
    const data = Array.isArray(parsedData) ? parsedData[0] : parsedData;

    verifingrule = evaluateRulesOnData(rules, data);

  } else if (format === 'xml') {
    const root = Object.values(parsedData)[0]; // first XML node
    const flatXML = {};
    
    for (const key in root) {
      flatXML[key] = root[key][0]; // assuming value is in array
    }

    verifingrule = evaluateRulesOnData(rules, flatXML);
  }

  console.log("verifingrule", verifingrule);

  let value1 = null;
  let value2 = null;
  let messageToforward = null;
  let returnToUser = false;

  if (api.response_filter && parsedData[api.response_filter] !== undefined) {
    parsedData = parsedData[api.response_filter];
  }


  // Extract filtered fields
  const extractFromData = (key) => {
    if (!key) return null;

    if (format === 'string') {
      return parsedData[key.toLowerCase()] || null;
    }
    const data = Array.isArray(parsedData) ? parsedData[0] : parsedData;

    if(format === 'xml') {
      const root = Object.values(data)[0]; // first XML node

      return root?.[key] ? root[key][0] : null;
    }


    // For text, also try lowercased key
    if (format === 'text') {
      return data?.[key.toLowerCase()] ?? null;
    }
    return data?.[key] ?? null;
  };

  const filters = {
    cust: extractFromData(api.cust_filter),
    amt: extractFromData(api.amt_filter),
    bal: extractFromData(api.bal_filter),
    tid: extractFromData(api.tid_filter),
    reqId: extractFromData(api.reqId_filter),
    opId: extractFromData(api.opId_filter),
    msg: extractFromData(api.msg_filter),
    value1: value1,
    value2: value2,
  };

  if(!verifingrule) {

    return {
      status: status,
      filters: filters,
      format: format,
      returnToUser: true,
      reason: "No rules matched",
      messageToforward,
      parsedData: parsedData,
      verifingrule: verifingrule,
    };
  }

  value1 = verifingrule.key1 ? parsedData?.[verifingrule.key1]?.toString() || '' : null;
  value2 = verifingrule.key2 ? parsedData?.[verifingrule.key2]?.toString() || '' : null;
  messageToforward = verifingrule.forwardMessage ? verifingrule.forwardMessage || '' : null;


  if (verifingrule.action === 'mark as success' || verifingrule.action === 'return data' || verifingrule.action === 'return balance') {
    status = 'success';

  } 
  else if (verifingrule.action === 'return to user' || verifingrule.action === 'return failure') {

    status = 'failed';
    returnToUser = true;
  } 
  else if (verifingrule.action === 'try another api') {
    status = 'failed';
  } 
  else {
    status = 'pending';
  }

  return {
    status: status,
    filters,
    format: format,
    returnToUser: returnToUser,
    reason: "Matched rule",
    messageToforward,
    parsedData: parsedData,
    verifingrule: verifingrule,
  };
}

// New function to handle key matching logic
function evaluateRulesOnDataWithKeyMatching(rules, textObj, originalParsedData) {
  for (const rule of rules) {
    let key1Match = false;
    let key2Match = false;

    // Check key1
    if (rule.key1) {
      const expectedValue1 = rule.value1?.toLowerCase() || '';
      const actualValue1 = textObj[rule.key1]?.toLowerCase() || '';
      
      // If actual value is empty/nothing, check if key matches expected value
      if (!actualValue1 || actualValue1 === '') {
        key1Match = rule.key1.toLowerCase() === expectedValue1;
        console.log(`Key1 empty value check: ${rule.key1.toLowerCase()} === ${expectedValue1} = ${key1Match}`);
      } else {
        key1Match = actualValue1 === expectedValue1;
        console.log(`Key1 value check: ${actualValue1} === ${expectedValue1} = ${key1Match}`);
      }
    } else {
      key1Match = true; // No key1 to check
    }

    // Check key2
    if (rule.key2) {
      const expectedValue2 = rule.value2?.toLowerCase() || '';
      const actualValue2 = textObj[rule.key2]?.toLowerCase() || '';
      
      // If actual value is empty/nothing, check if key matches expected value
      if (!actualValue2 || actualValue2 === '') {
        key2Match = rule.key2.toLowerCase() === expectedValue2;
        console.log(`Key2 empty value check: ${rule.key2.toLowerCase()} === ${expectedValue2} = ${key2Match}`);
      } else {
        key2Match = actualValue2 === expectedValue2;
        console.log(`Key2 value check: ${actualValue2} === ${expectedValue2} = ${key2Match}`);
      }
    } else {
      key2Match = true; // No key2 to check
    }

    // If both keys match, return this rule
    if (key1Match && key2Match) {
      console.log(`Rule matched:`, rule);
      return rule;
    }
  }

  return null; // No rule matched
}

function checkCondition(actual = '', condition, expected = '') {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;

  switch (condition.toLowerCase()) {
      case 'equals':
          return actual === expected;
      case 'contains':
          return actual.toLowerCase().includes(expected.toLowerCase());
      case 'starts with':
          return actual.startsWith(expected);
      case 'ends with':
          return actual.endsWith(expected);
      default:
          return false;
  }
}

function evaluateRulesOnData(rules, dataObj) {

  for (const rule of rules) {
    const actual1 = dataObj?.[rule.key1]?.toString() || '';
    const actual2 = rule.key2 ? dataObj?.[rule.key2]?.toString() || '' : null;

    const match1 = checkCondition(actual1, rule.condition1, rule.value1);
    const match2 = rule.key2 && rule.condition2 && rule.value2
      ? checkCondition(actual2, rule.condition2, rule.value2)
      : true;



    // STRICT: If rule has 2 keys, both must match
    if (rule.key2) {
      if (match1 && match2) {
        return rule;
      }
    } else {
      if (match1) {
        return rule;
      }
    }
  }

  // If no exact match found
  return null;
}


// function evaluateRulesOnData(rules, dataObj) {
//   let bestRule = null;
//   let bestScore = -1;

//   console.log("rules" , rules.length);

//   for (const rule of rules) {
//       let score = 0;

//       const actual1 = dataObj?.[rule.key1]?.toString() || '';
//       const actual2 = rule.key2 ? dataObj?.[rule.key2]?.toString() || '' : null;

//       const match1 = checkCondition(actual1, rule.condition1, rule.value1);
//       const match2 = rule.key2 && rule.condition2 && rule.value2
//           ? checkCondition(actual2, rule.condition2, rule.value2)
//           : true;
//           console.log("rule", rule);
//           console.log("actual1", actual1);
//           console.log("actual2", actual2);

//           console.log("match1", match1);
//           console.log("match2", match2);

//       if (match1) score += 1;
//       if (rule.key2 && match2) score += 1;

//       if (score > bestScore) {
//           bestRule = rule;
//           bestScore = score;
//       }
//   }

//   return bestRule;
// }






module.exports ={ dynamicRechargeCall,responseCheck };