const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries");
const { get } = require("../app");

const getProfile = asyncHandler(async (req, res) => {
  // const {id} = req.params;
  const id = req.user.id;
  const user = await query.users({ id });
  // const  user = await query.findUserById(id);
  if (!user) throw new ApiError(404, "User not found");
  if (user.length === 0) throw new ApiError(400, "No user available");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "fetched successfully"));
});

const getSearch = asyncHandler(async (req, res) => {
  const { search , type } = req.query;
  console.log(req.query);

  // Log values to verify what's being used in the query
  console.log("User ID (req.user.id):", req.user.id);
  console.log("Search term:", search);

  if(type==="admin"){
     // Log the exact SQL query that would be executed
  const sqlQuery = `
    SELECT 
      u.id, 
      u.mobile, 
      u.role_id, 
      u.person, 
      u.company, 
      u.balance,
      p.person AS parent_name,
      p.company AS parent_shop
    FROM users u
    LEFT JOIN users p ON u.parent_id = p.id
    WHERE u.mobile LIKE ?
  `;
  const params = [`%${search}%`];
  console.log("SQL Query:", sqlQuery);
  console.log("Parameters:", params);
  
  // Execute the query
  const [users] = await query.db.query(sqlQuery, params);
  
  // Log results
  console.log("Query results:", users);
  console.log("Results length:", users ? users.length : 0);
  // console.log("user id is " + JSON.stringify(req.user.id));
//   console.log(req.query);
//   const [users] = await query.db.query(
//     "SELECT mobile, role_id, person, company FROM users WHERE parent_id = ? AND mobile LIKE ?",
//     [req.user.id, `%${search}%`]
// );
  console.log(users);
  if (!users) throw new ApiError(500, "Internal server error");

  return res
    .status(200)
    .json(new ApiResponse(200, users, "fetched successfully"));

  }
  
  // Log the exact SQL query that would be executed
  const sqlQuery = "SELECT id, mobile, role_id, person, company , balance FROM users WHERE parent_id = ? AND mobile LIKE ?";
  const params = [req.user.id, `%${search}%`];
  console.log("SQL Query:", sqlQuery);
  console.log("Parameters:", params);
  
  // Execute the query
  const [users] = await query.db.query(sqlQuery, params);
  
  // Log results
  console.log("Query results:", users);
  console.log("Results length:", users ? users.length : 0);
  // console.log("user id is " + JSON.stringify(req.user.id));
//   console.log(req.query);
//   const [users] = await query.db.query(
//     "SELECT mobile, role_id, person, company FROM users WHERE parent_id = ? AND mobile LIKE ?",
//     [req.user.id, `%${search}%`]
// );
  console.log(users);
  if (!users) throw new ApiError(500, "Internal server error");

  return res
    .status(200)
    .json(new ApiResponse(200, users, "fetched successfully"));
});

const findUser = asyncHandler(async (req, res) => {
  // const {id} = req.params;
  const { mobile, id, name } = req.query;
  let user;

  if (mobile) {
    user = await query.users({ mobile });
  } else if (id) {
    user = await query.users({ id });
  } else if (name) {
    user = await query.users({ username: name });
    // user = await query.findUserByUsername(name);
  }

  // const user = await query.findUserByMobile(mobile);
  if (!user) throw new ApiError(404, "User not found");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "fetched successfully"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await query.users();
  console.log(users);
  if (!users) throw new ApiError(500, "Internal server error");
  if (users.length === 0) throw new ApiError(400, "No user available");
  // if(users.length === 0) return res.status(202).json(new ApiResponse(202, users, "No user available"));
  return res
    .status(201)
    .json(new ApiResponse(200, users, "fetched successfully"));
  //     if(!users) return new ApiError(500 , "Internal server error");
  //     if(users.length === 0) return new ApiResponse(400 , users , "NO user available" , );
  //    return new ApiResponse(200 , users , "fetched successfully" , );
});


