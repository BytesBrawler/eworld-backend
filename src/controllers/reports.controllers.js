const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const querys = require("../db//reports.queries.js");
const query = require("../db/queries.js");
const { getRoleAccess } = require("./general.controller");
const db = require("../db/index.js");

const getHistory= asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, mobileNumber,accountNumber, startDate, endDate, minAmount, maxAmount, status, operatorId , forId} = req.query;
  console.log("query",req.query);

  if (page < 1 || limit < 1) {
    throw new ApiError(400, "Invalid page or limit value");
  }

  let user = req.user.id;
  if(forId){
    user = forId;
    // if(req.user.role > 2){
    //   throw new ApiError(403, "Not authorized to access user transactions");
    // }
    //chnage it to access for parents only


    const users = await query.users({ id: forId });
    if (!users) throw new ApiError(404, "User not found");

  
  }

  if (minAmount && maxAmount && minAmount > maxAmount) {
    throw new ApiError(400, "Invalid amount range");
  }

  if (mobileNumber && isNaN(mobileNumber)) { 
    throw new ApiError(400, "Invalid mobile number");
  }


  // Validate and parse query parameters
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    mobile: mobileNumber ? mobileNumber : undefined,
    accountNumber: mobileNumber ? accountNumber : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : undefined,
    // endDate: endDate ? new Date(endDate) : undefined,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    status,
    operatorId: operatorId ? operatorId : undefined,
  };

  // Fetch reports
  const { transactions, pagination ,  totalSuccessAmount } = await querys.getHistory(
   user,
    options
  );
  console.log(transactions);
  console.log(pagination);

  // Return successful response with pagination
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        transactions,
        pagination,  totalSuccessAmount
      },
      "Transactions fetched successfully"
    )
  );

});

const getPurchases = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    id,
    minAmount,
    maxAmount,
    status,
    transactionType,
    type,
    number
  } = req.query;


  let userId = req.user.id;

  if(id){
    console.log("id -- ",id);
    const user = await query.users({ id: id });
    if (!user) throw new ApiError(404, "User not found");
    userId = user.id;
  }

  if(number){
    console.log("number -- ",number);
    const user = await query.users({ mobile: number });
    if (!user) throw new ApiError(404, "User not found");
    userId = user.id;
  }

  console.log("userId -- ",userId);



  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : undefined,
    // endDate: endDate ? new Date(endDate) : undefined,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    status,
    transactionType,
    type
  };
  console.log(options);



  const reports = await querys.getPurchasesReports(userId, options);
  return res
    .status(200)
    .json(new ApiResponse(200, reports, "Reports fetched successfully"));
});

const getPurchasesOnline = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    mobileNumber,
    minAmount,
    maxAmount,
    status,
  } = req.query;
  console.log("query",req.query);



  let userId = req.user.id;


let user;
if(mobileNumber){
  user = await query.users({ mobile: mobileNumber });
  if (!user) throw new ApiError(404, "User not found");
}

  // if(id){
  //   console.log("id -- ",id);
  //   const user = await query.users({ id: id });
  //   if (!user) throw new ApiError(404, "User not found");
  //   userId = user.id;
  // }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : undefined,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    status,
    transactionType: 'offline',
    userId: mobileNumber ? user.id : undefined
  };
  console.log(options);



  const reports = await querys.getPurchasesReportsOnline( options);
  console.log("reports",reports);
  return res
    .status(200)
    .json(new ApiResponse(200, reports, "Reports fetched successfully"));
});



const getRecents = asyncHandler(async (req, res) => {
  // Fetch reports
  const recents = await querys.getRecents(
    req.user.id,
    req.user.role
  );
  

  // Return successful response with pagination
  return res.status(200).json(
    new ApiResponse(
      200,
    recents,
      "Transactions fetched successfully"
    )
  );
});


