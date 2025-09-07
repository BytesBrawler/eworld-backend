const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries");
const confQuery = require("../db/configuration.query");
const { getRoleAccess } = require("./general.controller");
const { uploadToCloudinary } = require("../utils/cloudinary");
const { validateEmail } = require("../utils/validator.js");
const { json } = require("express");

const createOperatorType = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ApiError(400, "Operator type name is required");
  }

  // Validate user permissions if needed
  if (req.user.role !== 1 && req.user.role !== 2) {
    throw new ApiError(403, "Unauthorized to create operator types");
  }

  const newOperatorType = await confQuery.createOperatorType({
    name,
    description
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        newOperatorType,
        "Operator Type Created Successfully"
      )
    );
});

const updateOperatorType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, status } = req.body;

  // Validate user permissions
  if (req.user.role !== 1 && req.user.role !== 2) {
    throw new ApiError(403, "Unauthorized to update operator types");
  }

  // Validate input
  if (!id) {
    throw new ApiError(400, "Operator type ID is required");
  }

  if (!name) {
    throw new ApiError(400, "Operator type name is required");
  }

  const updatedOperatorType = await confQuery.updateOperatorType({
    id,
    name,
    description,
    status: status || "active"
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedOperatorType,
        "Operator Type Updated Successfully"
      )
    );
});

const deleteOperatorType = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate user permissions
  if (req.user.role !== 1 && req.user.role !== 2) {
    throw new ApiError(403, "Unauthorized to delete operator types");
  }

  // Validate input
  if (!id) {
    throw new ApiError(400, "Operator type ID is required");
  }

  const deletedOperatorType = await confQuery.deleteOperatorType({ id });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        deletedOperatorType,
        "Operator Type Deleted Successfully"
      )
    );
});

const getOperatorTypes = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const operatorTypes = await confQuery.getOperatorTypes({ status });

  if (!operatorTypes || operatorTypes.length === 0) {
    throw new ApiError(404, "No operator types found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        operatorTypes,
        "Operator Types Retrieved Successfully"
      )
    );
});

const createOperator = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    type,
    alert_balance,
    lock_amt,
    delay,
    margin,
    pending_limit,
    logo
  } = req.body;

  console.log("re is " + JSON.stringify(req.body));

  // Validate required fields
  const requiredFields = [
    "logo",
    "name",
    "code",
    "type",
    "alert_balance",
    "lock_amt",
    "delay",
    "margin",
    "pending_limit"
  ];

  requiredFields.forEach((field) => {
    if (req.body[field] == null || req.body[field] == undefined) {
      console.log(field);
      throw new ApiError(400, `${field} is required`);
    }
  });

  const typeId = await confQuery.getOperatorTypeByName(type);

  const operatorExists = await confQuery.getOperatorByName(name, typeId);

  if (operatorExists) {
    throw new ApiError(400, "Operator with name already exists");
  }

  const operatorData = {
    name,
    code,
    type: typeId.id,
    logo,
    alert_balance,
    lock_amt,
    delay,
    margin,
    pending_limit
  };

  const newOperator = await confQuery.createOperator(operatorData);

  return res
    .status(201)
    .json(new ApiResponse(201, newOperator, "Operator Created Successfully"));
});

// controllers/operator.controller.js
const updateOperator = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("id", id);
  const updateData = req.body;
  console.log("updateData", updateData);

  // Check if operator exists
  const existingOperator = await query.getOperatorById(id);
  if (!existingOperator) {
    throw new ApiError(404, "Operator not found");
  }

  // Handle logo upload if new logo provided
  let logoUrl = req.body.logo;

  console.log("logoUrl", logoUrl);
  if (req.body.type) {
    const typeId = await confQuery.getOperatorTypeByName(req.body.type);
    updateData.type = typeId.id;
  }

  // Prepare update data
  const updatedOperatorData = {
    ...existingOperator,
    ...updateData,
    logo: logoUrl
  };

  // Remove undefined values
  Object.keys(updatedOperatorData).forEach(
    (key) =>
      updatedOperatorData[key] === undefined && delete updatedOperatorData[key]
  );

  console.log("updatedOperatorData", updatedOperatorData);

  const result = await confQuery.updateOperator(id, updatedOperatorData);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Operator Updated Successfully"));
});