const getUsersbyParentId = asyncHandler(async (req, res) => {
  const { role_id, parent } = req.query;

  console.log(req.query);
  // const parent_id = 7;
  let parent_id;
  if (parent) {
    parent_id = parent;
  } else {
    parent_id = req.user.id;
  }
  console.log(parent_id);
  let users;
  console.log("uper id is " + req.user.role);

  if(req.user.role === 1) {
    if(parent){
 users = await query.getUsersbyParentIdForSuperAdmin(role_id, parent_id);
    }else{
  users = await query.getUsersbyParentIdForSuperAdmin(role_id);
    }
   
  }else{
    users = await query.getUsersbyParentId(role_id, parent_id);
  }
  
  // For each user in the users array, if the user's role is less than 5,
  // calculate the total balance of their direct children grouped by role.
  // For example:
  // - If user role is 3, sum balances of children with roles 4 and 5, grouped by role.
  // - If user role is 2, sum balances of children with role 3.
  // - If user role is 4, sum balances of children with role 5.

  // Assuming users is an array of user objects with at least { id, role_id }
  // and you have a function to get children by parent_id and role.

  // const roleChildrenMap = {
  //   2: [3],
  //   3: [4, 5],
  //   4: [5]
  //   // Add more mappings if needed
  // };

  // // Helper to get children balances for a user
  // async function getChildrenBalances(parentId, childRoles) {
  //   if (!childRoles || childRoles.length === 0) return {};
  //   // Query all children with parent_id and role in childRoles
  //   const placeholders = childRoles.map(() => '?').join(',');
  //   const sql = `
  //     SELECT role_id, SUM(balance) as total_balance
  //     FROM users
  //     WHERE parent_id = ? AND role_id IN (${placeholders})
  //     GROUP BY role_id
  //   `;
  //   const params = [parentId, ...childRoles];
  //   const [rows] = await query.db.query(sql, params);
  //   // Map role_id to total_balance
  //   const result = {};
  //   rows.forEach(row => {
  //     result[row.role_id] = row.total_balance;
  //   });
  //   return result;
  // }

  // // Attach children balances to each user
  // for (const user of users) {
  //   const userRole = user.role_id;
  //   if (userRole < 5 && roleChildrenMap[userRole]) {
  //     user.childrenBalances = await getChildrenBalances(user.id, roleChildrenMap[userRole]);
  //   }
  // }


  //await delay(500);
  console.log(users);
  if (!users) throw new ApiError(500, "Internal server error");
  if (users.length === 0)
    return res
      .status(200)
      .json(new ApiResponse(400, [], "fetched successfully"));
  return res
    .status(200)
    .json(new ApiResponse(200, users, "fetched successfully"));
});


const getUsers = asyncHandler(async (req, res) => {
  console.log("api calling");
  
  let { 
    role = null, 
    mobile, 
    person, 
    company, 
    page = 1, 
    limit = 50,
    parent_mobile,
    parent_name,
    parent_company,
    margin_type,
  } = req.query;

  console.log(req.query);

  // Validate page and limit
  if (page < 1 || limit < 1) {
    throw new ApiError(400, "Invalid page or limit value");
  }

  // Convert role to integer if provided
  role = role !== null ? parseInt(role) : null;



const userRole = req.user.role;


 const { users, pagination , totalBalance} = await query.getUsers( userRole,role, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    mobile,
    person,
    company,
    parent_mobile,
    parent_name,
    parent_company,
    margin_type
  });

   console.log(pagination);
   console.log(users);

  if (!users) throw new ApiError(500, "Internal server error");
  if (users.length === 0) throw new ApiError(400, "No user available");

  return res
    .status(200)
    .json(new ApiResponse(200, { users, pages: pagination, totalBalance }, "fetched successfully"));
});

const updateWallet = asyncHandler(async (req, res) => {
  const { id, isWalletAllowed } = req.body;
  console.log(req.body);
  const [update] = await query.db.query(
    "UPDATE users SET isWalletAllowed = ? WHERE id = ?",
    [isWalletAllowed, id]
  );
  console.log(update);
  return res
    .status(200)
    .json(new ApiResponse(200, update.affectedRows, "Updated successfully"));
});

const updateMarginStatus = asyncHandler(async (req, res) => {
  const { id, isMarginStatus} = req.body;
  console.log(req.body);
  const [update] = await query.db.query(
    "UPDATE users SET marginAllowed = ? WHERE id = ?",
    [isMarginStatus, id]
  );
  console.log(update);
  return res
    .status(200)
    .json(new ApiResponse(200, update.affectedRows, "Updated successfully"));
});

const updateStatus = asyncHandler(async (req, res) => {
  const { id, status} = req.body;
  console.log(req.body);
  const [update] = await query.db.query(
    "UPDATE users SET status = ? WHERE id = ?",
    [status, id]
  );
  console.log(update);
  return res
    .status(200)
    .json(new ApiResponse(200, update.affectedRows, "Updated successfully"));
});



// const getUsers = asyncHandler(async (req, res) => {
//     console.log("api calling");
//   let { role = null, mobile, person, company, page = 1, limit = 50 } = req.query;
//   if (page < 1 || limit < 1) {
//     throw new ApiError(400, "Invalid page or limit value");
//   }


//   // if (!role) throw new ApiError(400, "Role is required");
//   // role = parseInt(role);

//   role =role !== null ? parseInt(role) : null;


//   const {users, pagination } = await query.getUsers(role, {
//     page: parseInt(page, 10),
//     limit: parseInt(limit, 10),
//     mobile,
//     person,
//     company
//   });
//     console.log(pagination);
//     console.log(users);
//   console.log(users);
//   if (!users) throw new ApiError(500, "Internal server error");
//   if (users.length === 0) throw new ApiError(400, "No user available");
//   return res
//     .status(200)
//     .json(new ApiResponse(200, {users , pages : pagination}, "fetched successfully"));
// });

module.exports = {
  getProfile,
  getSearch,
  findUser,
  getAllUsers,
  getUsersbyParentId,
  getUsers,
  updateWallet,
  updateMarginStatus,
  updateStatus,
  getSearch
};
