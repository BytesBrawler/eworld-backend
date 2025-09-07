const db = require("../db");

async function getAllUsers() {
  console.log("Querying all users");
  const [users] = await db.query("SELECT * FROM users");
  return users;
}


async function getUserDetails(userId) {
  const [users] = await db.query("SELECT  id, person, mobile,company, email, role_id,margin_rates, is_flat_margin, can_withdraw, can_set_margin, can_edit, margin_type , isWalletAllowed,marginAllowed  FROM users WHERE id = ?", [userId]);
  return users[0];
}

async function findUserByUsername(username) {
  const [users] = await db.query("SELECT * FROM users WHERE username = ?", [
    username
  ]);
  return users[0];
}

async function findUserByMobile(mobile) {
  //  console.log(mobile + "Mobile");
  const [users] = await db.query("SELECT * FROM users WHERE mobile = ?", [
    mobile
  ]);
  console.log(users);
  return users[0];
}

async function findUserById(id) {
  const [users] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  return users[0];
}

async function createUser(userData) {
  console.log("Creating user" + JSON.stringify(userData));
  const [result] = await db.query(
    `INSERT INTO users (
            person, password, mobile, address,
            company, email, role_id, parent_id, margin_type ,created_from ,can_set_margin,can_withdraw,can_edit, is_flat_margin, margin_rates
        ) VALUES (?, ?, ?, ?,?, ?,?,?,?, ?,?, ?, ?,?,?)`,
    [
      userData.person,
      userData.password,
      userData.mobile,
      userData.address,
      userData.company,
      userData.email,
      userData.role_id,
      userData.parent_id,
      userData.margin_type,
      userData.created_from,      
      userData.can_set_margin ?? undefined,
      userData.can_withdraw ?? undefined,
      userData.can_edit ?? undefined,
      userData.is_flat_margin ?? undefined, // Use default DB value if undefined
      userData.margin_rates ? parseFloat(userData.margin_rates) : undefined // Use default DB value if undefined,

    ]
  );
  return result;
}

async function updateUser(userId, userData) {
  console.log("Updating user: " + JSON.stringify(userData));

  const updateFields = [
    "person",
    "mobile",
    "address",
    "company",
    "email",
    "role_id",
    "margin_rates",
    "is_flat_margin",
    "can_edit_retailer",
    "can_withdraw",
    "can_set_margin",
    "status",
    "updated_from",

  ];

  // Dynamically build the SQL update query
  const setClause = updateFields
    .filter((field) => userData[field] !== undefined)
    .map((field) => `${field} = ?`)
    .join(", ");

  const values = updateFields
    .filter((field) => userData[field] !== undefined)
    .map((field) => {
      // Special handling for specific fields
      if (field === "margin_rates" && userData[field]) {
        return parseFloat(userData[field]);
      }
      return userData[field];
    });

  // Add userId to the end of values for the WHERE clause
  values.push(userId);

  const query = `
    UPDATE users 
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;

  const [result] = await db.query(query, values);
  return result;
}

async function createUserLog(logData) {
  // First, remove any existing token for this user
  await db.query("DELETE FROM user_logs WHERE user_id = ?", [logData.user_id]);

  // Then create new log entry with token
  const [result] = await db.query(
    `INSERT INTO user_logs (
            user_id, token, action, ip_address, 
            device_info, location
        ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      logData.user_id,
      logData.token,
      logData.action,
      logData.ip_address,
      logData.device_info,
      logData.location
    ]
  );
  return result;
}

async function removeUserToken(token) {
  const [result] = await db.query("DELETE FROM user_logs WHERE token = ?", [
    token
  ]);
  return result;
}

async function getUserToken(userId) {
  const [logs] = await db.query(
    "SELECT * FROM user_logs WHERE user_id = ?",
    [userId]
  );

  if (logs.length === 0) {
    return null;
  }

  return logs[0].token;
}

async function validateToken(token) {
  const [logs] = await db.query(
    `SELECT ul.token, u.status, u.role_id,  u.parent_id, u.balance, u.id as user_id
         FROM user_logs ul
         JOIN users u ON ul.user_id = u.id
         WHERE ul.token = ? 
         `,
    [token]
  );
  console.log(logs);
  return logs[0];
}

async function updatePassword(password, mobile) {
  const [result] = await db.query(
    "UPDATE users SET password = ? WHERE mobile = ?",
    [password, mobile]
  );
  return result;
}

async function getUsersbyParentId(role_id, parentId) {
  // Get direct children with their info
  const [users] = await db.query(
    `SELECT id, person, mobile, company, email, address, balance, parent_id, is_flat_margin, margin_rates, can_withdraw, can_set_margin, can_edit, isWalletAllowed, margin_type, marginAllowed, status
     FROM users
     WHERE parent_id = ? AND role_id = ?
     ORDER BY person ASC, company ASC`,
    [parentId, role_id]
  );

  // For each user, get the sum of balances of their direct children, grouped by role
  for (const user of users) {
    const [childrenBalances] = await db.query(
      `SELECT role_id, SUM(balance) as total_balance, COUNT(*) as count
       FROM users
       WHERE parent_id = ?
       GROUP BY role_id`,
      [user.id]
    );
    user.children_balances = childrenBalances;
  }

  return users;
}
// async function getUsersbyParentId(role_id, parentId) {
//   console.log(parentId);
//   const [users] = await db.query(
//     "SELECT id,person,mobile ,company ,email ,address , balance ,parent_id ,is_flat_margin , margin_rates , can_withdraw , can_set_margin , can_edit, isWalletAllowed , margin_type , marginAllowed,status FROM users WHERE parent_id = ? and role_id = ?",
//     [parentId, role_id]
//   );
//   return users;
// }

// async function getUsersbyParentIdForSuperAdmin(role_id, parentId) {
//   console.log(parentId);
//   const [users] = await db.query(
//     "SELECT id,person,mobile ,company ,email ,address , balance ,password ,parent_id ,is_flat_margin , margin_rates , can_withdraw , can_set_margin , can_edit, isWalletAllowed , margin_type , marginAllowed,status FROM users WHERE parent_id = ? and role_id = ?",
//     [parentId, role_id]
//   );
//   return users;
// }

async function getUsersbyParentIdForSuperAdmin(role_id, parentId) {
  // Get direct children with their info
  let query = `
    SELECT 
      u.id,
      u.person,
      u.mobile,
      u.company,
      u.email,
      u.address,
      u.balance,
      u.password,
      u.parent_id,
      u.is_flat_margin,
      u.margin_rates,
      u.can_withdraw,
      u.can_set_margin,
      u.can_edit,
      u.isWalletAllowed,
      u.margin_type,
      u.marginAllowed,
      u.status,
      r.description as role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.role_id = ?
  `;
  const params = [role_id];

  if (parentId !== undefined && parentId !== null && parentId !== "") {
    query += " AND u.parent_id = ?";
    params.push(parentId);
  }

  query += " ORDER BY u.person ASC, u.company ASC";

  const [users] = await db.query(query, params);

  // For each user, get the sum of balances of their direct children, grouped by role
  for (const user of users) {
    const [childrenBalances] = await db.query(
      `SELECT role_id, SUM(balance) as total_balance, COUNT(*) as count
       FROM users
       WHERE parent_id = ?
       GROUP BY role_id`,
      [user.id]
    );
    user.children_balances = childrenBalances;
  }

  return users;
}
// async function getUsersbyParentIdForSuperAdmin(role_id, parentId) {
//   let query = "SELECT id,person,mobile,company,email,address,balance,password,parent_id,is_flat_margin,margin_rates,can_withdraw,can_set_margin,can_edit,isWalletAllowed,margin_type,marginAllowed,status FROM users WHERE role_id = ?";
//   const params = [role_id];

//   if (parentId !== undefined && parentId !== null && parentId !== "") {
//     query += " AND parent_id = ?";
//     params.push(parentId);
//   }

//   const [users] = await db.query(query, params);
//   return users;
// }

// Wallet Queries

async function createOrder(userid, amount,orderId){
  const [result] = await db.query(
    "insert into transactions (user_id, amount, order_id) values (?, ?,?)",
    [userid, amount,orderId],
  );
  return result.insertId;
}

async function getBalance(userId) {
  console.log("userId is",userId);
  try {
    const [balance] = await db.query("SELECT balance FROM users WHERE id = ?", [
      userId
    ]);
  
  
    console.log(balance);
    return balance[0].balance;
  } catch (error) {
    console.log(error);
  }
 
}

async function addBalance(userId, amount) {
  const [balance] = await db.query(
    "update users set balance = balance + ? WHERE id = ?",
    [amount, userId]
  );
  console.log(balance);
  return balance[0];
}
async function deductBalance(userId, amount) {
  const [balance] = await db.query(
    "update users set balance = balance - ? WHERE id = ?",
    [amount, userId]
  );

  return balance[0];
}

async function createFundRequest(userId, amount) {
  await db.query(
    "INSERT INTO fund_request (user_id, amount, status) VALUES (?, ?, ?)",
    [userId, amount, "pending"]
  );
}

async function getFundRequests(userId) {
  const [requests] = await db.query(
    "SELECT * FROM fund_request WHERE user_id = ?",
    [userId]
  );
  return requests;
}

async function getFundRequestbyId(Id) {
  const [request] = await db.query("SELECT * FROM fund_request WHERE id = ?", [
    Id
  ]);
  return request[0];
}

async function getFundRequestsParent(userId) {
  const [requests] = await db.query(
    "SELECT * FROM fund_request and users where parent_id = ? and users.id = fund_request.user_id",
    [userId]
  );
  return requests;
}

async function updateFundRequestStatus(id, status, userId) {
  console.log("Updating fund request status" + id + status + userId);
  console.log("Updating fund request status");
  const inser = await db.query(
    "UPDATE fund_request SET status = ? , approved_by = ? WHERE id = ?",
    [status, userId, id]
  );
  console.log(inser);
}