const getOperators = asyncHandler(async (req, res) => {
  const { status, type, code } = req.query;

  const filterOptions = {
    status,
    type,
    code
  };

  const operators = await confQuery.getOperators(filterOptions);

  if (!operators || operators.length === 0) {
    throw new ApiError(404, "No operators found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, operators, "Operators Retrieved Successfully"));
});

const deleteOperator = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if operator exists
  const existingOperator = await query.getOperatorById(id);
  if (!existingOperator) {
    throw new ApiError(404, "Operator not found");
  }

  await confQuery.deleteOperator(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Operator Deleted Successfully"));
});

const createKeyword = asyncHandler(async (req, res) => {
  const {
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
  } = req.body;
  console.log("req.body", req.body);

  // Validate required fields
  if (!description) throw new ApiError(400, "Description is required");
  if (!code) throw new ApiError(400, "Valid Code is required");
  if (!operator_id) throw new ApiError(400, "Operator ID is required");
  if (!min_digits || isNaN(min_digits) || min_digits <= 0)
    throw new ApiError(400, "Valid Min Digits is required");
  if (!max_digits || isNaN(max_digits) || max_digits <= 0)
    throw new ApiError(400, "Valid Max Digits is required");
  if (min_digits > max_digits)
    throw new ApiError(400, "Min Digits cannot be greater than Max Digits");

  // Validate foreign key relationships
  const operator = await query.checkOperatorExists(operator_id);
  if (!operator) throw new ApiError(400, "Invalid Operator ID");

  // Validate numeric fields
  if (additional_charges && isNaN(additional_charges)) {
    throw new ApiError(400, "Invalid additional charges amount");
  }
  if (min_recharge && (isNaN(min_recharge) || min_recharge < 0)) {
    throw new ApiError(400, "Invalid minimum recharge amount");
  }
  if (max_recharge && (isNaN(max_recharge) || max_recharge < 0)) {
    throw new ApiError(400, "Invalid maximum recharge amount");
  }
  if (min_recharge && max_recharge && min_recharge > max_recharge) {
    throw new ApiError(
      400,
      "Minimum recharge cannot be greater than maximum recharge"
    );
  }
  if (admin_margin && isNaN(admin_margin)) {
    throw new ApiError(400, "Invalid admin margin amount");
  }
  if (ret_std_margin && isNaN(ret_std_margin)) {
    throw new ApiError(400, "Invalid retailer standard margin");
  }
  if (dist_std_margin && isNaN(dist_std_margin)) {
    throw new ApiError(400, "Invalid distributor standard margin");
  }
  if (mdist_std_margin && isNaN(mdist_std_margin)) {
    throw new ApiError(400, "Invalid master distributor standard margin");
  }

  if (flat_margin && isNaN(flat_margin)) {
    throw new ApiError(400, "Invalid flat margin");
  }

  const existingKeyword = await confQuery.getKeywordByCode(code);
  if (existingKeyword) {
    throw new ApiError(400, "Keyword with code already exists");
  }

  // Prepare keyword data
  const keywordData = {
    description,
    code,
    operator_id,
    min_digits,
    max_digits,
    gap: gap || null,
    additional_charges: additional_charges || 0,
    is_additional_charges_fixed: is_additional_charges_fixed ?? true,
    min_recharge,
    max_recharge,
    admin_margin: admin_margin || 0,
    ret_std_margin: ret_std_margin || 0,
    dist_std_margin: dist_std_margin || 0,
    mdist_std_margin: mdist_std_margin || 0,
    flat_margin: flat_margin || 0,
    status: status ?? true
  };

  // Create keyword
  const newKeyword = await confQuery.createKeyword(keywordData);

  return res
    .status(201)
    .json(new ApiResponse(201, newKeyword, "Keyword Created Successfully"));
});

const getKeywords = asyncHandler(async (req, res) => {
  const {
    status,
    description,
    operator_id,
    min_digits,
    max_digits,
    gap,
    additional_charges,
    min_recharge,
    max_recharge,
    admin_margin,
    ret_std_margin,
    dist_std_margin,
    mdist_std_margin
  } = req.query;

  const filterOptions = {
    status,
    description,
    operator_id,
    min_digits,
    max_digits,
    gap,
    additional_charges,
    min_recharge,
    max_recharge,
    admin_margin,
    ret_std_margin,
    dist_std_margin,
    mdist_std_margin
  };

  const keywords = await confQuery.getKeywords(filterOptions);

  if (!keywords || keywords.length === 0) {
    throw new ApiError(404, "No Keywords found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, keywords, "Keywords Retrieved Successfully"));
});

const getKeywordById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const keyword = await query.getKeywordById(id);

  if (!keyword) {
    throw new ApiError(404, "Keyword not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, keyword, "Keyword Retrieved Successfully"));
});

const updateKeyword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if keyword exists
  const existingKeyword = await confQuery.getKeywordById(id);
  if (!existingKeyword) {
    throw new ApiError(404, "Keyword not found");
  }
  if (existingKeyword.code != updateData.code) {
    const existingKeywordCode = await confQuery.getKeywordByCode(
      updateData.code
    );
    if (existingKeywordCode) {
      throw new ApiError(400, "Keyword with code already exists");
    }
  }

  // Validate foreign keys if provided
  if (updateData.operator_id) {
    const operator = await confQuery.checkOperatorExists(
      updateData.operator_id
    );
    if (!operator) {
      throw new ApiError(400, "Invalid operator ID");
    }
  }

  // Prevent updating certain fields
  delete updateData.id;
  delete updateData.created_at;

  const result = await confQuery.updateKeyword(id, updateData);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Keyword Updated Successfully"));
});

const deleteKeyword = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if keyword exists
  const existingKeyword = await confQuery.getKeywordById(id);
  if (!existingKeyword) {
    throw new ApiError(404, "Keyword not found");
  }

  // Perform soft delete by updating status
  await query.updateKeyword(id, { status: existingKeyword.status === 1 ? 0 : 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Keyword Deleted Successfully"));
});

const getParametersForKeyword = asyncHandler(async (req, res) => {
  const {
    opList,
    rechargeApiList,
    offerApiList,
    statusApiList,
    balApiList,
    providerList,
    keywordList,
    operatorTypeList
  } = req.query;
  console.log("opList", opList);
  let params = {};

  // let rechargeApis = [];
  // let offerApis = [];
  // let statusApis = [];
  // let balApis = [];
  // let providers = [];

  if (opList) {
    console.log("inside oplist opList", opList);
    const operators = await confQuery.getOperatorsList();
    if (operators && operators.length > 0) {
      params.operators = operators;
    }
  }

  if (rechargeApiList) {
    console.log("inside rechargeApiList rechargeApiList", rechargeApiList);
    const rechargeApis = await confQuery.getApisList("recharge");
    if (rechargeApis && rechargeApis.length > 0) {
      params.rechargeApis = rechargeApis;
    }
  }

  if (offerApiList) {
    console.log("inside offerApiList offerApiList", offerApiList);
    const offerApis = await confQuery.getApisList("offer");
    if (offerApis && offerApis.length > 0) {
      params.offerApis = offerApis;
    }
  }
  // if( offerApiList) {
  //   console.log("inside offerApiList offerApiList", offerApiList);
  //   const offerApis = await confQuery.getApisList("Extra");
  //   if (offerApis && offerApis.length > 0) {
  //     params.offerApis = offerApis;
  //   }
  // }

  if (statusApiList) {
    console.log("inside statusApiList statusApiList", statusApiList);
    const statusApis = await confQuery.getApisList("status");
    if (statusApis && statusApis.length > 0) {
      params.statusApis = statusApis;
    }
  }

  if (balApiList) {
    console.log("inside balApiList balApiList", balApiList);
    const balApis = await confQuery.getApisList("balance");
    if (balApis && balApis.length > 0) {
      params.balApis = balApis;
    }
  }
  // if( statusApiList) {
  //   console.log("inside statusApiList statusApiList", statusApiList);
  //   const statusApis = await confQuery.getApisList("statuscheck");
  //   if (statusApis && statusApis.length > 0) {
  //     params.statusApis = statusApis;
  //   }
  // }

  // if( balApiList) {
  //   console.log("inside balApiList balApiList", balApiList);
  //   const balApis = await confQuery.getApisList("balancecheck");
  //   if (balApis && balApis.length > 0) {
  //     params.balApis = balApis;
  //   }
  // }

  if (providerList) {
    console.log("inside providerList providerList", providerList);
    const providers = await confQuery.getApiProvidersList();
    if (providers && providers.length > 0) {
      params.providers = providers;
    }
  }

  if (keywordList) {
    console.log("inside keywordList keywordList", keywordList);
    const keywords = await confQuery.getKeywordsList();
    if (keywords && keywords.length > 0) {
      params.keywords = keywords;
    }
  }

  if (operatorTypeList) {
    console.log("inside operatorTypeList operatorTypeList", operatorTypeList);
    const operatorTypes = await confQuery.getoperatorTypList();
    if (operatorTypes && operatorTypes.length > 0) {
      params.operatorTypes = operatorTypes;
    }
  }

  

  console.log(params);

  return res
    .status(200)
    .json(
      new ApiResponse(200, params, "Keyword Parameters Retrieved Successfully")
    );
});

const createApiProvider = asyncHandler(async (req, res) => {
  const {
    name,
    base_url,
    headers,
    query_params,
    body_params,
    balance_threshold,
    notification_email
  } = req.body;

  // Validate required fields
  if (!name) {
    throw new ApiError(400, "Provider name is required");
  }
  if (!base_url) {
    throw new ApiError(400, "Base URL is required");
  }

  const esistingApiProvider = await confQuery.getAPiProvidersByUrl(base_url);
  if (esistingApiProvider.length > 0) {
    throw new ApiError(400, "Provider with base url already exists");
  }

  const esistingApiProviderName = await confQuery.getAPiProvidersByName(name);
  if (esistingApiProviderName.length > 0) {
    throw new ApiError(400, "Provider with name already exists");
  }

  // Validate email if provided
  if (notification_email && !validateEmail(notification_email)) {
    throw new ApiError(400, "Invalid email format");
  }

  // Validate balance threshold
  if (balance_threshold && isNaN(parseFloat(balance_threshold))) {
    throw new ApiError(400, "Invalid balance threshold");
  }

  // Prepare provider data
  const apiProviderData = {
    name,
    base_url,
    headers: headers ? JSON.stringify(headers) : null,
    query_params: query_params ? JSON.stringify(query_params) : null,
    body_params: body_params ? JSON.stringify(body_params) : null,
    balance_threshold,
    notification_email
  };

  // Create API Provider
  const newApiProvider = await confQuery.createApiProvider(apiProviderData);

  return res
    .status(201)
    .json(
      new ApiResponse(201, newApiProvider, "API Provider Created Successfully")
    );
});

const getApiProviders = asyncHandler(async (req, res) => {
  const { status, name, balance_threshold_min, balance_threshold_max } =
    req.query;

  const filterOptions = {
    status,
    name,
    balance_threshold_min,
    balance_threshold_max
  };

  const apiProviders = await confQuery.getApiProviders(filterOptions);

  if (!apiProviders || apiProviders.length === 0) {
    throw new ApiError(404, "No API Providers found");
  }

  console.log(apiProviders);

  return res
    .status(200)
    .json(
      new ApiResponse(200, apiProviders, "API Providers Retrieved Successfully")
    );
});

const getApiProviderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const apiProvider = await confQuery.getApiProviderById(id);

  if (!apiProvider) {
    throw new ApiError(404, "API Provider not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, apiProvider, "API Provider Retrieved Successfully")
    );
});