const getRechargeHistory = asyncHandler(async (req, res) => {
  const ids = req.query.id;
  const id = parseInt(ids, 10);
  const user = await query.findUserById(id);
  
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  
  // Extract filter parameters from request
  const { 
    startDate, 
    endDate, 
    status, 
    operatorId, 
    keyword,
    minAmount,
    maxAmount,
    number,
    account,
    limit = 10,
    page = 1,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = req.query;

  console.log("query",req.query);
  
  // Validate and parse query parameters
  const options = {
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : undefined,
    status,
    operatorId,
    keyword,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    number,
    account,
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    sortBy,
    sortOrder
  };
  
  const role = user.role_id;
  
  // Fetch reports with pagination and filters
  const { recharges, total , summary } = await querys.getEarnings(
    id,
    role,
    options
  );

console.log("total",total);
  
  
  // Pagination metadata
  const pagination = {
    current_page: parseInt(page),
    per_page: parseInt(limit),
    total_pages: Math.ceil(total / parseInt(limit)),
    total_records: total
  };
  
  // Return successful response with pagination
  return res.status(200).json(
    new ApiResponse(
      200,
      { summary, recharges, pagination },
      "Transactions fetched successfully"
    )
  );
});




  



// const getRechargeHistry = asyncHandler(async (req, res) => {
//   const id = req.query.id;

//   const user = await query.findUserById(id);

//   if (!user) {
//     throw new ApiError(404, "User not found");
//   }

//   // var isParent = await getRoleAccess(
//   //   req.user.role,
//   //   user.role_id,
//   //   req.user.id,
//   //   user.parent_id
//   // );
//   // if (!isParent) {
//   //   throw new ApiError(403, "Not authorized to access user transactions");
//   // }




//   // Validate and parse query parameters
//   const options = {


//     // userNumber: userNumber ? user.id : undefined,
//     // startDate: startDate ? new Date(startDate) : undefined,
//     // endDate: endDate ? new Date(endDate) : undefined,
//     // operator: operatorId ? operatorId : undefined,
    
//   };
//   const role = user.role_id;

//   // Fetch reports
//   const recharges = await querys.getEarnings(
//     id,
//     role,
//     options
//   );

//   // Calculate total earnings
//   if (recharges.length > 0) {
//     totalEarnings = recharges.reduce((sum, recharge) => sum + parseFloat(recharge.earnings || 0), 0);
//   }
  
//   // Get summary information
//   const summary = {
//     total_recharges: recharges.length,
//     total_earnings: parseFloat(totalEarnings.toFixed(2)),
//     successful_recharges: recharges.filter(r => r.status === 'success').length,
//     failed_recharges: recharges.filter(r => r.status === 'failed').length,
//     pending_recharges: recharges.filter(r => r.status === 'pending').length,
//     // period: {
//     //   start_date: firstDay,
//     //   end_date: lastDay.split(' ')[0]
//     // }
//   };


//   // Return successful response with pagination
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//      { summary,recharges},
//       "Transactions fetched successfully"
//     )
//   );

// });




const getTransactions = asyncHandler(async (req, res) => {
  const { number } = req.query;
  const user = await query.users({ mobile: number });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  var isParent = await getRoleAccess(
    req.user.role,
    user.role_id,
    req.user.id,
    user.parent_id
  );
  if (isParent) {
    const transactions = await query.getTransactions(user.id);
    res
      .status(200)
      .json(
        new ApiResponse(200, transactions, "Transactions fetched successfully")
      );
  } else {
    throw new ApiError(403, "Not authorized to access user transactions");
  }
});

// Controller Function
const getReports = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    mobileNumber,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    parentId,
    status
  } = req.query;
  console.log(req.query);
  if (page < 1 || limit < 1) {
    throw new ApiError(400, "Invalid page or limit value");
  }

  if (minAmount && maxAmount && minAmount > maxAmount) {
    throw new ApiError(400, "Invalid amount range");
  }

  if (mobileNumber && isNaN(mobileNumber)) {
    throw new ApiError(400, "Invalid mobile number");
  }

  let user;
  if (mobileNumber) {
    user = await query.users({ mobile: mobileNumber });
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    var isParent = await getRoleAccess(
      req.user.role,
      user.role_id,
      req.user.id,
      user.parent_id
    );
    if (!isParent) {
      throw new ApiError(403, "Not authorized to access user Reports");
    }
  }

  let parents = req.user.id;
  if(parentId){
    parent = await query.users({ id: parentId });
    if (!parent) {
      throw new ApiError(404, "User not found");
    }
    console.log("parent",parent);
    parents = parent.id;
  }

  // Validate and parse query parameters
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    to_id: mobileNumber ? user.id : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    status
  };

  // Fetch reports
  const { transactions, pagination ,successTotals} = await query.getReports(
   parents,
    options
  );
  console.log(transactions);
  console.log(pagination);

  // Return successful response with pagination
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        transactions,
        pagination,successTotals
      },
      "Transactions fetched successfully"
    )
  );
});