async function getTransactions(userId) {
  const [transactions] = await db.query(
    "SELECT * FROM transactions WHERE user_id = ?",
    [userId]
  );
  return transactions;
}

// Balance Report Queries
async function getBalanceReport(userId) {
  const [asApprover] = await db.query(
    "SELECT * FROM bal_transactions WHERE user_id = ?",
    [userId]
  );
  //
  const [asRequester] = await db.query(
    "SELECT * FROM bal_transactions WHERE to_id = ?",
    [userId]
  );
  const report = {
    asApprover,
    asRequester
  };
  return report;
}

async function addBalanceTransaction(
  userId,
  toId,
  amount,
  originalAmount,
  status,
  prevBalance,
  newBalance,
  maalikPrevBalance,
  maalikNewBalance,
  referenceId,
  type,
  remark
) {
  await db.query(
    "INSERT INTO bal_transactions (user_id, to_id, transaction_type, amount,original_amount, status, prev_balance, new_balance, maalik_prev_balance , maalik_new_balance ,reference_id, remark) VALUES (?, ?, ?, ?,?,?, ?, ?,?, ?, ?, ?)",
    [
      userId,
      toId,
      type,
      amount,
      originalAmount,
      status,
      prevBalance,
      newBalance,
      maalikPrevBalance,
      maalikNewBalance,
      referenceId,
      remark
    ]
  );
}
// Recharge Queries

async function initiateRecharge(userId, number, amount, operator) {
  await db.query(
    "INSERT INTO recharges (user_id, number, amount, operator, status) VALUES (?, ?, ?, ?, ?)",
    [userId, number, amount, operator, "pending"]
  );
  return { transactionId: "generated_id" };
}
async function getRechargeStatus(transactionId) {
  const [status] = await db.query("SELECT status FROM recharges WHERE id = ?", [
    transactionId
  ]);
  return status[0];
}
async function getRechargeHistory(userId) {
  const [history] = await db.query(
    "SELECT * FROM recharges WHERE user_id = ?",
    [userId]
  );
  return history;
}
async function retryRecharge(transactionId) {
  await db.query("UPDATE recharges SET status = ? WHERE id = ?", [
    "retry",
    transactionId
  ]);
}
async function listOperators() {
  const [operators] = await db.query(
    "SELECT * FROM operators WHERE active = 1"
  );
  return operators;
}

// Reseller Queries

async function registerReseller(name, contact) {
  await db.query("INSERT INTO resellers (name, contact) VALUES (?, ?)", [
    name,
    contact
  ]);
}
async function getOrGenerateApiKey(userId) {
  const [key] = await db.query(
    "SELECT api_key FROM resellers WHERE user_id = ?",
    [userId]
  );
  if (key.length === 0) {
    const newKey = "generated_api_key";
    await db.query("UPDATE resellers SET api_key = ? WHERE user_id = ?", [
      newKey,
      userId
    ]);
    return newKey;
  }
  return key[0].api_key;
}
async function whitelistIp(userId, ip) {
  await db.query("INSERT INTO whitelisted_ips (user_id, ip) VALUES (?, ?)", [
    userId,
    ip
  ]);
}
async function getResellerTransactions(userId) {
  const [transactions] = await db.query(
    "SELECT * FROM reseller_transactions WHERE user_id = ?",
    [userId]
  );
  return transactions;
}

async function getAllowedFunctionalities(roleId) {
  const [functionalities] = await db.query(
    "SELECT  allowed_actions , allowed_actions_web FROM roles WHERE id = ?",
    [roleId]
  );
  return functionalities[0];
}

async function getLatestNews(role) {
  const query = `SELECT description FROM news WHERE is_public = ? and  type = ?  and  JSON_CONTAINS(role, '?', '$')  AND (expiry_time > NOW() OR expiry_time IS NULL)  ORDER BY created_at DESC LIMIT 1`;
  const [results] = await db.query(query ,  [true ,'text',role ]);
  if(results.length === 0){
    return "Welcome to the dashboard";
  }
  return results[0].description; // Return the first (latest) news item
}
async function getLatestImageNews(role) {
  const query = `SELECT image FROM news WHERE is_public = ? and  type = ?  and  JSON_CONTAINS(role, '?', '$')  AND (expiry_time > NOW() OR expiry_time IS NULL)  ORDER BY created_at DESC`;
  const [results] = await db.query(query ,  [true ,'image',role ]);
  console.log("Image News" + results);
  if(results.length === 0){
    return null;
  }
  return results; // Return the first (latest) news item
}

async function getAlert(role){
  const [results] = await db.query("SELECT description FROM news WHERE role = ? and is_public = ? and priority =?   ORDER BY created_at DESC LIMIT 1", [role , true ,1]);
  if(results.length === 0){
    return " ";
  }
  return results[0].description;
}

//getTotalUsers
async function getTotalUsers() {
  const [users] = await db.query("SELECT COUNT(*) as total FROM users");
  return users[0].total;
}

async function getTotalUserUnderMe(userId, roles) {
  // const [users] = await db.query("SELECT COUNT(*) as total FROM users WHERE parent_id = ?", [userId]);
  let roleWise;

  // const roles = [role2, role3, role4, role5];
  for (let i = 0; i < roles.length; i++) {
    const [roleCount] = await db.query(
      "SELECT COUNT(*) as total FROM users WHERE parent_id = ? and role = ?",
      [userId, roles[i]]
    );
    roleWise.add(roles[i], roleCount[0].total);
  }

  console.log(roleWise);

  return [roleWise];
}

async function totalPendingFundRequests() {
  const [requests] = await db.query(
    "SELECT COUNT(*) as total FROM fund_request WHERE  status = ?",
    [userId, "pending"]
  );
  return requests[0].total;
}