const updateApiProvider = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Validate email if provided
  if (
    updateData.notification_email &&
    !validateEmail(updateData.notification_email)
  ) {
    throw new ApiError(400, "Invalid email format");
  }

  if (updateData.headers) {
    updateData.headers = JSON.stringify(updateData.headers);
  }

  if (updateData.query_params) {
    updateData.query_params = JSON.stringify(updateData.query_params);
  }

  if (updateData.body_params) {
    updateData.body_params = JSON.stringify(updateData.body_params);
  }

  // Check if API Provider exists
  const existingApiProvider = await confQuery.getApiProviderById(id);
  if (!existingApiProvider) {
    throw new ApiError(404, "API Provider not found");
  }

  // Prevent updating certain fields

  const result = await confQuery.updateApiProvider(id, updateData);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "API Provider Updated Successfully"));
});

const deleteApiProvider = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if API Provider exists
  const existingApiProvider = await confQuery.getApiProviderById(id);
  if (!existingApiProvider) {
    throw new ApiError(404, "API Provider not found");
  }

  // Soft delete by changing status
  await confQuery.updateApiProvider(id, { status: existingApiProvider.status === 1 ? 0 : 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "API Provider Deleted Successfully"));
});

const createApi = asyncHandler(async (req, res) => {
  const {
    description,
    type,
    request_port,
    request_url_endpoint,
    request_type,
    body_params,
    query_params,
    headers,
    response_format_type,
    divider,
    response_keys,
    response_rules,
    msg_filter,
    cust_filter,
    response_filter,
    amt_filter,
    bal_filter,
    tid_filter,
    reqId_filter,
    opId_filter,
    forward_start,
    forward_before,
    retry_count,
    timeout_seconds
  } = req.body;

  // Validate required fields
  if (!description) {
    throw new ApiError(400, "Description is required");
  }
  if (!request_url_endpoint) {
    throw new ApiError(400, "Request URL endpoint is required");
  }
  if (!request_type) {
    throw new ApiError(400, "Request type is required");
  }
  if (!type) {
    throw new ApiError(400, "API type is required");
  }
  if (!response_format_type) {
    throw new ApiError(400, "Response format type is required");
  }

  // Validate enums
  if (!["get", "post"].includes(request_type.toLowerCase())) {
    throw new ApiError(400, "Invalid request type. Must be 'get' or 'post'");
  }
  if (
    ![
      "recharge",
      "Extra",
      "balancecheck",
      "statuscheck",
      "message",
      "others"
    ].includes(type.toLowerCase())
  ) {
    throw new ApiError(400, "Invalid API type");
  }
  if (!["XML", "JSON[]", "JSON{}", "text"].includes(response_format_type)) {
    throw new ApiError(400, "Invalid response format type");
  }

  // response_keys: [{"name":"status"},{"name":"value"}] looks like this
  // need to store it like key1 and key 2 2 diferent

  console.log(response_keys);

  const parsedResponseKeys = JSON.parse(response_keys);
  const key1 = parsedResponseKeys[0]?.name || null;
  const key2 = parsedResponseKeys[1]?.name || null;

  // Prepare API data
  const apiData = {
    description,
    type: type.toLowerCase(),
    request_port,
    request_url_endpoint,
    request_type: request_type.toLowerCase(),
    headers: JSON.stringify(headers || {}),
    body_params: JSON.stringify(body_params || {}),
    query_params: JSON.stringify(query_params || {}),
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
    forward_start: forward_start,
    forward_before: forward_before,
    retry_count: retry_count || 3,
    timeout_seconds: timeout_seconds || 30
  };
  console.log("apiData", apiData);

  // Create API
  const newApiId = await confQuery.createApi(apiData);

  //if (apiData.type === "recharge" || apiData.type === "statuscheck") {
    const parsedResponseRules = JSON.parse(response_rules);

    const rulesListWIthApiId = parsedResponseRules.map((rule) => ({
      api_id: newApiId,
      ...rule
    }));

    const responseRules = await confQuery.addApiRules(rulesListWIthApiId);

    console.log("responseRules", responseRules);
 // }

  return res
    .status(201)
    .json(new ApiResponse(201, newApiId, "API Created Successfully"));
});