const getStatement = asyncHandler(async (req, res) => {
  const userId = 5;
  const userRole = 5;
  
  // const userId = req.user.id;
  // const userRole = req.user.role_id;
  
  // Extract query parameters for filtering
  const {
    startDate,
    endDate,
    type, // 'all', 'recharge', 'balance_transfer', 'fund_request'
    status, // 'success', 'pending', 'failed'
    page = 1,
    limit = 50
  } = req.query;

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Build date filter
  let dateFilter = '';
  if (startDate && endDate) {
    dateFilter = `AND DATE(created_at) BETWEEN '${startDate}' AND '${endDate}'`;
  } else if (startDate) {
    dateFilter = `AND DATE(created_at) >= '${startDate}'`;
  } else if (endDate) {
    dateFilter = `AND DATE(created_at) <= '${endDate}'`;
  }

  try {
    // Get user details first
    const userQuery = `
      SELECT u.*, r.role as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `;
    const userResult = await db.query(userQuery, [userId]);
    
    if (!userResult || userResult.length === 0) {
      throw new ApiError(404, "User not found");
    }
    
    const user = userResult[0];

    // Build the main statement query based on user role
    let statementQuery = '';
    let countQuery = '';
    let queryParams = [];

    // For retailers - only their own transactions
    if (userRole === 5) { // retailer role_id = 5
      statementQuery = `
        (
          SELECT 
            'recharge' as transaction_type,
            r.id as transaction_id,
            r.account as account_number,
            r.number as mobile_number,
            r.amount as original_amount,
            r.deducted_amount as amount,
            r.com_retailer as commission,
            NULL as previous_balance,
            NULL as new_balance,
            NULL as transfer_to_user,
            NULL as transfer_to_mobile,
            r.status,
            r.message,
            k.description as keyword_name,
            o.name as operator_name,
            r.created_at,
            r.updated_at
          FROM recharges r
          JOIN keywords k ON r.keyword_id = k.id
          JOIN operators o ON k.operator_id = o.id
          WHERE r.user_id = ?
          ${dateFilter.replace('created_at', 'r.created_at')}
          ${type === 'recharge' ? '' : type === 'balance_transfer' ? 'AND 1=0' : ''}
          ${status ? `AND r.status = '${status}'` : ''}
        )
        UNION ALL
        (
          SELECT 
            'balance_transfer' as transaction_type,
            bt.id as transaction_id,
            NULL as account_number,
            NULL as mobile_number,
            bt.original_amount as original_amount,
            bt.amount as amount,
            NULL as commission,
            bt.prev_balance as previous_balance,
            bt.new_balance as new_balance,
            CASE 
              WHEN bt.user_id = ? THEN CONCAT(u_to.person, ' (', u_to.mobile, ')')
              ELSE CONCAT(u_from.person, ' (', u_from.mobile, ')')
            END as transfer_to_user,
            CASE 
              WHEN bt.user_id = ? THEN u_to.mobile
              ELSE u_from.mobile
            END as transfer_to_mobile,
            bt.status,
            bt.remark as message,
            'eWallet' as keyword_name,
            CASE 
              WHEN bt.user_id = ? THEN 'Balance Transfer (Sent)'
              ELSE 'Balance Transfer (Received)'
            END as operator_name,
            bt.created_at,
            bt.updated_at
          FROM bal_transactions bt
          LEFT JOIN users u_to ON bt.to_id = u_to.id
          LEFT JOIN users u_from ON bt.user_id = u_from.id
          WHERE (bt.user_id = ? OR bt.to_id = ?)
          ${dateFilter.replace('created_at', 'bt.created_at')}
          ${type === 'balance_transfer' ? '' : type === 'recharge' ? 'AND 1=0' : ''}
          ${status ? `AND bt.status = '${status}'` : ''}
        )
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT r.id FROM recharges r WHERE r.user_id = ? 
          ${dateFilter.replace('created_at', 'r.created_at')}
          ${type === 'recharge' ? '' : type === 'balance_transfer' ? 'AND 1=0' : ''}
          ${status ? `AND r.status = '${status}'` : ''}
          UNION ALL
          SELECT bt.id FROM bal_transactions bt WHERE (bt.user_id = ? OR bt.to_id = ?)
          ${dateFilter.replace('created_at', 'bt.created_at')}
          ${type === 'balance_transfer' ? '' : type === 'recharge' ? 'AND 1=0' : ''}
          ${status ? `AND bt.status = '${status}'` : ''}
        ) as combined
      `;

      queryParams = [userId, userId, userId, userId, userId, userId, parseInt(limit), offset];
      
    } else {
      // For distributors and master distributors - include their downline transactions
      statementQuery = `
        (
          SELECT 
            'recharge' as transaction_type,
            r.id as transaction_id,
            r.account as account_number,
            r.number as mobile_number,
            r.amount as original_amount,
            r.deducted_amount as amount,
            CASE 
              WHEN r.user_id = ? THEN r.com_retailer
              WHEN r.parent_id = ? THEN r.com_parent
              WHEN r.superparent_id = ? THEN r.com_superparent
              ELSE 0
            END as commission,
            NULL as previous_balance,
            NULL as new_balance,
            CASE 
              WHEN r.user_id = ? THEN 'Self'
              ELSE CONCAT(u.person, ' (', u.mobile, ')')
            END as transfer_to_user,
            CASE 
              WHEN r.user_id = ? THEN r.number
              ELSE u.mobile
            END as transfer_to_mobile,
            r.status,
            r.message,
            k.description as keyword_name,
            o.name as operator_name,
            r.created_at,
            r.updated_at
          FROM recharges r
          JOIN users u ON r.user_id = u.id
          JOIN keywords k ON r.keyword_id = k.id
          JOIN operators o ON k.operator_id = o.id
          WHERE (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)
          ${dateFilter.replace('created_at', 'r.created_at')}
          ${type === 'recharge' ? '' : type === 'balance_transfer' ? 'AND 1=0' : ''}
          ${status ? `AND r.status = '${status}'` : ''}
        )
        UNION ALL
        (
          SELECT 
            'balance_transfer' as transaction_type,
            bt.id as transaction_id,
            NULL as account_number,
            NULL as mobile_number,
            bt.original_amount as original_amount,
            bt.amount as amount,
            NULL as commission,
            bt.prev_balance as previous_balance,
            bt.new_balance as new_balance,
            CASE 
              WHEN bt.user_id = ? THEN CONCAT(u_to.person, ' (', u_to.mobile, ')')
              ELSE CONCAT(u_from.person, ' (', u_from.mobile, ')')
            END as transfer_to_user,
            CASE 
              WHEN bt.user_id = ? THEN u_to.mobile
              ELSE u_from.mobile
            END as transfer_to_mobile,
            bt.status,
            bt.remark as message,
            'eWallet' as keyword_name,
            CASE 
              WHEN bt.user_id = ? THEN 'Balance Transfer (Sent)'
              ELSE 'Balance Transfer (Received)'
            END as operator_name,
            bt.created_at,
            bt.updated_at
          FROM bal_transactions bt
          LEFT JOIN users u_to ON bt.to_id = u_to.id
          LEFT JOIN users u_from ON bt.user_id = u_from.id
          WHERE (bt.user_id = ? OR bt.to_id = ?)
          ${dateFilter.replace('created_at', 'bt.created_at')}
          ${type === 'balance_transfer' ? '' : type === 'recharge' ? 'AND 1=0' : ''}
          ${status ? `AND bt.status = '${status}'` : ''}
        )
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT r.id FROM recharges r 
          WHERE (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)
          ${dateFilter.replace('created_at', 'r.created_at')}
          ${type === 'recharge' ? '' : type === 'balance_transfer' ? 'AND 1=0' : ''}
          ${status ? `AND r.status = '${status}'` : ''}
          UNION ALL
          SELECT bt.id FROM bal_transactions bt 
          WHERE (bt.user_id = ? OR bt.to_id = ?)
          ${dateFilter.replace('created_at', 'bt.created_at')}
          ${type === 'balance_transfer' ? '' : type === 'recharge' ? 'AND 1=0' : ''}
          ${status ? `AND bt.status = '${status}'` : ''}
        ) as combined
      `;

      queryParams = [
        userId, userId, userId, userId, userId, userId, userId, userId, // recharge params
        userId, userId, userId, userId, userId, // balance transfer params
        parseInt(limit), offset
      ];
    }

    // Execute the main query and count query
    const [statements, countResult] = await Promise.all([
      db.query(statementQuery, queryParams),
      db.query(countQuery, userRole === 5 ? 
        [userId, userId, userId] : 
        [userId, userId, userId, userId, userId]
      )
    ]);

    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // Calculate summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(CASE WHEN transaction_type = 'recharge' AND status = 'success' THEN 1 END) as successful_recharges,
        COUNT(CASE WHEN transaction_type = 'recharge' AND status = 'pending' THEN 1 END) as pending_recharges,
        COUNT(CASE WHEN transaction_type = 'recharge' AND status = 'failed' OR r.status = 'refunded' THEN 1 END) as failed_recharges,
        COUNT(CASE WHEN transaction_type = 'balance_transfer' AND status = 'success' THEN 1 END) as successful_transfers,
        COALESCE(SUM(CASE WHEN transaction_type = 'recharge' AND status = 'success' THEN amount ELSE 0 END), 0) as total_recharge_amount,
        COALESCE(SUM(CASE WHEN transaction_type = 'balance_transfer' AND status = 'success' THEN amount ELSE 0 END), 0) as total_transfer_amount,
        COALESCE(SUM(CASE WHEN commission IS NOT NULL THEN commission ELSE 0 END), 0) as total_commission
      FROM (${statementQuery.replace('LIMIT ? OFFSET ?', '')}) as summary_data
    `;

    const summaryParams = queryParams.slice(0, -2); // Remove limit and offset
    const summaryResult = await db.query(summaryQuery, summaryParams);
    const summary = summaryResult[0];

    // Format the response
    const response = {
      user: {
        id: user.id,
        name: user.person,
        mobile: user.mobile,
        role: user.role_name,
        current_balance: user.balance,
        company: user.company
      },
      summary: {
        total_records: totalRecords,
        successful_recharges: summary.successful_recharges,
        pending_recharges: summary.pending_recharges,
        failed_recharges: summary.failed_recharges,
        successful_transfers: summary.successful_transfers,
        total_recharge_amount: parseFloat(summary.total_recharge_amount),
        total_transfer_amount: parseFloat(summary.total_transfer_amount),
        total_commission_earned: parseFloat(summary.total_commission)
      },
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: totalRecords,
        per_page: parseInt(limit)
      },
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        type: type || 'all',
        status: status || 'all'
      },
      transactions: statements.map(stmt => ({
        transaction_type: stmt.transaction_type,
        transaction_id: stmt.transaction_id,
        account_number: stmt.account_number,
        mobile_number: stmt.mobile_number,
        original_amount: parseFloat(stmt.original_amount || 0),
        amount: parseFloat(stmt.amount),
        commission: parseFloat(stmt.commission || 0),
        previous_balance: parseFloat(stmt.previous_balance || 0),
        new_balance: parseFloat(stmt.new_balance || 0),
        transfer_details: {
          to_user: stmt.transfer_to_user,
          to_mobile: stmt.transfer_to_mobile
        },
        status: stmt.status,
        message: stmt.message,
        service_details: {
          keyword_name: stmt.keyword_name,
          operator_name: stmt.operator_name
        },
        timestamps: {
          created_at: stmt.created_at,
          updated_at: stmt.updated_at
        }
      }))
    };

    return res
      .status(200)
      .json(new ApiResponse(200, response, "Statement fetched successfully"));

  } catch (error) {
    console.error('Statement API Error:', error);
    throw new ApiError(500, `Failed to fetch statement: ${error.message}`);
  }
});




module.exports = {
  getHistory,
  getPurchases,
  getRecents,
  getStatement,
getRechargeHistory,
getPurchasesOnline,



  getTransactions,
  getReports,
 

};
