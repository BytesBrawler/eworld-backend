const db = require(".");
// const { deleteofferhcheckLine } = require("../controllers/configuration.controllers");


async function createOperatorType({ name, description }) {
  const [result] = await db.query(
    "INSERT INTO operator_types (name, description) VALUES (?, ?)",
    [name, description]
  );
  return result.insertId;
}

async function getOperatorTypes({ status }) {
  if (status === undefined) {
    const [rows] = await db.query(
      "SELECT id, name ,description, status FROM operator_types"
    );
    return rows;
  }

  const [rows] = await db.query(
    "SELECT id, name , status FROM operator_types WHERE status = ?",
    [status]
  );
  return rows;
}


async function getOperatorByName(name ,type) {
    const [rows] = await db.query("SELECT * FROM operators WHERE name = ? and type = ?", [name,type]);
    return rows[0];
  }

  


async function updateOperatorType({
  id,
  name,
  description,
  status = "active"
}) {
  const [result] = await db.query(
    "UPDATE operator_types SET name = ?, description = ?, status = ? WHERE id = ?",
    [name, description, status, id]
  );

  if (result.affectedRows === 0) {
    throw new Error("Operator type not found or no changes made");
  }

  // Fetch and return the updated operator type
  const [updatedRows] = await db.query(
    "SELECT * FROM operator_types WHERE id = ?",
    [id]
  );

  return updatedRows[0];
}

async function deleteOperatorType({ id }) {
  const [result] = await db.query(
    "update operator_types set status = 'inactive' WHERE id = ?",
    [id]
  );

  if (result.affectedRows === 0) {
    throw new Error("Operator type not found");
  }

  return { id };
}