const getApis = asyncHandler(async (req, res) => {
  const { status, description, type, response_format_type } = req.query;

  const filterOptions = {
    status,
    description,
    type,
    response_format_type
  };

  const apis = await confQuery.getApis(filterOptions);

  if (!apis || apis.length === 0) {
    throw new ApiError(404, "No APIs found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, apis, "APIs Retrieved Successfully"));
});

const getApiById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const api = await confQuery.getApiById(id);

  if (!api) {
    throw new ApiError(404, "API not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, api, "API Retrieved Successfully"));
});

const updateApi = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if API exists
  const existingApi = await confQuery.getApiById(id);
  if (!existingApi) {
    throw new ApiError(404, "API not found");
  }

  // Validate enums if provided
  if (
    updateData.request_type &&
    !["get", "post"].includes(updateData.request_type.toLowerCase())
  ) {
    throw new ApiError(400, "Invalid request type. Must be 'get' or 'post'");
  }

  if (
    updateData.type &&
    ![
      "recharge",
      "Extra",
      "balancecheck",
      "statuscheck",
      "message",
      "others"
    ].includes(updateData.type.toLowerCase())
  ) {
    throw new ApiError(400, "Invalid API type");
  }

  if (
    updateData.response_format_type &&
    !["XML", "JSON[]", "JSON{}", "text"].includes(
      updateData.response_format_type
    )
  ) {
    throw new ApiError(400, "Invalid response format type");
  }

  if (updateData.response_keys) {
    try {
      const parsedKeys = JSON.parse(updateData.response_keys);
      updateData.key1 = parsedKeys[0]?.name || null;
      updateData.key2 = parsedKeys[1]?.name || null;
    } catch (err) {
      throw new ApiError(400, "Invalid response_keys format");
    }
  }


  // Prepare update data
  const preparedUpdateData = { ...updateData };
  delete preparedUpdateData.response_keys;
  delete preparedUpdateData.response_rules;

  console.log("preparedUpdateData", preparedUpdateData);

  // Convert JSON fields to strings if they exist
  const jsonFields = ["body_params", "headers", "query_params"];
  jsonFields.forEach((field) => {
    if (preparedUpdateData[field]) {
      preparedUpdateData[field] = JSON.stringify(preparedUpdateData[field]);
    }
  });

  // Prevent updating certain fields
  delete preparedUpdateData.id;
  delete preparedUpdateData.created_at;

  const result = await confQuery.updateApi(id, preparedUpdateData);
  console.log("updateData", updateData);

 // if (updateData.type === "recharge" || updateData.type === "statuscheck") {
    // Parse response_keys if provided
 
    if (updateData.response_rules) {
      try {
        const parsedRules = JSON.parse(updateData.response_rules);

        // First delete old rules for this API
        await confQuery.deleteApiRulesByApiId(id);

        // Then insert new rules

        const rulesListWithApiId = parsedRules.map((rule) => ({
          api_id: id,
          ...rule
        }));

        await confQuery.addApiRules(rulesListWithApiId);
      } catch (err) {
      //  throw new ApiError(400, "Invalid response_rules format");
      }
    }
  //}

  return res
    .status(200)
    .json(new ApiResponse(200, result, "API Updated Successfully"));
});