async function updateNotificationStatus(userId, notificationId) {
  // Update notification
  if (notificationId) {
    await db.query(
      "UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    );
  } else {
    await db.query(
      "UPDATE notifications SET is_read = true WHERE user_id = ?",
      [userId]
    );
  }
}

async function createNotification(userId, title, message, type) {
  const [result] = await db.query(
    `INSERT INTO notifications (user_id, title, message, type, is_read) 
             VALUES (?, ?, ?, ?, ?)`,
    [userId, title, message, type, false]
  );

  return result;
}

async function getAppColor() {
  const [result] = await db.query(
    `select setting_value from settings where setting_name = "color"`
  );
  console.log(result);
  return result[0].setting_value;
}

// async function getReports(id) {
//  const [reports] = await db.query("SELECT * FROM bal_transactions WHERE user_id = ?", [id]);
//   return reports;
// }

async function createOperatorType({ name, description }) {
  const [result] = await db.query(
    "INSERT INTO operator_types (name, description) VALUES (?, ?)",
    [name, description]
  );
  return result.insertId;
}

async function getOperatorTypes({ status  }) {
  if(status === undefined) {
    const [rows] = await db.query("SELECT id, name ,description, status FROM operator_types");
    return rows;
  }
  
  const [rows] = await db.query(
    "SELECT id, name , status FROM operator_types WHERE status = ?",
    [status]
  );
  return rows;
}

async function getOperatorTypeByName(name) {
  const [rows] = await db.query(
    "SELECT id FROM operator_types WHERE name = ?",
    [name]
  );
  return rows[0];
}

async function updateOperatorType({ id, name, description, status = 'active' }) {
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
  // const [result] = await db.query(
  //   "DELETE FROM operator_types WHERE id = ?",
  //   [id]
  // );

  if (result.affectedRows === 0) {
    throw new Error("Operator type not found");
  }

  return { id };
}

async function getOperatorById(id) {
  const [rows] = await db.query("SELECT * FROM operators WHERE id = ?", [id]);
  return rows[0];
}
async function getKeywordById(id) {
  const [rows] = await db.query("SELECT * FROM keywords WHERE id = ?", [id]);
  return rows[0];
}


async function getOperatorByCode(code ,type) {
  const [rows] = await db.query("SELECT * FROM operators WHERE code = ? and type = ?", [code,type]);
  return rows[0];
}
async function deleteOperator(id) {
 const [result] = await db.query("update operators set status = 'inactive' WHERE id = ?", [id]);
 // const [result] = await db.query("DELETE FROM operators WHERE id = ?", [id]);
  return result;
}

async function updateOperator(
  id,
  {
    name,
    code,
    logo,
    type,
    min_digits,
    max_digits,
    gap,
    min_recharge,
    max_recharge,
    ret_flat_margin,
    ret_standard_margin,
    ret_cust_margin,
    dist_flat_margin,
    dist_standard_margin,
    dist_customised_margin,
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
  if (min_digits !== undefined) {
    updateFields.push("min_digits = ?");
    params.push(min_digits);
  }
  if (max_digits !== undefined) {
    updateFields.push("max_digits = ?");
    params.push(max_digits);
  }
  if (gap !== undefined) {
    updateFields.push("gap = ?");
    params.push(gap);
  }
  if (min_recharge !== undefined) {
    updateFields.push("min_recharge = ?");
    params.push(min_recharge);
  }
  if (max_recharge !== undefined) {
    updateFields.push("max_recharge = ?");
    params.push(max_recharge);
  }
  if (ret_flat_margin !== undefined) {
    updateFields.push("ret_flat_margin = ?");
    params.push(ret_flat_margin);
  }
  if (ret_standard_margin !== undefined) {
    updateFields.push("ret_standard_margin = ?");
    params.push(ret_standard_margin);
  }
  if (ret_cust_margin !== undefined) {
    updateFields.push("ret_cust_margin = ?");
    params.push(ret_cust_margin);
  }
  if (dist_flat_margin !== undefined) {
    updateFields.push("dist_flat_margin = ?");
    params.push(dist_flat_margin);
  }

  if (dist_standard_margin !== undefined) {
    updateFields.push("dist_standard_margin = ?");
    params.push(dist_standard_margin);
  }
  if (dist_customised_margin !== undefined) {
    updateFields.push("dist_customised_margin = ?");
    params.push(dist_customised_margin);
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
  logo,
  type,
  min_digits,
  max_digits,
  gap,
  min_recharge,
  max_recharge,
  ret_standard_margin,
  ret_cust_margin,
  dist_standard_margin,
  dist_cust_margin,
  mdist_standard_margin,
  mdist_cust_margin
}) {
  const [result] = await db.query(
    `INSERT INTO operators 
      (name, code, logo, type, min_digits, max_digits, gap, 
      min_recharge, max_recharge,  ret_standard_margin, 
      ret_cust_margin,  dist_standard_margin, 
      dist_cust_margin, mdist_standard_margin, mdist_cust_margin) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      code,
      logo,
      type,
      min_digits,
      max_digits,
      gap,
      min_recharge,
      max_recharge,
      ret_standard_margin,
      ret_cust_margin,
      dist_standard_margin,
      dist_cust_margin,
      mdist_standard_margin,
      mdist_cust_margin

    ]
  );
  return result.insertId;
}


// Database query function
async function getOperators({
  status,
  type,
  min_recharge,
  max_recharge,
  code
}) {
  let query = "SELECT  operators.id, operators.name, operators.code, operator_types.name as type, operators.logo, operators.min_digits, operators.max_digits, operators.gap, operators.min_recharge, operators.max_recharge,  operators.ret_standard_margin, operators.ret_cust_margin,  operators.dist_standard_margin, operators.dist_cust_margin, operators.mdist_standard_margin,  operators.mdist_cust_margin, operators.status as status FROM operators  INNER JOIN operator_types ON operators.type = operator_types.id";
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

  if (min_recharge) {
    conditions.push("min_recharge >= ?");
    params.push(min_recharge);
  }

  if (max_recharge) {
    conditions.push("max_recharge <= ?");
    params.push(max_recharge);
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
async function createApiProvider({
  name,
  base_url,
  username,
  password,
  api_key,
  balance_threshold,
  notification_email,
  auth_param_name1,
  auth_param_name2,
  auth_param_name3,
  auth_param_value1,
  auth_param_value2,
  auth_param_value3
}) {
  const query = `
      INSERT INTO api_providers 
      (name, base_url, username, password, 
      api_key, balance_threshold, notification_email,
      auth_param_name1, auth_param_name2, auth_param_name3,
      auth_param_value1, auth_param_value2, auth_param_value3) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await db.query(query, [
    name,
    base_url,
    username,
    password,
    api_key,
    balance_threshold,
    notification_email,
    auth_param_name1,
    auth_param_name2,
    auth_param_name3,
    auth_param_value1,
    auth_param_value2,
    auth_param_value3
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

async function getApiProviders({
  status,
  name,
  balance_threshold_min,
  balance_threshold_max
}) {
  let query = `SELECT * FROM api_providers WHERE 1=1`;
  const params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (name) {
    query += ` AND name LIKE ?`;
    params.push(`%${name}%`);
  }

  if (balance_threshold_min !== undefined) {
    query += ` AND balance_threshold >= ?`;
    params.push(balance_threshold_min);
  }

  if (balance_threshold_max !== undefined) {
    query += ` AND balance_threshold <= ?`;
    params.push(balance_threshold_max);
  }

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


async function getReports(userId, options = {}) {
  const {
    page = 1,
    limit = 10,
    to_id,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    status
  } = options;

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base query with user details
  let query = `
    SELECT 
      bt.id, 
      bt.user_id, 
      bt.to_id, 
      bt.amount, 
      bt.prev_balance,
      bt.new_balance,
      bt.maalik_prev_balance,
      bt.maalik_new_balance,
      bt.status, 
      bt.created_at,
      bt.remark,
      TO_USER.company AS to_company,
      TO_USER.person AS to_contact,
      TO_USER.mobile AS to_mobile,
      CASE 
        WHEN bt.amount < 0 THEN 'withdraw'
        ELSE  bt.transaction_type
      END AS transaction_type
    FROM bal_transactions bt
    LEFT JOIN users TO_USER ON bt.to_id = TO_USER.id
    WHERE bt.user_id = ?
  `;

  const queryParams = [userId];

  // To_id filter
  if (to_id) {
    query += ` AND bt.to_id = ?`;
    queryParams.push(to_id);
  }

  // Date range filter
  if (startDate && endDate) {
    query += ` AND bt.created_at BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  }

  // Amount range filter
  if (minAmount !== undefined) {
    query += ` AND bt.amount >= ?`;
    queryParams.push(minAmount);
  }
  if (maxAmount !== undefined) {
    query += ` AND bt.amount <= ?`;
    queryParams.push(maxAmount);
  }

  // Status filter
  if (status) {
    query += ` AND bt.status = ?`;
    queryParams.push(status);
  }

  // Add sorting and pagination
  query += ` 
    ORDER BY bt.created_at DESC 
    LIMIT ? OFFSET ?
  `;
  queryParams.push(limit, offset);

  // Count total records for pagination
  const countQuery = query
    .replace(/SELECT.*?FROM/s, "SELECT COUNT(*) as total FROM")
    .replace(/LIMIT.*OFFSET.*$/s, "");

  // Total of all 'success' transactions for provided filters (ignoring page/limit)
  let totalSuccessQuery = `
    SELECT 
      COUNT(*) as total_success,
      SUM(bt.amount) as total_success_amount
    FROM bal_transactions bt
    LEFT JOIN users TO_USER ON bt.to_id = TO_USER.id
    WHERE bt.user_id = ?
      AND bt.status = 'success'
  `;
  const totalSuccessParams = [userId];

  if (to_id) {
    totalSuccessQuery += ` AND bt.to_id = ?`;
    totalSuccessParams.push(to_id);
  }
  if (startDate && endDate) {
    totalSuccessQuery += ` AND bt.created_at BETWEEN ? AND ?`;
    totalSuccessParams.push(startDate, endDate);
  }
  if (minAmount !== undefined) {
    totalSuccessQuery += ` AND bt.amount >= ?`;
    totalSuccessParams.push(minAmount);
  }
  if (maxAmount !== undefined) {
    totalSuccessQuery += ` AND bt.amount <= ?`;
    totalSuccessParams.push(maxAmount);
  }
  // Do not filter by status here, as we want all 'success' regardless of the status filter

  const [reports] = await db.query(query, queryParams);
  const [countResult] = await db.query(countQuery, queryParams.slice(0, -2));
  const [successTotals] = await db.query(totalSuccessQuery, totalSuccessParams);
  console.log("Success Totals", successTotals);

  return {
    transactions: reports,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    },
    successTotals: {
      totalSuccess: successTotals[0]?.total_success || 0,
      totalSuccessAmount: successTotals[0]?.total_success_amount || 0
    }
  };
}

async function getStatement(userId, options = {}) {
  const {
    page = 1,
    limit = 10,
    to_id,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    status
  } = options;

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base query with user details

//   SELECT 
//   id, 
//   user_id, 
//   to_id, 
//   amount, 
//   created_at, 
//   transaction_type, 
//   status,
//   CASE 
//       WHEN user_id = ? THEN 'purchase' 
//       WHEN to_id = ? THEN 'transfer' 
//   END AS type
// FROM bal_transactions 
// WHERE user_id = ? OR to_id = ? 
// ORDER BY created_at DESC;
  // let query = `
  //   SELECT 
  //     bt.id, 
  //     bt.user_id, 
  //     bt.to_id, 
  //     bt.transaction_type, 
  //     bt.amount, 
  //     bt.prev_balance,
  //     bt.new_balance,
  //     bt.maalik_prev_balance,
  //     bt.maalik_new_balance,
  //     bt.status, 
  //     bt.created_at,
  //     bt.remark,
  //     TO_USER.company AS to_company,
  //     TO_USER.person AS to_contact,
  //     TO_USER.mobile AS to_mobile
  //     CASE 
  //       WHEN user_id = ? THEN 'transfer',
  //       WHEN to_id = ? THEN 'purchase' 
  //     END AS type
  //   FROM bal_transactions bt
  //   LEFT JOIN users TO_USER ON bt.to_id = TO_USER.id
  //   WHERE bt.user_id = ? OR bt.to_id = ?
  // `;
  let query = `
  SELECT 
    bt.id, 
    bt.user_id, 
    bt.to_id, 
    bt.transaction_type, 
    bt.amount, 
    bt.prev_balance,
    bt.new_balance,
    bt.maalik_prev_balance,
    bt.maalik_new_balance,
    bt.status, 
    bt.created_at,
    bt.remark,
    TO_USER.company AS to_company,
    TO_USER.person AS to_contact,
    TO_USER.mobile AS to_mobile,
    FROM_USER.company AS from_company,
    FROM_USER.person AS from_contact,
    FROM_USER.mobile AS from_mobile,
    CASE 
      WHEN bt.user_id = ? THEN 'transfer'
      WHEN bt.to_id = ? THEN 'purchase' 
    END AS type
  FROM bal_transactions bt
  LEFT JOIN users TO_USER ON bt.to_id = TO_USER.id
  LEFT JOIN users FROM_USER ON bt.user_id = FROM_USER.id
  WHERE bt.user_id = ? OR bt.to_id = ?
`;


  // WHERE bt.user_id = ?

  //const queryParams = [];
   const queryParams = [userId , userId , userId , userId];

  // To_id filter
  if (to_id) {
    query += ` AND bt.to_id = ?`;
    queryParams.push(to_id);
  }

  // Date range filter
  if (startDate && endDate) {
    query += ` AND bt.created_at BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  }

  // Amount range filter
  if (minAmount !== undefined) {
    query += ` AND bt.amount >= ?`;
    queryParams.push(minAmount);
  }
  if (maxAmount !== undefined) {
    query += ` AND bt.amount <= ?`;
    queryParams.push(maxAmount);
  }

  // Status filter
  if (status) {
    query += ` AND bt.status = ?`;
    queryParams.push(status);
  }

  // Add sorting and pagination
  query += ` 
    ORDER BY bt.created_at DESC 
    LIMIT ? OFFSET ?
  `;
  queryParams.push(limit, offset);

  // Count total records for pagination
  const countQuery = query
    .replace(/SELECT.*?FROM/s, "SELECT COUNT(*) as total FROM")
    .replace(/LIMIT.*OFFSET.*$/s, "");

  const [reports] = await db.query(query, queryParams);
  const [countResult] = await db.query(countQuery, queryParams.slice(0, -2));

  // // Transform transactions to include user details
  // const transformedReports = reports.map(report => ({
  //   ...report,
  // }));

  return {
    transactions: reports,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    }
  };
}

async function getBalanceReports(userId, options) {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    status,
    transactionType,
    userId: targetUserId
  } = options;

  const offset = (page - 1) * limit;
  
  let query = `
    SELECT 
      bt.*,
      u.person as user_name,
      u.mobile as user_mobile,
      u.company as user_company,
      tu.person as target_user_name,
      tu.mobile as target_user_mobile,
      tu.company as target_user_company
    FROM bal_transactions bt
    LEFT JOIN users u ON bt.user_id = u.id
    LEFT JOIN users tu ON bt.to_id = tu.id
    WHERE bt.user_id = ?
  `;

  const params = [userId];

  if (targetUserId) {
    query += ` AND bt.to_id = ?`;
    params.push(targetUserId);
  }

  if (startDate && endDate) {
    query += ` AND bt.created_at BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  if (minAmount) {
    query += ` AND bt.amount >= ?`;
    params.push(minAmount);
  }

  if (maxAmount) {
    query += ` AND bt.amount <= ?`;
    params.push(maxAmount);
  }

  if (status) {
    query += ` AND bt.status = ?`;
    params.push(status);
  }

  if (transactionType) {
    query += ` AND bt.transaction_type = ?`;
    params.push(transactionType);
  }

  // Add pagination
  query += ` ORDER BY bt.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Get total count
  const countQuery = query.replace(/SELECT.*?FROM/s, 'SELECT COUNT(*) as total FROM')
                         .replace(/ORDER BY.*$/s, '');
  
  const [rows] = await db.query(query, params);
  const [countResult] = await db.query(countQuery, params.slice(0, -2));

  return {
    transactions: rows,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    }
  };
}


// async function getRechargeReports( options) {
//   const {
//     page = 1,
//     limit = 20,
//     startDate,
//     endDate,
//     operatorType, // Matches with operators.type
//     keyword,
//     retailerNumber, // Match with users.mobile to find user_id
//     number, // Match with either recharges.account or recharges.number
//     apiProvider, // Match with recharge_gigs.provider_id
//     status,
//     transactionId,
//     minAmount,
//     maxAmount
//   } = options;

//   const offset = (page - 1) * limit;

//   // First, if retailerNumber is provided, get that user's ID
//   let targetUserId = null;
//   if (retailerNumber) {
//     const [retailerResult] = await db.query('SELECT id FROM users WHERE mobile = ?', [retailerNumber]);
//     if (retailerResult && retailerResult.length > 0) {
//       targetUserId = retailerResult[0].id;
//     } else {
//       // If no user found with that mobile, return empty result
//       return {
//         recharges: [],
//         pagination: {
//           page,
//           limit,
//           total: 0,
//           totalPages: 0
//         }
//       };
//     }
//   }

//   let query = `
//     SELECT 
//       r.*,
//       o.name as operator_name,
//       o.code as operator_code,
//       ot.name as operator_type_name,
//       k.description as keyword_name,
//       k.code as keyword_code,
//       u.person as user_name,
//       u.mobile as user_mobile,
//       u.company as user_company,
//       (
//         SELECT JSON_ARRAYAGG(
//           JSON_OBJECT(
//             'id', rg.id,
//             'status', rg.status,
//             'amount', rg.amount,
//             'request', rg.request,
//             'response', rg.response,
//             'message', rg.message,
//             'created_at', rg.created_at,
//             'updated_at', rg.updated_at,
//             'provider_name', ap.name
//           )
//         )
//         FROM recharge_gigs rg
//         LEFT JOIN api_providers ap ON rg.provider_id = ap.id
//         WHERE rg.rech_id = r.id
//       ) as gigs
//     FROM recharges r
//     LEFT JOIN keywords k ON r.keyword_id = k.id
//     LEFT JOIN operators o ON k.operator_id = o.id
//     LEFT JOIN operator_types ot ON o.type = ot.id
//     LEFT JOIN users u ON r.user_id = u.id
//     WHERE  1=1
//   `;

//   const params = [];

//   if(targetUserId){
//     query += ` AND r.user_id = ?`;
//     params.push(targetUserId);

//   }

//   // Add filters
//   if (startDate && endDate) {
//     query += ` AND r.created_at BETWEEN ? AND ?`;
//     params.push(startDate, endDate);
//   }

//   if (minAmount) {
//     query += ` AND r.amount >= ?`;
//     params.push(minAmount);
//   }

//   if (maxAmount) {
//     query += ` AND r.amount <= ?`;
//     params.push(maxAmount);
//   }

//   if (status) {
//     query += ` AND r.status = ?`;
//     params.push(status);
//   }

//   if (operatorType) {
//     query += ` AND o.type = ?`;
//     params.push(operatorType);
//   }

//   if (keyword) {
//     query += ` AND r.keyword_id = ?`;
//     params.push(keyword);
//   }

//   if (transactionId) {
//     query += ` AND r.txnid = ?`;
//     params.push(transactionId);
//   }

//   if (number) {
//     query += ` AND (r.number = ? OR r.account = ?)`;
//     params.push(number, number);
//   }

//   if (apiProvider) {
//     query += ` AND EXISTS (
//       SELECT 1 FROM recharge_gigs rg 
//       WHERE rg.rech_id = r.id AND rg.provider_id = ?
//     )`;
//     params.push(apiProvider);
//   }

//   // Add pagination
//   query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
//   params.push(limit, offset);

//   // Get total count
//   const countQuery = query.replace(/SELECT.*?FROM/s, 'SELECT COUNT(*) as total FROM')
//                           .replace(/ORDER BY.*$/s, '');

//   const [rows] = await db.query(query, params);
//   const [countResult] = await db.query(countQuery, params.slice(0, -2));

//   // Parse the JSON string of gigs into actual JavaScript objects
//   const formattedRows = rows.map(row => {
//     if (row.gigs) {
//       try {
//         row.gigs = JSON.parse(row.gigs);
//       } catch (e) {
//         row.gigs = [];
//       }
//     } else {
//       row.gigs = [];
//     }
//     return row;
//   });

//   return {
//     recharges: formattedRows,
//     pagination: {
//       page,
//       limit,
//       total: countResult[0].total,
//       totalPages: Math.ceil(countResult[0].total / limit)
//     }
//   };
// }

async function getRechargeReports(options) {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    operatorType,
    keyword,
    retailerNumber,
    number,
    apiProvider,
    status,
    transactionId,
    minAmount,
    maxAmount
  } = options;

  const offset = (page - 1) * limit;

  // First, if retailerNumber is provided, get that user's ID
  let targetUserId = null;
  if (retailerNumber) {
    const [retailerResult] = await db.query('SELECT id FROM users WHERE mobile = ?', [retailerNumber]);
    if (retailerResult && retailerResult.length > 0) {
      targetUserId = retailerResult[0].id;
    } else {
      // If no user found with that mobile, return empty result
      return {
        recharges: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        },
        totalAmount: 0
      };
    }
  }

  // Build the WHERE clause and params separately so we can reuse them
  let whereClause = ' WHERE 1=1';
  const params = [];

  if (targetUserId) {
    whereClause += ' AND r.user_id = ?';
    params.push(targetUserId);
  }

  // Add filters
  if (startDate && endDate) {
    whereClause += ' AND r.created_at BETWEEN ? AND ?';
    params.push(startDate, `${endDate} 23:59:59`);
  }

  if (minAmount) {
    whereClause += ' AND r.amount >= ?';
    params.push(minAmount);
  }

  if (maxAmount) {
    whereClause += ' AND r.amount <= ?';
    params.push(maxAmount);
  }

  if (status) {
    whereClause += ' AND r.status = ?';
    params.push(status);
  }

  if (operatorType) {
    whereClause += ' AND o.type = ?';
    params.push(operatorType);
  }

  if (keyword) {
    whereClause += ' AND r.keyword_id = ?';
    params.push(keyword);
  }

  if (transactionId) {
    whereClause += ' AND r.txnid = ?';
    params.push(transactionId);
  }

  if (number) {
    whereClause += ' AND (r.number = ? OR r.account = ?)';
    params.push(number, number);
  }

  if (apiProvider) {
    whereClause += ' AND EXISTS (SELECT 1 FROM recharge_gigs rg WHERE rg.rech_id = r.id AND rg.provider_id = ?)';
    params.push(apiProvider);
  }

  const joinClause = `
    FROM recharges r
    LEFT JOIN keywords k ON r.keyword_id = k.id
    LEFT JOIN operators o ON k.operator_id = o.id
    LEFT JOIN operator_types ot ON o.type = ot.id
    LEFT JOIN users u ON r.user_id = u.id
  `;

  // Count query to get total rows
  const countQuery = `SELECT COUNT(*) as total ${joinClause} ${whereClause}`;
  
  // Total amount query
  const totalAmountQuery = `SELECT SUM(r.amount) as totalAmount ${joinClause} ${whereClause}`;

  // Main query for fetching recharges without gigs first
  const mainQuery = `
    SELECT 
      r.*,
      o.name as operator_name,
      ot.name as operator_type_name,
      k.description as keyword_name,
      k.code as keyword_code,
      u.mobile as user_mobile,
      u.company as user_company
    ${joinClause}     
    ${whereClause}
    ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;

  // Execute the main, count, and totalAmount queries
  const mainParams = [...params ];
  const [rows] = await db.query(mainQuery, mainParams);
  const [countResult] = await db.query(countQuery, params);
  const [amountResult] = await db.query(totalAmountQuery, params);

  // If we have results, fetch gigs separately for each recharge
  if (rows.length > 0) {
    // Get all recharge IDs
    const rechargeIds = rows.map(row => row.id);
    
    // Fetch all gigs for these recharges in a single query
    const gigsQuery = `
      SELECT 
        rg.rech_id,
        rg.id,
        kl.description as line_name,
        rg.status,
        rg.amount,
        rg.prev_balance,
        rg.new_balance,
        rg.config as type,
        rg.request,
        rg.response,
        rg.message,
        rg.created_at,
        rg.updated_at,
        ap.name as provider_name
      FROM recharge_gigs rg
      LEFT JOIN api_providers ap ON rg.provider_id = ap.id
      Left JOIN keyword_lines kl ON rg.line_id = kl.id
      WHERE rg.rech_id IN (?)
    `;
    
    const [gigsRows] = await db.query(gigsQuery, [rechargeIds]);
    
    // Group gigs by recharge ID
    const gigsMap = {};
    gigsRows.forEach(gig => {
      if (!gigsMap[gig.rech_id]) {
        gigsMap[gig.rech_id] = [];
      }
      
      // Remove rech_id from the gig object before pushing
      const { rech_id, ...gigData } = gig;
      gigsMap[rech_id].push(gigData);
    });

    // Attach gigs to each recharge
    rows.forEach(row => {
      row.gigs = gigsMap[row.id] || [];
    });
  }

  return {
    recharges: rows,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    },
    totalAmount: amountResult[0]?.totalAmount || 0
  };
}

// Generic query builder utility
const buildQueryConditions = (fieldMap, dates) => {
  const conditions = [];
  const params = [];

  Object.entries(fieldMap).forEach(([key, [condition, value]]) => {
    if (value !== undefined) {
      conditions.push(condition);
      params.push(value);
    }
  });

  if (dates) {
    conditions.push("DATE(created_at) BETWEEN ? AND ?");
    params.push(dates[0], dates[1]);
  }

  return { conditions, params };
};

// Enhanced common factor definitions with column selection support
const commonFactors = {
  count: "COUNT(*) as total",
  list: "*",
  sum: "SUM(amount) as totalAmount, COUNT(*) as totalCount",
  select: (columns) => columns.join(", ") // New factor type for custom column selection
};

// Query functions for each table

// Fund Requests
async function fundRequests({
  factor,
  id,
  dates,
  columns = [],
  status,
  user_id
}) {
  // if (!commonFactors[factor]) throw new Error('Invalid factor specified');
  // Handle both string factors and column selection
  const selectClause =
    factor === "select"
      ? commonFactors.select(columns)
      : commonFactors[factor] || commonFactors.list;

  if (!selectClause) throw new Error("Invalid factor specified");

  const { conditions, params } = buildQueryConditions(
    {
      id: ["id = ?", id],
      status: ["status = ?", status],
      user_id: ["user_id = ?", user_id]
    },
    dates
  );

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";
  const query = `SELECT ${selectClause} FROM fund_request${whereClause}`;
  console.log(query);
  console.log(params);

  const [results] = await db.query(query, params);

  return factor === "sum"
    ? {
        totalAmount: results[0]?.totalAmount || 0,
        totalCount: results[0]?.totalCount || 0
      }
    : results;
}

// Balance Transactions
async function balTransactions({
  factor,
  columns = [],
  user_id,
  to_id,
  transaction_type,
  amount,
  status,
  reference_id,
  remark,
  dates
}) {
  // if (!commonFactors[factor]) throw new Error('Invalid factor specified');
  const selectClause =
    factor === "select"
      ? commonFactors.select(columns)
      : commonFactors[factor] || commonFactors.list;

  if (!selectClause) throw new Error("Invalid factor specified");

  const { conditions, params } = buildQueryConditions(
    {
      user_id: ["user_id = ?", user_id],
      to_id: ["to_id = ?", to_id],
      transaction_type: ["transaction_type = ?", transaction_type],
      amount: ["amount = ?", amount],
      status: ["status = ?", status],
      reference_id: ["reference_id = ?", reference_id],
      remark: ["remark = ?", remark]
    },
    dates
  );

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";
  const query = `SELECT ${selectClause} FROM bal_transactions${whereClause}`;

  const [results] = await db.query(query, params);
  return factor === "sum"
    ? {
        totalAmount: results[0]?.totalAmount || 0,
        totalCount: results[0]?.totalCount || 0
      }
    : results;
}

// Recharges
async function recharges({
  factor,
  columns = [],
  user_id,
  operator_id,
  mobile_number,
  amount,
  status,
  transaction_id,
  operator_ref_id,
  dates
}) {
  // if (!commonFactors[factor]) throw new Error("Invalid factor specified");
  const selectClause =
    factor === "select"
      ? commonFactors.select(columns)
      : commonFactors[factor] || commonFactors.list;

  if (!selectClause) throw new Error("Invalid factor specified");
  const { conditions, params } = buildQueryConditions(
    {
      user_id: ["user_id = ?", user_id],
      operator_id: ["operator_id = ?", operator_id],
      mobile_number: ["mobile_number = ?", mobile_number],
      amount: ["amount = ?", amount],
      status: ["status = ?", status],
      transaction_id: ["transaction_id = ?", transaction_id],
      operator_ref_id: ["operator_ref_id = ?", operator_ref_id]
    },
    dates
  );

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";
  const query = `SELECT ${selectClause} FROM recharges${whereClause}`;

  const [results] = await db.query(query, params);
  return factor === "sum"
    ? {
        totalAmount: results[0]?.totalAmount || 0,
        totalCount: results[0]?.totalCount || 0
      }
    : results;
}

// Transactions
async function transactions({
  factor,
  columns = [],
  user_id,
  amount,
  status,
  reference_id,
  payment_mode,
  dates
}) {
  // if (!commonFactors[factor]) throw new Error('Invalid factor specified');
  const selectClause =
    factor === "select"
      ? commonFactors.select(columns)
      : commonFactors[factor] || commonFactors.list;

  if (!selectClause) throw new Error("Invalid factor specified");

  const { conditions, params } = buildQueryConditions(
    {
      user_id: ["user_id = ?", user_id],
      amount: ["amount = ?", amount],
      status: ["status = ?", status],
      reference_id: ["reference_id = ?", reference_id],
      payment_mode: ["payment_mode = ?", payment_mode]
    },
    dates
  );

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";
  const query = `SELECT ${selectClause} FROM transactions${whereClause}`;

  const [results] = await db.query(query, params);
  return factor === "sum"
    ? {
        totalAmount: results[0]?.totalAmount || 0,
        totalCount: results[0]?.totalCount || 0
      }
    : results;
}

// Users
async function users({
  factor = "list",
  columns = [],
  id,
  mobile,
  role_id,
  parent_id,
  status,
  dates
}) {
  console.log("parent_id" + parent_id);
  const factors = {
    ...commonFactors,
    count: "COUNT(*) as total"
  };

  // if (!factors[factor]) throw new Error('Invalid factor specified');
  const selectClause =
    factor === "select"
      ? factors.select(columns)
      : factors[factor] || factors.list;

  if (!selectClause) throw new Error("Invalid factor specified");

  const { conditions, params } = buildQueryConditions(
    {
      id: ["id = ?", id],
      mobile: ["mobile = ?", mobile],
      role_id: ["role_id = ?", role_id],
      parent_id: ["parent_id = ?", parent_id],
      status: ["status = ?", status]
    },
    dates
  );

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";
  const query = `SELECT ${selectClause} FROM users${whereClause}`;
  console.log(query);

  const [results] = await db.query(query, params);
  return results[0];
}

// Notifications
async function notifications({
  factor = "list",
  columns = [],
  user_id,
  type,
  is_read,
  dates
}) {
  const factors = {
    ...commonFactors,
    list: "*",
    count: "COUNT(*) as total"
  };

  //  if (!factors[factor]) throw new Error('Invalid factor specified');
  const selectClause =
    factor === "select"
      ? factors.select(columns)
      : factors[factor] || factors.list;

  if (!selectClause) throw new Error("Invalid factor specified");

  if (!selectClause) throw new Error("Invalid factor specified");

  const { conditions, params } = buildQueryConditions(
    {
      user_id: ["user_id = ?", user_id],
      type: ["type = ?", type],
      is_read: ["is_read = ?", is_read]
    },
    dates
  );

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";
  const query = `SELECT ${selectClause} FROM notifications${whereClause}`;

  const [results] = await db.query(query, params);
  return results;
}



async function createApi({
  description,
  type,
  request_port,
  request_url_endpoint,
  request_type,
  request_params = {},
  headers = {},
  response_format_type,
  respone_keyword_1,
  respone_keyword_2,
  response_success_format,
  response_failure_format,
  cust_filter,
  response_filter,
  amt_filter,
  bal_filter,
  tid_filter,
  reqId_filter,
  retry_count,
  timeout_seconds,
  status = 'active'
}) {
  const query = `
      INSERT INTO apis 
      (description, type, request_port, request_url_endpoint, 
      request_type, request_params, headers, response_format_type,
      respone_keyword_1, respone_keyword_2,
      response_success_format, response_failure_format,
      cust_filter, response_filter, amt_filter,
      bal_filter, tid_filter, reqId_filter,
      retry_count, timeout_seconds, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await db.query(query, [
    description,
    type,
    request_port,
    request_url_endpoint,
    request_type,
    JSON.stringify(request_params),
    JSON.stringify(headers),
    response_format_type,
    respone_keyword_1,
    respone_keyword_2,
    response_success_format,
    response_failure_format,
    cust_filter,
    response_filter,
    amt_filter,
    bal_filter,
    tid_filter,
    reqId_filter,
    retry_count,
    timeout_seconds,
    status
  ]);

  return result;
}

async function getApis({ status, description, type, response_format_type }) {
  let query = `SELECT * FROM apis WHERE 1=1`;
  const params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (description) {
    query += ` AND description LIKE ?`;
    params.push(`%${description}%`);
  }

  if (type) {
    query += ` AND type = ?`;
    params.push(type.toLowerCase());
  }

  if (response_format_type) {
    query += ` AND response_format_type = ?`;
    params.push(response_format_type);
  }

  const [results] = await db.query(query, params);

  // Parse JSON fields
  return results.map((result) => ({
    ...result,
    request_params: result.request_params
      ? JSON.parse(result.request_params)
      : null,
    headers: result.headers ? JSON.parse(result.headers) : null
  }));
}

async function getApiById(id) {
  const [results] = await db.query("SELECT * FROM apis WHERE id = ?", [id]);

  if (!results[0]) return null;

  // Parse JSON fields
  const result = results[0];
  return {
    ...result,
    request_params: result.request_params
      ? JSON.parse(result.request_params)
      : null,
    headers: result.headers ? JSON.parse(result.headers) : null
  };
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

async function createKeyword({
  description,
  operator_id,
  provider,
  provider_code,
  api,
  additional_charges,
  is_additional_charges_fixed,
  priority,
  balance_check,
  balance_check_api,
  min_recharge,
  max_recharge,
  admin_margin,
  status = 'active'
}) {
  const query = `
      INSERT INTO keywords 
      (description, operator_id, provider, provider_code, api,
      additional_charges, is_additional_charges_fixed, priority,
      balance_check, balance_check_api, min_recharge,
      max_recharge, admin_margin, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await db.query(query, [
    description,
    operator_id,
    provider,
    provider_code,
    api,
    additional_charges,
    is_additional_charges_fixed,
    priority,
    balance_check,
    balance_check_api,
    min_recharge,
    max_recharge,
    admin_margin,
    status
  ]);

  return result;
}

async function getKeywords() {
  let query = `
    SELECT k.*, 
           o.name as operator_name,
           ap.name as provider_name,
           a.description as api_name,
           bca.description as balance_check_api_name
    FROM keywords k
    LEFT JOIN operators o ON k.operator_id = o.id
    LEFT JOIN api_providers ap ON k.provider = ap.id
    LEFT JOIN apis a ON k.api = a.id
    LEFT JOIN apis bca ON k.balance_check_api = bca.id
  `;
  
  

  const [results] = await db.query(query);
  console.log("results", results);
  return results;
}

async function getKeywordById(id) {
  const query = `
    SELECT k.*, 
           o.name as operator_name,
           ap.name as provider_name,
           a.description as api_name,
           bca.description as balance_check_api_name
    FROM keywords k
    LEFT JOIN operators o ON k.operator_id = o.id
    LEFT JOIN api_providers ap ON k.provider = ap.id
    LEFT JOIN apis a ON k.api = a.id
    LEFT JOIN apis bca ON k.balance_check_api = bca.id
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


async function getOperatorsList() {
 
      const [rows] = await db.query(
          "SELECT id, name FROM operators WHERE status = 'active' ORDER BY name"
      );
      
      return rows || [];
 
}

async function getApiProvidersList() {
 
      const [rows] = await db.query(
          "SELECT id, name FROM api_providers WHERE status = 'active' ORDER BY name"
      );
      return rows|| [];
  
}


async function getApisList() {
 
      const [rows] = await db.query(
          "SELECT id, description as name FROM apis WHERE status = 'active' ORDER BY description"
      );
      return rows|| [];
  
}


async function getAllEntities() {
 
      const [operators, apiProviders, apis] = await Promise.all([
          getOperatorsList(),
          getApiProvidersList(),
          getApisList()
      ]);

      return {
          operators,
          apiProviders,
          apis
      };
 
}




// queries.js (continued)

async function getCommissionReports(userId, options) {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    operatorId
  } = options;

  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      r.id,
      r.created_at,
      r.mobile_number,
      r.amount,
      r.status,
      r.commission_earned_retailer,
      r.commission_earned_distributor,
      o.name as operator_name,
      o.code as operator_code,
      u.person as user_name,
      u.mobile as user_mobile,
      u.company as user_company
    FROM recharges r
    LEFT JOIN operators o ON r.operator_id = o.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.user_id = ?
    AND (r.commission_earned_retailer > 0 OR r.commission_earned_distributor > 0)
    AND r.status = 'success'
  `;

  const params = [userId];

  if (startDate && endDate) {
    query += ` AND r.created_at BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  if (operatorId) {
    query += ` AND r.operator_id = ?`;
    params.push(operatorId);
  }

  // Add pagination
  query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Get total count
  const countQuery = query.replace(/SELECT.*?FROM/s, 'SELECT COUNT(*) as total FROM')
                         .replace(/ORDER BY.*$/s, '');

  const [rows] = await db.query(query, params);
  const [countResult] = await db.query(countQuery, params.slice(0, -2));

  // Calculate summary
  const summaryQuery = `
    SELECT 
      SUM(commission_earned_retailer) as total_retailer_commission,
      SUM(commission_earned_distributor) as total_distributor_commission,
      COUNT(*) as total_transactions
    FROM recharges
    WHERE user_id = ?
    AND status = 'success'
    ${startDate && endDate ? 'AND created_at BETWEEN ? AND ?' : ''}
    ${operatorId ? 'AND operator_id = ?' : ''}
  `;

  const summaryParams = [userId];
  if (startDate && endDate) summaryParams.push(startDate, endDate);
  if (operatorId) summaryParams.push(operatorId);

  const [summaryRows] = await db.query(summaryQuery, summaryParams);

  return {
    commissions: rows,
    summary: summaryRows[0],
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    }
  };
}

async function getUserPerformanceReports(options) {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    userId
  } = options;

  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      u.id,
      u.person,
      u.mobile,
      u.company,
      COUNT(r.id) as total_transactions,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_transactions,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed_transactions,
      SUM(r.amount) as total_amount,
      SUM(r.commission_earned_retailer) as total_commission_earned,
      AVG(r.amount) as average_transaction_amount,
      (SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) / COUNT(r.id) * 100) as success_rate
    FROM users u
    LEFT JOIN recharges r ON u.id = r.user_id
    WHERE u.parent_id = ?
  `;

  const params = [userId];

  if (startDate && endDate) {
    query += ` AND r.created_at BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  query += ` GROUP BY u.id, u.person, u.mobile, u.company`;
  query += ` ORDER BY total_transactions DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM users 
    WHERE parent_id = ?
  `;

  const [rows] = await db.query(query, params);
  const [countResult] = await db.query(countQuery, [userId]);

  return {
    performance: rows,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    }
  };
}

async function getAPIPerformanceReports(options) {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    apiId,
    status
  } = options;

  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      ra.id as api_id,
      ra.description as api_name,
      COUNT(ar.id) as total_requests,
      SUM(CASE WHEN ar.response_status = 'success' THEN 1 ELSE 0 END) as successful_requests,
      SUM(CASE WHEN ar.response_status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed_requests,
      AVG(ar.execution_time) as average_response_time,
      MIN(ar.execution_time) as min_response_time,
      MAX(ar.execution_time) as max_response_time,
      (SUM(CASE WHEN ar.response_status = 'success' THEN 1 ELSE 0 END) / COUNT(ar.id) * 100) as success_rate
    FROM recharge_apis ra
    LEFT JOIN api_requests ar ON ra.id = ar.recharge_api_id
    WHERE 1=1
  `;

  const params = [];

  if (startDate && endDate) {
    query += ` AND ar.date_time BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  if (apiId) {
    query += ` AND ra.id = ?`;
    params.push(apiId);
  }

  if (status) {
    query += ` AND ar.response_status = ?`;
    params.push(status);
  }

  query += ` GROUP BY ra.id, ra.description`;
  query += ` ORDER BY total_requests DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Get total count
  const countQuery = `SELECT COUNT(DISTINCT ra.id) as total FROM recharge_apis ra`;

  const [rows] = await db.query(query, params);
  const [countResult] = await db.query(countQuery);

  // Get detailed error breakdown
  const errorQuery = `
    SELECT 
      ra.id as api_id,
      ar.response_status,
      COUNT(*) as count
    FROM recharge_apis ra
    LEFT JOIN api_requests ar ON ra.id = ar.recharge_api_id
    WHERE ar.response_status = 'failed'
    ${startDate && endDate ? 'AND ar.date_time BETWEEN ? AND ?' : ''}
    ${apiId ? 'AND ra.id = ?' : ''}
    GROUP BY ra.id, ar.response_status
  `;

  const errorParams = [];
  if (startDate && endDate) errorParams.push(startDate, endDate);
  if (apiId) errorParams.push(apiId);

  const [errorRows] = await db.query(errorQuery, errorParams);

  return {
    performance: rows,
    errorBreakdown: errorRows,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    }
  };
}

// Additional utility query for getting aggregated statistics
async function getAggregatedStats(userId, startDate, endDate) {
  const query = `
    SELECT 
      COUNT(*) as total_transactions,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_transactions,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_transactions,
      SUM(amount) as total_amount,
      SUM(commission_earned_retailer + commission_earned_distributor) as total_commission,
      AVG(amount) as average_transaction_amount,
      (SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*) * 100) as success_rate
    FROM recharges
    WHERE user_id = ?
    AND created_at BETWEEN ? AND ?
  `;

  const [rows] = await db.query(query, [userId, startDate, endDate]);
  return rows[0];
}



async function getLiveRecharges({
    offset,
    limit,
    status,
    startDate,
    endDate
}) {
    let query = `
        SELECT 
            r.*,
            u.username as user_name,
            o.name as operator_name,
            ar.http_request,
            ar.http_response
        FROM recharges r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN operators o ON r.operator_id = o.id
        LEFT JOIN api_requests ar ON r.api_request_id = ar.id
        WHERE 1=1
    `;
    
    const params = [];

    if (status) {
        query += " AND r.status = ?";
        params.push(status);
    }
    
    if (startDate && endDate) {
        query += " AND r.created_at BETWEEN ? AND ?";
        params.push(startDate, endDate);
    }

    query += " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [recharges] = await db.query(query, params);
    return recharges;
}

async function processRechargeRefund(rechargeId, { adminId, remarks }) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Get recharge details
        const [[recharge]] = await connection.query(
            "SELECT * FROM recharges WHERE id = ?",
            [rechargeId]
        );

        if (!recharge) {
            throw new Error("Recharge not found");
        }

        // Update recharge status
        await connection.query(
            `UPDATE recharges 
             SET status = 'refunded', 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [rechargeId]
        );

        // Create refund transaction
        await connection.query(
            `INSERT INTO bal_transactions 
             (user_id, to_id, transaction_type, amount, status, 
              prev_balance, new_balance, reference_id, remark) 
             VALUES (?, ?, 'refund', ?, 'success', ?, ?, ?, ?)`,
            [
                adminId,
                recharge.user_id,
                recharge.deducted_amount,
                0, // prev_balance will be calculated
                0, // new_balance will be calculated
                `REF-${rechargeId}`,
                remarks
            ]
        );

        await connection.commit();
        return { success: true, message: "Refund processed successfully" };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function getApiPerformanceMetrics({
    startDate,
    endDate,
    apiId
}) {
    const query = `
        SELECT 
            ra.id,
            ra.description,
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN r.status = 'success' THEN 1 END) as successful_transactions,
            COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_transactions,
            AVG(ar.execution_time) as avg_response_time,
            MIN(ar.execution_time) as min_response_time,
            MAX(ar.execution_time) as max_response_time
        FROM recharge_apis ra
        LEFT JOIN recharges r ON r.api_id = ra.id
        LEFT JOIN api_requests ar ON r.api_request_id = ar.id
        WHERE 1=1
        ${apiId ? ' AND ra.id = ?' : ''}
        ${startDate && endDate ? ' AND r.created_at BETWEEN ? AND ?' : ''}
        GROUP BY ra.id
    `;

    const params = [];
    if (apiId) params.push(apiId);
    if (startDate && endDate) params.push(startDate, endDate);

    const [metrics] = await db.query(query, params);
    return metrics;
};

async function getUserTransactions({
  startDate,
  endDate,
  userId,
  transactionType,
  status,
  offset,
  limit
}) {
  let query = `
      SELECT 
          t.*,
          u.username,
          u.mobile,
          u.email
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
  `;
  
  const params = [];

  if (startDate && endDate) {
      query += " AND t.created_at BETWEEN ? AND ?";
      params.push(startDate, endDate);
  }

  if (userId) {
      query += " AND t.user_id = ?";
      params.push(userId);
  }

  if (transactionType) {
      query += " AND t.payment_mode = ?";
      params.push(transactionType);
  }

  if (status) {
      query += " AND t.status = ?";
      params.push(status);
  }

  query += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const [transactions] = await db.query(query, params);
  return transactions;
}

async function getDashboardSummary({ startDate, endDate }) {
  // Total transactions summary
  const [transactionSummary] = await db.query(`
      SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_transactions,
          SUM(CASE WHEN status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed_transactions,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_transactions,
          SUM(amount) as total_amount,
          SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as successful_amount
      FROM recharges
      WHERE created_at BETWEEN ? AND ?
  `, [startDate, endDate]);

  // User statistics
  const [userStats] = await db.query(`
      SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN created_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as new_users
      FROM users
      WHERE role = 'r'
  `, [startDate, endDate]);

  // Commission summary
  const [commissionSummary] = await db.query(`
      SELECT 
          SUM(commission_earned_retailer) as total_retailer_commission,
          SUM(commission_earned_distributor) as total_distributor_commission
      FROM recharges
      WHERE status = 'success' AND created_at BETWEEN ? AND ?
  `, [startDate, endDate]);

  // Operator-wise success rate
  const [operatorStats] = await db.query(`
      SELECT 
          o.name as operator_name,
          COUNT(*) as total_transactions,
          SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_transactions,
          (SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
      FROM recharges r
      JOIN operators o ON r.operator_id = o.id
      WHERE r.created_at BETWEEN ? AND ?
      GROUP BY o.id, o.name
  `, [startDate, endDate]);

  return {
      transactionSummary: transactionSummary[0],
      userStats: userStats[0],
      commissionSummary: commissionSummary[0],
      operatorStats
  };
}


async function getOperatorPerformance(role, userId, {
  startDate,
  endDate,
  keywordId,
  offset,
  limit
}) {
  let commissionField;
  // For admin/super admin (role 1 or 2), show admin commission
  if (role === 1 || role === 2) {
    commissionField = 'r.com_admin';
  } else if (role === 3) {
    // For master (role 3), commission can be from com_superparent or com_parent depending on which field matches the user's id
    commissionField = `
      CASE 
        WHEN r.superparent_id = ? THEN r.com_superparent
        WHEN r.parent_id = ? THEN r.com_parent
        ELSE 0
      END
    `;
  } else if (role === 4) {
    // For distributor (role 4), commission is from com_parent
    commissionField = 'r.com_parent';
  } else if (role === 5 || role === 6) {
    // For retailer (role 5/6), commission is from com_retailer
    commissionField = 'r.com_retailer';
  } else {
    commissionField = '0';
  }

  let query = `
    SELECT 
      o.description as keyword_name,
      o.code as keyword_code,
      COUNT(*) as total,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as total_amount,
      SUM(${commissionField}) as total_commission,
      (SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) as success_rate
    FROM keywords o
    LEFT JOIN recharges r ON o.id = r.keyword_id
    WHERE 1=1
  `;

  const params = [];

  // Add user filter based on role
  if (role === 3 && userId && userId !== 'all') {
    // For master, only include recharges where user is superparent or parent
    query += " AND (r.superparent_id = ? OR r.parent_id = ?)";
    params.push(userId, userId, userId, userId); // for commissionField CASE and filter
  } else if (role === 4 && userId && userId !== 'all') {
    // For distributor, only include recharges where user is parent
    query += " AND r.parent_id = ?";
    params.push(userId);
  } else if ((role === 5 || role === 6) && userId && userId !== 'all') {
    // For retailer, only include recharges where user is the retailer
    query += " AND r.user_id = ?";
    params.push(userId);
  }

  if (startDate && endDate) {
    query += " AND r.created_at BETWEEN ? AND ?";
    params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
  }

  if (keywordId) {
    query += " AND o.id = ?";
    params.push(keywordId);
  }

  query += ` GROUP BY o.id, o.description, o.code ORDER BY keyword_name DESC`;

  const [performance] = await db.query(query, params);

  // Calculate totals for all keywords
  let totalQuery = `
    SELECT 
      'ALL KEYWORDS' as keyword_name,
      '' as keyword_code,
      COUNT(*) as total,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as total_success_amount,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded'  THEN r.amount ELSE 0 END) as total_failed_amount,
      SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as total_pending_amount,
      SUM(r.amount) as total_amount,
      SUM(${commissionField}) as total_commission,
      (SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) as success_rate
    FROM keywords o
    LEFT JOIN recharges r ON o.id = r.keyword_id
    WHERE 1=1
  `;

  const totalParams = [];

  if (role === 3 && userId && userId !== 'all') {
    totalQuery += " AND (r.superparent_id = ? OR r.parent_id = ?)";
    totalParams.push(userId, userId, userId, userId);
  } else if (role === 4 && userId && userId !== 'all') {
    totalQuery += " AND r.parent_id = ?";
    totalParams.push(userId);
  } else if ((role === 5 || role === 6) && userId && userId !== 'all') {
    totalQuery += " AND r.user_id = ?";
    totalParams.push(userId);
  }

  if (startDate && endDate) {
    totalQuery += " AND r.created_at BETWEEN ? AND ?";
    totalParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
  }

  if (keywordId) {
    totalQuery += " AND o.id = ?";
    totalParams.push(keywordId);
  }

  const [totals] = await db.query(totalQuery, totalParams);

  return {
    keywords: performance,
    totals: totals[0] || {
      keyword_name: 'ALL KEYWORDS',
      keyword_code: '',
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      total_success_amount: 0,
      total_failed_amount: 0,
      total_pending_amount: 0,
      total_amount: 0,
      total_commission: 0,
      success_rate: 0
    }
  };
}
// async function getOperatorPerformance(role, userId, {
//   startDate,
//   endDate,
//   keywordId,
//   offset,
//   limit
// }) {
//   let commissionField;
//   console.log("role", role, "userId", userId, "startDate", startDate, "endDate", endDate, "keywordId", keywordId);

//   // Determine which commission field to use based on role
//   if (role === 1 || role === 2) {
//     commissionField = 'r.com_admin';
//   } else if (role === 3) {
//     commissionField = 'COALESCE(r.com_superparent, r.com_parent, 0)';
//   } else if (role === 4) {
//     commissionField = 'r.com_parent';
//   } else if (role === 5 || role === 6) {
//     commissionField = 'r.com_retailer';
//   } else {
//     commissionField = '0';
//   }

//   let query = `
//     SELECT 
//       o.description as keyword_name,
//       o.code as keyword_code,
//       COUNT(*) as total,
//       SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful,
//       SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed,
//       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending,
//       SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as total_amount,
//       SUM(${commissionField}) as total_commission,
//       (SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) as success_rate
//     FROM keywords o
//     LEFT JOIN recharges r ON o.id = r.keyword_id
//     WHERE 1=1
//   `;

//   const params = [];

//   // Add user filter based on role
//   if (role >= 3 && userId && userId !== 'all') {
//     if (role === 3) {
//       // For role 3 (super parent), filter by superparent_id OR parent_id
//       query += " AND (r.superparent_id = ? OR r.parent_id = ?)";
//       params.push(userId, userId);
//     } else if (role === 4) {
//       // For role 4 (parent), filter by parent_id
//       query += " AND r.parent_id = ?";
//       params.push(userId);
//     } else if (role === 5 || role === 6) {
//       // For role 5 & 6 (retailers), filter by user_id
//       query += " AND r.user_id = ?";
//       params.push(userId);
//     }
//   }

//   if (startDate && endDate) {
//     query += " AND r.created_at BETWEEN ? AND ?";
//     params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
//   }

//   if (keywordId) {
//     console.log("keywordId exists", keywordId);
//     query += " AND o.id = ?";
//     params.push(keywordId);
//   }

//   // Group by clause for individual keywords
//   query += `GROUP BY o.id, o.description, o.code ORDER BY keyword_name DESC`;

//   const [performance] = await db.query(query, params);
  
//   // Calculate totals for all keywords
//   let totalQuery = `
//     SELECT 
//       'ALL KEYWORDS' as keyword_name,
//       '' as keyword_code,
//       COUNT(*) as total,
//       SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful,
//       SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed,
//       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending,
//       SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as total_success_amount,
//       SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END) as total_failed_amount,
//       SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as total_pending_amount,
//       SUM(r.amount) as total_amount,
//       SUM(${commissionField}) as total_commission,
//       (SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) as success_rate
//     FROM keywords o
//     LEFT JOIN recharges r ON o.id = r.keyword_id
//     WHERE 1=1
//   `;

//   const totalParams = [];

//   if (startDate && endDate) {
//     totalQuery += " AND r.created_at BETWEEN ? AND ?";
//     totalParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
//   }

//   if (keywordId) {
//     totalQuery += " AND o.id = ?";
//     totalParams.push(keywordId);
//   }
  
//   // Add user filter based on role for totals query
//   if (role >= 3 && userId && userId !== 'all') {
//     if (role === 3) {
//       // For role 3 (super parent), filter by superparent_id OR parent_id
//       totalQuery += " AND (r.superparent_id = ? OR r.parent_id = ?)";
//       totalParams.push(userId, userId);
//     } else if (role === 4) {
//       // For role 4 (parent), filter by parent_id
//       totalQuery += " AND r.parent_id = ?";
//       totalParams.push(userId);
//     } else if (role === 5 || role === 6) {
//       // For role 5 & 6 (retailers), filter by user_id
//       totalQuery += " AND r.user_id = ?";
//       totalParams.push(userId);
//     }
//   }

//   const [totals] = await db.query(totalQuery, totalParams);
  
//   // Return both individual keyword performance and totals
//   return {
//     keywords: performance,
//     totals: totals[0] || {
//       keyword_name: 'ALL KEYWORDS',
//       keyword_code: '',
//       total: 0,
//       successful: 0,
//       failed: 0,
//       pending: 0,
//       total_success_amount: 0,
//       total_failed_amount: 0,
//       total_pending_amount: 0,
//       total_amount: 0,
//       total_commission: 0,
//       success_rate: 0
//     }
//   };
// }



async function getUsers(userRole, role = null, {
  page = 1,
  limit = 20,
  mobile,
  person,
  company,
  margin_type,
  parent_mobile,
  parent_name,
  parent_company
}) {
  const offset = (page - 1) * limit;
  let params = [];

  let query = `
    SELECT 
      u.id, 
      u.person, 
      u.mobile, 
      u.company, 
      u.margin_type, 
      u.margin_rates, 
      u.balance, 
      u.status, 
      u.role_id,
      u.created_at,
      r.description as role,
      p.id as parent_id,
      p.person as parent_name,
      p.mobile as parent_mobile,
      p.company as parent_company,
      p.role_id as parent_role_id,
      COALESCE(SUM(CASE WHEN rg.status = 'success' AND MONTH(rg.created_at) = MONTH(CURRENT_DATE()) AND YEAR(rg.created_at) = YEAR(CURRENT_DATE()) THEN rg.amount ELSE 0 END), 0) as total_recharge_amount,
      COUNT(CASE WHEN rg.status = 'success' AND MONTH(rg.created_at) = MONTH(CURRENT_DATE()) AND YEAR(rg.created_at) = YEAR(CURRENT_DATE()) THEN rg.id ELSE NULL END) as total_recharges,
      COALESCE(SUM(CASE WHEN rg.status = 'success' AND DATE(rg.created_at) = CURRENT_DATE() THEN rg.amount ELSE 0 END), 0) as today_recharge_amount,
      COUNT(CASE WHEN rg.status = 'success' AND DATE(rg.created_at) = CURRENT_DATE() THEN rg.id ELSE NULL END) as today_recharges
    FROM 
      users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN users p ON u.parent_id = p.id
    LEFT JOIN recharges rg ON rg.user_id = u.id
  `;

  // Build WHERE clause conditionally
  const whereConditions = [];

  // If userRole is 2, only fetch users with role_id > 2
  if (userRole === 2) {
    whereConditions.push(`u.role_id > 2`);
  }

  // User-level filters
  if (role !== null) {
    whereConditions.push(`u.role_id = ?`);
    params.push(role);
  }

  if (mobile) {
    whereConditions.push(`u.mobile LIKE ?`);
    params.push(`%${mobile}%`);
  }

  if (person) {
    whereConditions.push(`u.person = ?`);
    params.push(person);
  }

  if (company) {
    whereConditions.push(`u.company = ?`);
    params.push(company);
  }

  if (margin_type) {
    whereConditions.push(`u.margin_type = ?`);
    params.push(margin_type);
  }

  // Parent-level filters
  if (parent_mobile) {
    whereConditions.push(`p.mobile LIKE ?`);
    params.push(`%${parent_mobile}%`);
  }

  if (parent_name) {
    whereConditions.push(`p.person = ?`);
    params.push(parent_name);
  }

  if (parent_company) {
    whereConditions.push(`p.company = ?`);
    params.push(parent_company);
  }

  // Add WHERE clause if there are any conditions
  if (whereConditions.length > 0) {
    query += ` WHERE ${whereConditions.join(' AND ')}`;
  }

  // Group by user to aggregate recharge data
  query += ` GROUP BY u.id`;

  // Add sorting and pagination - alphabetical order by person name then company
  query += ` ORDER BY u.person ASC, u.company ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Count total records for pagination
  // Build a count query that counts distinct users, not joined rows
  const countQuery = `
    SELECT COUNT(DISTINCT u.id) as total
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN users p ON u.parent_id = p.id
    ${whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''}
  `;

  console.log("countQuery", countQuery);

  const [users] = await db.query(query, params);
  const [countResult] = await db.query(countQuery, params.slice(0, -2));
  
  // Build totalBalance query with the same filtering logic
  let totalBalanceQuery = `
    SELECT SUM(u.balance) as total_balance
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN users p ON u.parent_id = p.id
  `;
  
  // Apply the same WHERE conditions as the main query
  if (whereConditions.length > 0) {
    totalBalanceQuery += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  
  const [totalBalance] = await db.query(totalBalanceQuery, params.slice(0, -2));


  return {
    users: users,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    },
    totalBalance: totalBalance[0].total_balance || 0
  };
}


module.exports = {
  db, getLatestImageNews,
  getAllUsers,
getStatement,
  getUserDetails,
  findUserByUsername,
  findUserByMobile,
  findUserById,
  createUser,
  createUserLog,
  removeUserToken,
  validateToken,
  updatePassword,
  getBalance,
  createFundRequest,
  getFundRequests,
  updateFundRequestStatus,
  getTransactions,
  initiateRecharge,
  getRechargeStatus,
  getRechargeHistory,
  retryRecharge,
  listOperators,
  registerReseller,
  getOrGenerateApiKey,
  whitelistIp,
  getResellerTransactions,
  getFundRequestsParent,
  getFundRequestbyId,
  addBalance,
  deductBalance,
  getBalanceReport,
  addBalanceTransaction,
  getAllowedFunctionalities,
  getTotalUsers,
  getTotalUserUnderMe,
  totalPendingFundRequests,
  fundRequests,
  recharges,
  transactions,
  balTransactions,
  users,
  notifications,
  updateNotificationStatus,
  createNotification,
  getLatestNews,
  getAppColor,
  getUsersbyParentId,
  getReports,
  updateUser,
  createOperatorType,
  getOperatorTypes,
  createOperator,
  getOperators,
  updateOperator,
  getOperatorById,
  createApiProvider,
  getApiProviders,
  getApiProviderById,
  updateApiProvider,
  createKeyword,
  getKeywords,
  getKeywordById,
  updateKeyword,
  deleteKeyword,
  getBalanceReports,
  getRechargeReports,
  getCommissionReports,
  getUserPerformanceReports,
  getAPIPerformanceReports,
  getAggregatedStats,
  getUserTransactions,
  getDashboardSummary,
  getOperatorPerformance,
  getLiveRecharges,
  processRechargeRefund,
  getApiPerformanceMetrics,
  updateOperatorType,
  deleteOperatorType,
  getOperatorTypeByName,
  deleteOperator,
  getOperatorPerformance,
  getOperatorById,
  createApi,
  getApis,
  getApiById,
  updateApi,
  checkOperatorExists,
  checkApiProviderExists,
  checkApiExists,
  getOperatorsList,
  getApiProvidersList,
  getApisList,
  getAllEntities,


getAlert,

getKeywordById,
  getUsers,
  getOperatorByCode,
  getAPiProvidersByUrl,
  getAPiProvidersByName,
  getUserToken,
  createOrder,
  getUsersbyParentIdForSuperAdmin



};