async function getOperatorTypeByName(name) {
    const [rows] = await db.query(
      "SELECT id FROM operator_types WHERE name = ?",
      [name]
    );
    return rows[0];
  }


  async function deleteOperator(id) {
   const [result] = await db.query("update operators set status = !status WHERE id = ?", [id]);
  //  const [result] = await db.query("update operators set status = false WHERE id = ?", [id]);
   // const [result] = await db.query("DELETE FROM operators WHERE id = ?", [id]);
    return result;
  }

  async function getOperatorById(id) {
    const [rows] = await db.query("SELECT * FROM operators WHERE id = ?", [id]);
    return rows[0];
  }
  
  async function updateOperator(
    id,
    {
      name,
      code,
      logo,
      type,
      alert_balance,
        lock_amt,
        delay,
        margin,
        pending_limit,
      status 
    }


  ) {


    const updateFields = [];
    const params = [];
  
    // Dynamically build update query
    if (name !== undefined) {
      updateFields.push("name = ?");
      params.push(name);
    }
    if (code !== undefined) {
      updateFields.push("code = ?");
      params.push(code);
    }
    if (logo !== undefined) {
      updateFields.push("logo = ?");
      params.push(logo);
    }
    if (type !== undefined) {
      updateFields.push("type = ?");
      params.push(type);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      params.push(status);
    }
  
    if (alert_balance !== undefined) {
        updateFields.push("alert_balance = ?");
        params.push(alert_balance);
        }
    if (lock_amt !== undefined) {
        updateFields.push("lock_amt = ?");
        params.push(lock_amt);
        }
    if (delay !== undefined) {
        updateFields.push("delay = ?");
        params.push(delay);
        }
    if (margin !== undefined) {
        updateFields.push("margin = ?");
        params.push(margin);
        }
    if (pending_limit !== undefined) {
        updateFields.push("pending_limit = ?");
        params.push(pending_limit);
        }
   
  
    console.log(updateFields);
    console.log(params);
  
    // Add more fields similarly...
  
    if (updateFields.length === 0) {
      throw new Error("No update fields provided");
    }
  
    params.push(id);
  
    const query = `
        UPDATE operators 
        SET ${updateFields.join(", ")}
        WHERE id = ?
    `;
  
    const [result] = await db.query(query, params);
    console.log(result);
    return result;
  }
  
  async function createOperator({
    name,
    code,
    type,
    logo,
    alert_balance,
    lock_amt,
    delay,
    margin,
    pending_limit,
  }) {
    const [result] = await db.query(
      `INSERT INTO operators 
        (name, code, logo, type, alert_balance, lock_amt, delay, margin, pending_limit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [
            name,
            code,
            logo,
            type,
            alert_balance,
            lock_amt,
            delay,
            margin,
            pending_limit
        ]
     
    );
    return result.insertId;
  }
  


// Database query function
async function getOperators({
    status,
    type,
    code
  }) {
    let query = "SELECT  operators.id, operators.name, operators.code, operator_types.name as type, operators.logo, operators.alert_balance, operators.lock_amt, operators.delay, operators.margin, operators.pending_limit , operators.status as status FROM operators  INNER JOIN operator_types ON operators.type = operator_types.id";
    const params = [];
    const conditions = [];
  
    // Only add status condition if status is provided
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
  
    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }
  
   
    if (code) {
      conditions.push("code = ?");
      params.push(code);
    }
  
    // Add WHERE clause only if there are conditions
    if (conditions.length > 0) {
      query += " Where" + conditions.join(" AND ");
    }
  
    const [rows] = await db.query(query, params);
    return rows;
  }




async function getOperatorsList() {
 
  // const [rows] = await db.query(
  //     "SELECT o.id, o.name , ot.name FROM operators  as o left join operator_types as ot WHERE o.type = ot.id AND o.status = true ORDER BY o.name"
  // );

  const [rows] = await db.query(
    `SELECT o.id, o.name, ot.name AS operator_type_name
     FROM operators AS o
     LEFT JOIN operator_types AS ot ON o.type = ot.id
     WHERE o.status = true
     ORDER BY o.name`
  );
  
  
  return rows || [];

}

async function getApiProvidersList() {

  const [rows] = await db.query(
      "SELECT id, name FROM api_providers WHERE status = 1 ORDER BY name"
  );
  return rows|| [];

}

async function getKeywordsList() {

  const [rows] = await db.query(
      "SELECT k.id, k.description as name, ot.name as type FROM keywords as k LEFT JOIN operators as o ON k.operator_id = o.id left join operator_types as ot on o.type = ot.id WHERE k.status = 1 ORDER BY k.description"
  );
  console.log("rows", rows);
  return rows|| [];

}

async function getoperatorTypList() {

  const [rows] = await db.query(
      "SELECT id, name as name FROM operator_types WHERE status = 1 ORDER BY description"
  );
  return rows|| [];

}


async function getApisList(type) {

  let rows;
  if (type === "recharge") {
    [rows] = await db.query(
      "SELECT id, description as name FROM apis WHERE status = 1 AND type = 'recharge' ORDER BY description"
    );
  } else if (type === "balance") {
    [rows] = await db.query(
      "SELECT id, description as name FROM apis WHERE status = 1 AND type = 'balancecheck' ORDER BY description"
    );
  } else if (type === "status") {
    [rows] = await db.query(
      "SELECT id, description as name FROM apis WHERE status = 1 AND type = 'statuscheck' ORDER BY description"
    );
  } else if (type === "offer") {
    [rows] = await db.query(
      "SELECT id, description as name FROM apis WHERE status = 1 ORDER BY description"
      // "SELECT id, description as name FROM apis WHERE status = 1 AND type = 'others' ORDER BY description"
    );
  }

 
  return rows|| [];

}

async function createKeyword({
  description,
  code,
  operator_id,
  min_digits,
  max_digits,
  gap = null,
  additional_charges = 0,
  is_additional_charges_fixed = true,
  min_recharge = null,
  max_recharge = null,
  admin_margin = null,
  ret_std_margin = null,
  dist_std_margin = null,
  mdist_std_margin = null,
  flat_margin = null,
  status = true
}) {
  const query = `
      INSERT INTO keywords 
      (description, code, operator_id, min_digits, max_digits, gap, 
      additional_charges, is_additional_charges_fixed, min_recharge, max_recharge, 
      admin_margin, ret_std_margin, dist_std_margin, mdist_std_margin,flat_margin ,status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?)
  `;

  const [result] = await db.query(query, [
    description,
    code,
    operator_id,
    min_digits,
    max_digits,
    gap,
    additional_charges,
    is_additional_charges_fixed,
    min_recharge,
    max_recharge,
    admin_margin,
    ret_std_margin,
    dist_std_margin,
    mdist_std_margin,
    flat_margin,
    status
  ]);

  return result;
}

async function getKeywordByCode(code) {
  const [rows] = await db.query(
    "SELECT * FROM keywords WHERE code = ?",
    [code]
  );
  return rows[0];
}


// async function getKeywords() {
//   let query = `
//     SELECT k.*, 
//            o.name as operator_name
//     FROM keywords k
//     LEFT JOIN operators o ON k.operator_id = o.id
//   `;
  
  

//   const [results] = await db.query(query);
//   console.log("results", results);
//   return results;
// }

async function getKeywords() {
  let query = `
    SELECT 
      k.*, 
      o.name AS operator_name,
      ot.name AS operator_type_name,
       COALESCE(SUM(CASE WHEN kl.status = TRUE THEN kf.balance ELSE 0 END), 0) AS total_balance
    FROM keywords k
    LEFT JOIN operators o ON k.operator_id = o.id
    LEFT JOIN operator_types ot ON o.type = ot.id
    LEFT JOIN keyword_lines kl ON kl.keyword_id = k.id
    LEFT JOIN kl_financials kf ON kf.kl_id = kl.id
    GROUP BY k.id
    order by operator_name
  `;

  const [results] = await db.query(query);
  console.log("results", results);
  return results;
}


// async function getKeywordById(id) {
//   const [rows] = await db.query("SELECT * FROM keywords WHERE id = ?", [id]);
//   return rows[0];
// }

async function getKeywordById(id) {
  const query = `
    SELECT k.*, 
           o.name as operator_name
    FROM keywords k
    LEFT JOIN operators o ON k.operator_id = o.id
    WHERE k.id = ?
  `;

  const [results] = await db.query(query, [id]);
  return results[0] || null;
}

async function updateKeyword(id, updateData) {
  const updateFields = [];
  const params = [];

  // Dynamically build update query
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      params.push(updateData[key]);
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No update fields provided");
  }

  params.push(id);

  const query = `
      UPDATE keywords 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
  `;

  const [result] = await db.query(query, params);
  return result;
}

async function deleteKeyword(id) {
  const query = `DELETE FROM keywords WHERE id = ?`;
  const [result] = await db.query(query, [id]);
  return result;
}

// Helper functions for foreign key validation
async function checkOperatorExists(id) {
  const [results] = await db.query("SELECT id FROM operators WHERE id = ?", [id]);
  return results[0] || null;
}

async function checkApiProviderExists(id) {
  const [results] = await db.query("SELECT id FROM api_providers WHERE id = ?", [id]);
  return results[0] || null;
}

async function checkApiExists(id) {
  const [results] = await db.query("SELECT id FROM apis WHERE id = ?", [id]);
  return results[0] || null;
}
// Helper functions for foreign key validation
async function checkOperatorExists(id) {
  const [results] = await db.query("SELECT id FROM operators WHERE id = ?", [id]);
  return results[0] || null;
}

async function checkApiProviderExists(id) {
  const [results] = await db.query("SELECT id FROM api_providers WHERE id = ?", [id]);
  return results[0] || null;
}

async function checkApiExists(id) {
  const [results] = await db.query("SELECT id FROM apis WHERE id = ?", [id]);
  return results[0] || null;
}

async function createApiProvider({
  name,
  base_url,
  headers,
  query_params,
  body_params,
  balance_threshold,
  notification_email
}) {
  const query = `
      INSERT INTO api_providers 
      (name, base_url, headers, query_params, body_params, 
       balance_threshold, notification_email) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await db.query(query, [
    name,
    base_url,
    headers,
    query_params,
    body_params,
    balance_threshold,
    notification_email
  ]);

  return result;
}


async function getAPiProvidersByUrl(url) {
  const [results] = await db.query(
    "SELECT * FROM api_providers WHERE base_url = ?",
    [url]
  );
  console.log(results);
  return results;
}
async function getAPiProvidersByName(name) {
  const [results] = await db.query(
    "SELECT * FROM api_providers WHERE name = ?",
    [name]
  );
  return results;
}
async function getApiProviders({ status, name, balance_threshold_min, balance_threshold_max }) {
  let query = `SELECT * FROM api_providers`;
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push(`status = ?`);
    params.push(status);
  }

  if (name) {
    conditions.push(`name LIKE ?`);
    params.push(`%${name}%`);
  }

  if (balance_threshold_min !== undefined) {
    conditions.push(`balance_threshold >= ?`);
    params.push(balance_threshold_min);
  }

  if (balance_threshold_max !== undefined) {
    conditions.push(`balance_threshold <= ?`);
    params.push(balance_threshold_max);
  }

  // Only add WHERE if there are conditions
  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(` AND `);
  }

  query += ` ORDER BY name`; // Add order by name

  const [results] = await db.query(query, params);
  return results;
}


async function getApiProviderById(id) {
  const [results] = await db.query("SELECT * FROM api_providers WHERE id = ?", [
    id
  ]);
  return results[0];
}

async function updateApiProvider(id, updateData) {
  const updateFields = [];
  const params = [];

  // Dynamically build update query
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      params.push(updateData[key]);
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No update fields provided");
  }

  params.push(id);

  const query = `
      UPDATE api_providers 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
  `;

  const [result] = await db.query(query, params);
  return result;
}
// const apiData = {
//   description,
//   type: type.toLowerCase(),
//   request_port,
//   request_url_endpoint,
//   request_type: request_type.toLowerCase(),
//   headers: JSON.stringify(headers || {}),
//   body_params: JSON.stringify(body_params || {}),
//   query_params: JSON.stringify(query_params || {}),
//   response_format_type,
//   separator,
//   key1,
//   key2,

//   msg_filter,

//   cust_filter,
//   response_filter,
//   amt_filter,
//   bal_filter,
//   tid_filter,
//   reqId_filter,
//   forward_start: forward_start ,
//   forward_before: forward_before ,
//   retry_count: retry_count || 3,
//   timeout_seconds: timeout_seconds || 30
// };

async function createApi({
  description,
    type,
    request_port,
    request_url_endpoint,
    request_type,
    headers,
    body_params,
    query_params,
    response_format_type,
    divider,
    key1,
    key2,
    msg_filter,
    cust_filter,
    response_filter,
    amt_filter,
    bal_filter,
    tid_filter,
    reqId_filter,
    opId_filter,
    retry_count,
    timeout_seconds,
    status = 1 ,
}) {
  const query = `
      INSERT INTO apis
      (description, type, request_port, request_url_endpoint, request_type,
      headers, body_params, query_params, response_format_type,
      divider, key1, key2, msg_filter,
      cust_filter, response_filter, amt_filter, bal_filter,
      tid_filter, reqId_filter,opId_filter,
      retry_count, timeout_seconds, status)
      VALUES (?,
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?,
              ?, 
              ?, ?, ?,?)
  `;

const [rows] = await db.query(query, [
  description,
  type,
  request_port,
  request_url_endpoint,
  request_type,
  headers,
  body_params,
  query_params,
  response_format_type,
  divider,
  key1,
  key2,
  msg_filter,
  cust_filter,
  response_filter,
  amt_filter,
  bal_filter,
  tid_filter,
  reqId_filter,
  opId_filter,
  retry_count,
  timeout_seconds,
  status
]);
  return rows.insertId;
}

async function deleteApiRulesByApiId(api_id){
 const [updateRule] = await db.query("DELETE FROM rules WHERE api_id = ?", [api_id]);
  return updateRule.affectedRows > 0;
}

async function addApiRules(rules) {
  const query = `
    INSERT INTO rules 
    (api_id, key1, key2, condition1, value1, condition2, value2, action, forwardMessage) 
    VALUES ${rules.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
  `;

  const values = rules.flatMap(rule => [
    rule.api_id,
    rule.key1,
    rule.key2,
    rule.condition1,
    rule.value1,
    rule.condition2,
    rule.value2,
    rule.action,
    rule.forwardMessage
  ]);

  const [result] = await db.query(query, values);
  return result;
}



  //response_rules: [{"key1":"status","key2":"value","condition1":"contains","value1":"success","condition2":"equals","value2":"true","action":"mark as success","forwardMessage":null},{"key1":"status","key2":"value","condition1":"contains","value1":"failed","condition2":"equals","value2":"false","action":"return to user","forwardMessage":null}]
  // Create response rules
  // const rulesListWIthApiId = response_rules.map((rule) => ({
  //   ...rule,
  //   api_id: newApiId,
  // }));

// async function addApiRules (rules) {
//   console.log(rules);
//   //here rules are list of rules
//   const query = `
//       INSERT INTO api_rules 
//       (api_id, key1, key2, condition1, value1, condition2, value2, action, forwardMessage) 
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `;
//   const values = rules.map(rule => [
//     rule.api_id,
//     rule.key1,
//     rule.key2,
//     rule.condition1,
//     rule.value1,
//     rule.condition2,
//     rule.value2,
//     rule.action,
//     rule.forwardMessage
//   ]);
//   const [result] = await db.query(query, values);
//   return result;
// }
async function getApis({ status, description, type, response_format_type }) {
  let query = `SELECT * FROM apis `;
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push(`status = ?`);
    params.push(status);
  }

  if (description) {
    conditions.push(`description LIKE ?`);
    params.push(`%${description}%`);
  }

  if (type) {
    conditions.push(`type = ?`);
    params.push(type.toLowerCase());
  }

  if (response_format_type) {
    conditions.push(`response_format_type = ?`);
    params.push(response_format_type);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(` AND `);
  }

  query += ` ORDER BY description`; // Order by description

  const [apis] = await db.query(query, params);

  if (apis.length === 0) return [];

  const apiIds = apis.map(api => api.id);
  const [rules] = await db.query(
    `SELECT * FROM rules WHERE api_id IN (${apiIds.map(() => '?').join(',')})`,
    apiIds
  );

  // Group rules by api_id
  const ruleMap = {};
  for (const rule of rules) {
    if (!ruleMap[rule.api_id]) ruleMap[rule.api_id] = [];
    ruleMap[rule.api_id].push(rule);
  }

  // Attach rules to each API
  const apisWithRules = apis.map(api => ({
    ...api,
    rules: JSON.stringify(ruleMap[api.id] || []) // Convert to proper JSON
  }));



  return apisWithRules;
}

  
// async function getApis({ status, description, type, response_format_type }) {
//   let query = `SELECT * FROM apis `;
//   const params = [];
//   const conditions = [];

//   if (status) {
//     conditions.push(`status = ?`);
//     params.push(status);
//   }

//   if (description) {
//     conditions.push(`description LIKE ?`);
//     params.push(`%${description}%`);
//   }

//   if (type) {
//     conditions.push(`type = ?`);
//     params.push(type.toLowerCase());
//   }

//   if (response_format_type) {
//     conditions.push(`response_format_type = ?`);
//     params.push(response_format_type);
//   }

//   // Add WHERE clause only if there are conditions
//   if (conditions.length > 0) {
//     query += ` WHERE ` + conditions.join(` AND `);
//   }

//   const [results] = await db.query(query, params);
//   console.log("query", query);
//   console.log("params", params);
//   console.log("results", results);
  
//   return results;
// }


// async function getApis({ status, description, type, response_format_type }) {
//   let query = `SELECT * FROM apis WHERE 1=1`;
//   const params = [];

//   if (status) {
//     query += ` AND status = ?`;
//     params.push(status);
//   }

//   if (description) {
//     query += ` AND description LIKE ?`;
//     params.push(`%${description}%`);
//   }

//   if (type) {
//     query += ` AND type = ?`;
//     params.push(type.toLowerCase());
//   }

//   if (response_format_type) {
//     query += ` AND response_format_type = ?`;
//     params.push(response_format_type);
//   }

//   const [results] = await db.query(query, params);

//   // // Parse JSON fields
//   // return results.map((result) => ({
//   //   ...result,
//   //   request_params: result.request_params
//   //     ? JSON.parse(result.request_params)
//   //     : null,
//   //   headers: result.headers ? JSON.parse(result.headers) : null
//   // }));
//   return results;
// }

async function getApiById(id) {
  const [results] = await db.query("SELECT * FROM apis WHERE id = ?", [id]);

  if (!results[0]) return null;

  // Parse JSON fields
  const result = results[0];
  //return result;
  return {
    ...result,
    body_params: typeof result.body_params === 'string' && result.body_params.trim() !== ''
      ? JSON.parse(result.body_params)
      : result.body_params || null,
    
    query_params: typeof result.query_params === 'string' && result.query_params.trim() !== ''
      ? JSON.parse(result.query_params)
      : result.query_params || null,
    
    headers: typeof result.headers === 'string' && result.headers.trim() !== ''
      ? JSON.parse(result.headers)
      : result.headers || null,
  };
  
  // return {
  //   ...result,
  //   body_params: result.body_params
  //     ? JSON.parse(result.body_params)
  //     : null,
  //   query_params: result.query_params
  //     ? JSON.parse(result.query_params)
  //     : null,
    
  //   headers: result.headers ? JSON.parse(result.headers) : null
  // };
}

async function updateApi(id, updateData) {
  const updateFields = [];
  const params = [];

  // Dynamically build update query
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      params.push(updateData[key]);
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No update fields provided");
  }

  params.push(id);

  const query = `
      UPDATE apis 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
  `;

  const [result] = await db.query(query, params);
  return result;
}



async function createKeywordLine(data) {
  console.log("data", data);
  const query = `
      INSERT INTO keyword_lines 
      (keyword_id, description, merchant_code, api_provider ,recharge_api, balance_check_api, status_check_api,
       lock_amt, min_amt, max_amt, min_digits, max_digits, gap, additional_charges,
       is_additional_charges_fixed, is_charges_by_user, is_charges_by_admin,
       ret_margin, dist_margin, mdist_margin, flat_margin, margin_status,
       admin_margin, status,priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?)
  `;
  const values = [
      data.keyword_id, data.description, data.merchant_code, data.api_provider, data.recharge_api, data.bal, data.stat,
      data.lock_amt, data.min_amt, data.max_amt, data.min_digits, data.max_digits, data.gap, data.additional_charges,
      data.is_additional_charges_fixed, data.is_charges_by_user, data.is_charges_by_admin,
      data.ret_margin, data.dist_margin, data.mdist_margin, data.flat_margin, data.margin_status,
      data.admin_margin, data.status, data.priority
  ];
  const [result] = await db.query(query, values);
  return result;
}

async function createFinancials(data) {
  const query = `
      INSERT INTO kl_financials 
      (kl_id, balance, today_amount, today_count,today_profit, daily_max_count, daily_max_amount) 
      VALUES (?, ?, ?, ?, ?,?, ?)
  `;
  const values = [data.kl_id, data.balance, data.today_amount, data.today_count,data.today_profit, data.daily_max_count, data.daily_max_amount];
  await db.query(query, values);
}

async function getKeywordLines(id) {
  const query = `
      SELECT kl.id as id,
             kl.description as description,
             kl.merchant_code as merchant_code, 
             ap.name as provider_name,
             r.description as recharge_api_name,
             kl.margin_status as margin_status,
             kl.status as status,
             kf.balance as balance
      FROM keyword_lines kl
      LEFT JOIN api_providers ap ON kl.api_provider = ap.id
      LEFT JOIN apis r ON kl.recharge_api = r.id
      left join kl_financials kf ON kl.id = kf.kl_id
      where kl.keyword_id = ?
  `;

  const [results] = await db.query(query, [id]);

  console.log("results", results);
  return results;
}

async function getKeywordLineById(id) {
  console.log("wrongplace");
  console.log("id passed inside function is ", id);
  const query = `
    SELECT 
      kl.id AS id,
      kl.keyword_id,
      kl.description,
      kl.merchant_code,
      kl.api_provider,
      kl.recharge_api,
      kl.balance_check_api,
      kl.status_check_api,
      kl.lock_amt,
      kl.min_amt,
      kl.max_amt,
      kl.min_digits,
      kl.max_digits,
      kl.gap,
      kl.additional_charges,
      kl.is_additional_charges_fixed,
      kl.is_charges_by_user,
      kl.is_charges_by_admin,
      kl.ret_margin,
      kl.dist_margin,
      kl.mdist_margin,
      kl.flat_margin,
      kl.margin_status,
      kl.admin_margin,
      kl.priority,
      kl.status,
      kl.created_at,
      kl.updated_at,

      fl.id AS fl_id,
      fl.kl_id AS fl_kl_id,
      fl.balance,
      fl.today_amount,
      fl.today_count,
      fl.daily_max_count,
      fl.daily_max_amount,
      fl.last_at,
      fl.today_profit

    FROM keyword_lines kl
    LEFT JOIN kl_financials fl ON kl.id = fl.kl_id
    WHERE kl.id = ?
  `;

  const [results] = await db.query(query, [id]);
  console.log("results", results);
  return results[0] || null;
}


// async function getKeywordLineById(id) {
//   console.log("id ast inside fucntion is ", id);
//   const query = `
//       SELECT kl.*,
//              fl.*
//       FROM keyword_lines kl
//       LEFT JOIN kl_financials fl ON kl.id = fl.kl_id
//       WHERE kl.id = ?
//   `;

//   const [results] = await db.query(query, [id]);
//   console.log("results", results);
//   return results[0] || null;
// }

async function getFinancialsByKlId(kl_id) {
  const [rows] = await db.query("SELECT * FROM kl_financials WHERE kl_id = ?", [kl_id]);
  return rows[0];
}

async function updateKeywordLine(id, updateData) {
  const updateFields = [];
  const params = [];

  // Dynamically build update query
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      params.push(updateData[key]);
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No update fields provided");
  }

  params.push(id);

  const query = `
      UPDATE keyword_lines 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
  `;

  const [result] = await db.query(query, params);
  return result;
}

async function updateFinancials( id, updateData) {
  let query = "UPDATE kl_financials SET ";
  let values = [];
  Object.keys(updateData).forEach((key, index) => {
      if (index > 0) query += ", ";
      query += `${key} = ?`;
      values.push(updateData[key]);
  });
  query += " WHERE kl_id = ?";
  values.push(id);

  console.log("query", query);
  console.log("values", values);

  const [update] =await db.query(query, values);
  return update.affectedRows > 0;


}


// create table extraLines(
// id INT AUTO_INCREMENT PRIMARY KEY,
// keyword_id INT not null,
// description VARCHAR(100) not null,
// api_provider INT not null,
// api int not null,
// type VARCHAR(100),
// status BOOLEAN DEFAULT TRUE,
// circles_id int default null,
// name_filter text,
// description_filter text,
// extra_info_filter text,
// account_filter text,
// due_date_filter text,
// bill_date_filter text,
// rs_filter text,
// is_main_response boolean,

// created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
// updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
// FOREIGN KEY (api_provider) REFERENCES api_providers(id) ON DELETE CASCADE,
// FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
// );
async function createExtraLine(data) {
  const query = `
      INSERT INTO extraLines
      (keyword_id, description, merchant_code, api_provider, api,
      type, status, circles_id, name_filter,
      description_filter, extra_info_filter, account_filter,
      due_date_filter, bill_date_filter, rs_filter, is_main_response)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
      data.keyword_id, data.description, data.merchant_code, data.api_provider, data.api,
      data.type, data.status, data.circles_id, data.name_filter,
      data.description_filter, data.extra_info_filter, data.account_filter,
      data.due_date_filter, data.bill_date_filter, data.rs_filter, data.is_main_response
  ];
  const [result] = await db.query(query, values);
  return result;
}

async function getExtraLines(keyword_id) {
  const query = `
      SELECT el.id as id,
             el.description as description,
             el.merchant_code as merchant_code, 
             ap.name as provider_name,
             a.description as api_name,
             el.status as status
      FROM extraLines el
      LEFT JOIN api_providers ap ON el.api_provider = ap.id
      LEFT JOIN apis a ON el.api = a.id
      WHERE el.keyword_id = ?
  `;

  const [results] = await db.query(query, [keyword_id]);
  return results;
}

async function getExtraLinesById(id) {
  const query = `
    SELECT 
      el.id AS id,
      el.keyword_id,
      el.description,
      el.merchant_code,
      el.api_provider,
      el.api,
      el.type,
      el.status,
      el.circles_id,
      el.name_filter,
      el.description_filter,
      el.extra_info_filter,
      el.account_filter,
      el.due_date_filter,
      el.bill_date_filter,
      el.rs_filter,
      el.is_main_response,
      el.created_at,
      el.updated_at
    FROM extraLines el
    WHERE el.id = ?
  `;

  const [results] = await db.query(query, [id]);
  return results[0] || null;
}

async function updateExtra(id, updateData) {
  const updateFields = [];
  const params = [];

  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      params.push(updateData[key]);
    }
  });

  if (updateFields.length === 0) {
    throw new Error("No update fields provided");
  }

  params.push(id);

  const query = `
      UPDATE extraLines
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
  `;
  console.log("query", query);
  console.log("params", params);

  const [result] = await db.query(query, params);
  return result;
}

async function updateFinancials( id, updateData) {
  let query = "UPDATE kl_financials SET ";
  let values = [];
  Object.keys(updateData).forEach((key, index) => {
      if (index > 0) query += ", ";
      query += `${key} = ?`;
      values.push(updateData[key]);
  });
  query += " WHERE kl_id = ?";
  values.push(id);

  console.log("query", query);
  console.log("values", values);

  const [update] =await db.query(query, values);
  return update.affectedRows > 0;


}


async function getPreValueByValue(kl_id , value) {
  const [rows] = await db.query("SELECT * FROM kl_prevalues WHERE amount = ? and kl_id = ?", [value, kl_id]);
  if (rows.length === 0) {
    return null;
  }
  return rows[0];
}

async function getPreValuById(id) {
  const [rows] = await db.query("SELECT * FROM kl_prevalues WHERE id = ?", [id]);
  return rows[0];
}

async function createPreValues(kl_id, amount) {
console.log("kl_id", kl_id);
  console.log("amount", amount);
  const [result] = await db.query("INSERT INTO kl_prevalues (kl_id, amount) VALUES (?, ?)", [kl_id, amount]);
  if (!result.affectedRows) {
    throw new Error("Failed to insert pre-value. Please check the input data.");
  }
  return result.insertId;
}

async function getPreValues(kl_id) {
  const [rows] = await db.query("SELECT * FROM kl_prevalues WHERE kl_id = ?", [kl_id]);
  return rows;
}

async function deletePreValues(id) {
  const [result] = await db.query("DELETE FROM kl_preValues WHERE id = ?", [id]);
  return result;
}


  

module.exports = {
  db,
  createOperatorType,
  getOperatorTypes,
  updateOperatorType,
    deleteOperatorType,
    getOperatorTypeByName,
    createOperator,
    getOperatorByName,
    updateOperator,
    deleteOperator,
    getOperatorByName,
    getOperators,
    getOperatorById,
    getOperatorsList,
    getApiProvidersList,
    getApisList,
    createKeyword,
    getKeywordByCode,
    getKeywords,
    getKeywordById,
    updateKeyword,
    deleteKeyword,
    checkOperatorExists,
    checkApiProviderExists,
    checkApiExists,
    getOperatorById,
    createApiProvider,
    getAPiProvidersByUrl,
    getAPiProvidersByName,
    getApiProviders,
    getApiProviderById,
    updateApiProvider,
    createApi,
    getApis,
    getApiById,
    updateApi,
    createKeywordLine,
    createFinancials,
    getFinancialsByKlId,
    updateFinancials,
    getKeywordLines,
    getKeywordLineById,
    updateKeywordLine,
    getPreValueByValue,
    getPreValuById,
    createPreValues,
    getPreValues,
    deletePreValues,
    addApiRules,
    deleteApiRulesByApiId,
    createExtraLine,
    getExtraLines,
    getExtraLinesById,
    updateExtra,
    getKeywordsList,
    getoperatorTypList,


};