const deleteApi = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if API exists
  const existingApi = await confQuery.getApiById(id);
  if (!existingApi) {
    throw new ApiError(404, "API not found");
  }

  // Soft delete by changing status
  await confQuery.updateApi(id, { status: existingApi.status === 1 ? 0 : 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "API Deleted Successfully"));
});
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

const createExtraLine = asyncHandler(async (req, res) => {
  const {
    keyword_id,
    description,
    merchant_code,
    api_provider,
    api,
    type,
      status,
    circles_id,
    name_filter,
    description_filter,
    extra_info_filter,
    account_filter,
    due_date_filter,
    bill_date_filter,
    rs_filter,
    is_main_response,
  
  } = req.body;

  if (!keyword_id || !description || !api_provider || !api) {
    throw new ApiError(
      400,
      "Required fields: keyword_id, description, type, main_api"
    );
  }

  const newKeywordLine = await confQuery.createExtraLine({
    keyword_id,
    description,
    merchant_code,
    api_provider,
    api,
    type,

    status: status ?? true,
    circles_id,
    name_filter,
    description_filter,
    extra_info_filter,
    account_filter,
    due_date_filter,
    bill_date_filter,
    rs_filter,
    is_main_response,

  });

  // Get the newly inserted keyword_line ID
  const kl_id = newKeywordLine.insertId;


  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { kl_id },
        "Extra Line Created Successfully"
      )
    );
});

const getExtraLines = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("req.params", req.params);

  console.log("id", id);
  const filterOptions = req.query;
  const keywordLines = await confQuery.getExtraLines(id);

  if (!keywordLines || keywordLines.length === 0) {
    throw new ApiError(404, "No Keyword Lines found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, keywordLines, "Keyword Lines Retrieved Successfully")
    );
});

const getExtraLineById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("id", id);
  const extraLine = await confQuery.getExtraLinesById(id);
  if (!extraLine) {
    throw new ApiError(404, "Extra Line not found");
  }
  console.log("extraLine", extraLine);
  return res
    .status(200)
    .json(
      new ApiResponse(200, extraLine, "Extra Line Retrieved Successfully")
    );
});

const updateExtraLine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  console.log("id", id);
  console.log("updateData", updateData);

  // Check if the Extra Line exists
  const existingExtraLine = await confQuery.getExtraLinesById(id);
  if (!existingExtraLine) {
    throw new ApiError(404, "Extra Line not found");
  }

  delete updateData.keyword_id;

  // Prepare update data according to new table structure
  const extraLineData = {
    description: updateData.description,
    merchant_code: updateData.merchant_code,
    api_provider: updateData.api_provider,
    api: updateData.api,
    type: updateData.type,
    status: updateData.status,
    circles_id: updateData.circles_id,
    name_filter: updateData.name_filter,
    description_filter: updateData.description_filter,
    extra_info_filter: updateData.extra_info_filter,
    account_filter: updateData.account_filter,
    due_date_filter: updateData.due_date_filter,
    bill_date_filter: updateData.bill_date_filter,
    rs_filter: updateData.rs_filter,
    is_main_response: updateData.is_main_response
  };

  // Update extra line data
  const result = await confQuery.updateExtra(id, extraLineData);
  console.log("result", result);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Extra Line Updated Successfully"));
});

const deleteExtraLine = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const existingExtraLine = await confQuery.getExtraLinesById(id);
    console.log("existingExtraLine", existingExtraLine);
    if (!existingExtraLine) {
      throw new ApiError(404, "Extra Line not found");
    }
    const result = await confQuery.updateExtra(id, { status: !existingExtraLine.status });
    console.log("result", result);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Extra Line Updated Successfully"));
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

const createKeywordLine = asyncHandler(async (req, res) => {
  const {
    keyword_id,
    description,
    merchant_code,
    api_provider,
    recharge_api,
    balance_check_api,
    status_check_api,
    lock_amt,
    min_amt,
    max_amt,
    min_digits,
    max_digits,
    gap,
    additional_charges,
    is_additional_charges_fixed,
    is_charges_by_user,
    is_charges_by_admin,
    ret_margin,
    dist_margin,
    mdist_margin,
    flat_margin,
    margin_status,
    admin_margin,
    balance,
    today_amount,
    today_count,
    today_profit,
    priority,
    daily_max_count,
    daily_max_amount,
    status
  } = req.body;

  if (!keyword_id || !description || !api_provider || !recharge_api) {
    throw new ApiError(
      400,
      "Required fields: keyword_id, description, type, main_api"
    );
  }

  let bal = null;
  if (balance_check_api != 0) {
    bal = balance_check_api;
  }

  let stat = null;
  if (status_check_api != 0) {
    stat = status_check_api;
  }

  const newKeywordLine = await confQuery.createKeywordLine({
    keyword_id,
    description,
    merchant_code,
    api_provider,
    recharge_api,
    bal,
    stat,
    lock_amt,
    min_amt,
    max_amt,
    min_digits,
    max_digits,
    gap,
    additional_charges,
    is_additional_charges_fixed,
    is_charges_by_user,
    is_charges_by_admin,
    ret_margin,
    dist_margin,
    mdist_margin,
    flat_margin,
    margin_status: margin_status ?? false,
    admin_margin,
    status: status ?? true,
    priority
  });

  // Get the newly inserted keyword_line ID
  const kl_id = newKeywordLine.insertId;

  // Insert financial data
  await confQuery.createFinancials({
    kl_id,
    balance: balance ?? 0,
    today_amount: today_amount ?? 0,
    today_count: today_count ?? 0,
    today_profit: today_profit ?? 0,
    daily_max_count: daily_max_count ?? null,
    daily_max_amount: daily_max_amount ?? null
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { kl_id },
        "Keyword Line & Financials Created Successfully"
      )
    );
});

const getKeywordLines = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("req.params", req.params);

  console.log("id", id);
  const filterOptions = req.query;
  const keywordLines = await confQuery.getKeywordLines(id);

  if (!keywordLines || keywordLines.length === 0) {
    throw new ApiError(404, "No Keyword Lines found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, keywordLines, "Keyword Lines Retrieved Successfully")
    );
});

const getKeywordLineById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("id", id);
  const keywordLine = await confQuery.getKeywordLineById(id);
  if (!keywordLine) {
    throw new ApiError(404, "Keyword Line not found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, keywordLine, "Keyword Line Retrieved Successfully")
    );
});
const updateKeywordLine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  console.log("id", id);

  // Check if the Keyword Line exists
  const existingKeywordLine = await confQuery.getKeywordLineById(id);
  if (!existingKeywordLine) {
    throw new ApiError(404, "Keyword Line not found");
  }

  console.log("updateData", updateData);
  delete updateData.keyword_id;

  // Separate keyword line data and financial data
  const keywordLineData = {
    description: updateData.description,
    merchant_code: updateData.merchant_code,
    api_provider: updateData.api_provider,
    recharge_api: updateData.recharge_api,
    balance_check_api:
      updateData.balance_check_api == 0 ? null : updateData.balance_check_api,
    status_check_api:
      updateData.status_check_api == 0 ? null : updateData.status_check_api,
    lock_amt: updateData.lock_amt,
    min_amt: updateData.min_amt,
    max_amt: updateData.max_amt,
    min_digits: updateData.min_digits,
    max_digits: updateData.max_digits,
    gap: updateData.gap,
    additional_charges: updateData.additional_charges,
    is_additional_charges_fixed: updateData.is_additional_charges_fixed,
    is_charges_by_user: updateData.is_charges_by_user,
    is_charges_by_admin: updateData.is_charges_by_admin,
    ret_margin: updateData.ret_margin,
    dist_margin: updateData.dist_margin,
    mdist_margin: updateData.mdist_margin,
    flat_margin: updateData.flat_margin,
    margin_status: updateData.margin_status,
    admin_margin: updateData.admin_margin,
    priority: updateData.priority,
    status: updateData.status
  };

  console.log("keywordLineData", keywordLineData);

  const financialData = {
    balance: updateData.balance,
    today_amount: updateData.today_amount,
    today_count: updateData.today_count,
    today_profit: updateData.today_profit,
    daily_max_count: updateData.daily_max_count,
    daily_max_amount: updateData.daily_max_amount
  };

  // Update keyword line data
  const result = await confQuery.updateKeywordLine(id, keywordLineData);
  console.log("result", result);

  console.log("financialData", financialData);
  console.log("result.insertId", result.insertId);
  console.log("id", id);

  // Update financial data
  const update = await confQuery.updateFinancials(id, financialData);
  console.log("update", update);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Keyword Line Updated Successfully"));
});

const deleteKeywordLine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existingKeywordLine = await confQuery.getKeywordLineById(id);
  if (!existingKeywordLine) {
    throw new ApiError(404, "Keyword Line not found");
  }
  await confQuery.updateKeywordLine(id, { status: existingKeywordLine.status === 1 ? 0 : 1 });
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Keyword Line Deleted Successfully"));
});

// ✅ API to Update Only Financials
const updateFinancials = asyncHandler(async (req, res) => {
  const { kl_id } = req.params;
  const { balance, today_amount, today_count } = req.body;

  const existingFinancials = await query.getFinancialsByKlId(kl_id);
  if (!existingFinancials) {
    throw new ApiError(404, "Financial data not found for this Keyword Line");
  }

  await query.updateFinancials(kl_id, { balance, today_amount, today_count });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Financials Updated Successfully"));
});

const createPreValues = asyncHandler(async (req, res) => {
  const { kl_id, amount } = req.body;
  console.log("req.body", req.body);
  // Validate required fields
  if (!amount) {
    throw new ApiError(400, "Amount is required");
  }

  if (!kl_id) {
    throw new ApiError(400, "Keyword Line ID is required");
  }
  // Check if keyword line exists
  const existingKeywordLine = await confQuery.getKeywordLineById(kl_id);
  if (!existingKeywordLine) {
    throw new ApiError(404, "Keyword Line not found");
  }
  // Check if denomination already exists
  const existingpreValue = await confQuery.getPreValueByValue(kl_id, amount);
  if (existingpreValue) {
    throw new ApiError(400, "amount already exists");
  }
  // Create denomination
  const newPreValue = await confQuery.createPreValues(kl_id, amount);

  return res
    .status(201)
    .json(
      new ApiResponse(201, newPreValue, "Denomination Created Successfully")
    );
});
const getPreValues = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log("req.params", req.params);

  const preValue = await confQuery.getPreValues(id);

  if (!preValue) {
    throw new ApiError(404, "No preValue found");
  }

  // if (preValue.length === 0) {
  //   return res
  //   .status(200)
  //   .json(new ApiResponse(200, preValue, "preValue Retrieved Successfully"));
  // }

  return res
    .status(200)
    .json(new ApiResponse(200, preValue, "preValue Retrieved Successfully"));
});

const deletePreValues = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if denomination exists
  const existingPreValue = await confQuery.getPreValuById(id);
  if (!existingPreValue) {
    throw new ApiError(404, "PreValue not found");
  }

  // Perform soft delete by updating status
  await confQuery.deletePreValues(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "prevalue Deleted Successfully"));
});

const getCircleProviders = asyncHandler(async (req, res) => {
 const [getCircleProviders] = await confQuery.db.query(
  `SELECT id,  name FROM customCircles `
  );
  if (!getCircleProviders || getCircleProviders.length === 0) {
    throw new ApiError(404, "No Circle Providers found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, getCircleProviders, "Circle Providers Retrieved Successfully")
    );
}
);

const getCircles = asyncHandler(async (req, res) => {
  const [circles] = await confQuery.db.query(
    `SELECT id,name from circles`
  );
  if (!circles || circles.length === 0) {
    throw new ApiError(404, "No Circles found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, circles, "Circles Retrieved Successfully")
    );
}
);

const getCustomCircle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("req.params", req.params);

  console.log("id", id);
  const [customCircle] = await confQuery.db.query(
    `SELECT * from customCircles where id = ?`,
    [id]
  );
  if (!customCircle || customCircle.length === 0) {
    throw new ApiError(404, "No Circle Providers found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, customCircle, "Circle Providers Retrieved Successfully")
    );
}
);

const createCustomCircle = asyncHandler(async (req, res) => {
  const {data , name} = req.body;
  console.log("req.body", req.body);

  //here data is a map like {id,code}
  //and hvae to add it in -- create table customCircles(
// --     id INT AUTO_INCREMENT PRIMARY KEY,
// --     provider_id int not null,
// --     codes json not null,
// --     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
// --     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// -- );

//direclty ad this map to codes
  //and provider id is the id of the provider
  //and if provider id is not present then throw error
  //and if data is not present then throw error

  if(!data || !name){
    throw new ApiError(400, "data and provider_id are required");
  }

 const insertData = confQuery.db.query(
  `INSERT INTO customCircles (name, codes) VALUES (?, ?)`,
  [name, JSON.stringify(data)]
  );
  if (!insertData) {
    throw new ApiError(404, "No Circle Providers found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, insertData, "Circle Providers Retrieved Successfully")
    );
}
);
const updateCustomCircle = asyncHandler(async (req, res) => {
  console.log("req.body", req.body);
  const {id, data , name} = req.body;
  

  const [updatedData] = await confQuery.db.query(
    `UPDATE customCircles SET codes = ?, name = ? WHERE id = ?`,
    [JSON.stringify(data), name, id]
  );
  if (!updatedData) {
    throw new ApiError(404, "No Circle Providers found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedData, "Circle Providers Retrieved Successfully")
    );
}
);





module.exports = {
  createOperatorType,
  getOperatorTypes,
  updateOperatorType,
  deleteOperatorType,
  createOperator,
  getOperators,
  deleteOperator,
  updateOperator,
  createApiProvider,
  getApiProviders,
  getApiProviderById,
  updateApiProvider,
  deleteApiProvider,
  createApi,
  getApis,
  getApiById,
  updateApi,
  deleteApi,
  createKeyword,
  getKeywords,
  updateKeyword,
  deleteKeyword,
  getKeywordById,
  getParametersForKeyword,
  createKeywordLine,
  getKeywordLines,
  getKeywordLineById,
  updateKeywordLine,
  deleteKeywordLine,
  updateFinancials,
  getExtraLineById,
  getExtraLines,
  createExtraLine,
  updateExtraLine,
  deleteExtraLine,
  createPreValues,
  getPreValues,
  deletePreValues,
  getCircleProviders,
  getCircles,
  createCustomCircle,
  updateCustomCircle,
  getCustomCircle,
};
