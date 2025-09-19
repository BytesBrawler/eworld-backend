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


// Helper function to safely parse balance values and handle "-" or null values
function safeParseBalance(value) {
  if (value === null || value === undefined || value === '' || value === '-') {
    return 0;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

// (Old calculateRunningBalances function removed - replaced with calculateRunningBalancesCorrect)

const getStatement = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role_id;
  
  const {
    startDate,
    endDate,
    type = 'all',
    status = 'all',
    page = 1,
    limit = 50
  } = req.query;

  console.log('Statement API:', { userId, userRole, startDate, endDate, type, status, page, limit });

  try {
    // Get user info
    const [userResult] = await db.query('SELECT balance, person, mobile FROM users WHERE id = ?', [userId]);
    if (!userResult || userResult.length === 0) {
      throw new ApiError(404, "User not found");
    }
    const user = userResult[0];

    // Build filter conditions
    let dateWhere = '';
    let typeWhere = '';
    let statusWhere = '';
    const filterParams = [];

    if (startDate && endDate) {
      dateWhere = `AND DATE(created_at) BETWEEN ? AND ?`;
      filterParams.push(startDate, endDate);
    }

    if (status !== 'all') {
      statusWhere = `AND status = ?`;
      filterParams.push(status);
    }

    let rechargeQuery = '';
    let balanceQuery = '';
    let unionQuery = '';

    // Build recharge query based on type filter
    if (type === 'all' || type === 'recharge') {
      rechargeQuery = `
        SELECT 
          'recharge' as transaction_type,
          r.id as transaction_id,
          r.user_id,
          NULL as to_id,
          r.number as mobile_number,
          r.account as account_number,
          r.amount as original_amount,
          r.deducted_amount as final_amount,
          r.com_retailer,
          r.com_parent,
          r.com_superparent,
          r.com_admin,
          r.user_prev_balance as old_balance,
          r.user_new_balance as new_balance,
          r.parent_id,
          r.superparent_id,
          r.status,
          r.message,
          r.txnid,
          r.reqid,
          CONCAT(COALESCE(k.description, 'Service'), ' - ', COALESCE(o.name, 'Operator')) as service_name,
          r.created_at,
          r.updated_at
        FROM recharges r
        LEFT JOIN keywords k ON r.keyword_id = k.id
        LEFT JOIN operators o ON k.operator_id = o.id
        WHERE (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)
        ${dateWhere} ${statusWhere}
      `;
    }

    // Build balance transfer query based on type filter
    if (type === 'all' || type === 'balance_transfer') {
      balanceQuery = `
        SELECT 
          'balance_transfer' as transaction_type,
          bt.id as transaction_id,
          bt.user_id,
          bt.to_id,
          CASE 
            WHEN bt.user_id = ? THEN COALESCE(u_to.mobile, 'N/A')
            ELSE COALESCE(u_from.mobile, 'N/A')
          END as mobile_number,
          NULL as account_number,
          bt.original_amount as original_amount,
          bt.amount as final_amount,
          0 as com_retailer,
          0 as com_parent,
          0 as com_superparent,
          0 as com_admin,
          CASE 
            WHEN bt.user_id = ? THEN bt.Maalik_prev_balance
            WHEN bt.to_id = ? THEN bt.prev_balance
            ELSE NULL
          END as old_balance,
          CASE 
            WHEN bt.user_id = ? THEN bt.Maalik_new_balance
            WHEN bt.to_id = ? THEN bt.new_balance
            ELSE NULL
          END as new_balance,
          NULL as parent_id,
          NULL as superparent_id,
          bt.status,
          CONCAT('Transfer ', 
            CASE 
              WHEN bt.user_id = ? THEN CONCAT('to ', COALESCE(u_to.person, 'Unknown'))
              ELSE CONCAT('from ', COALESCE(u_from.person, 'Unknown'))
            END,
            CASE WHEN bt.remark IS NOT NULL THEN CONCAT(' - ', bt.remark) ELSE '' END
          ) as message,
          CONCAT('TXN', bt.id) as txnid,
          bt.id as reqid,
          'Balance Transfer' as service_name,
          bt.created_at,
          bt.updated_at
        FROM bal_transactions bt
        LEFT JOIN users u_to ON bt.to_id = u_to.id
        LEFT JOIN users u_from ON bt.user_id = u_from.id
        WHERE (bt.user_id = ? OR bt.to_id = ?)
        ${dateWhere} ${statusWhere}
      `;
    }

    // Combine queries with UNION if both types are needed
    if (rechargeQuery && balanceQuery) {
      unionQuery = `(${rechargeQuery}) UNION ALL (${balanceQuery}) ORDER BY created_at DESC`;
    } else if (rechargeQuery) {
      unionQuery = `${rechargeQuery} ORDER BY created_at DESC`;
    } else if (balanceQuery) {
      unionQuery = `${balanceQuery} ORDER BY created_at DESC`;
    } else {
      throw new ApiError(400, "Invalid transaction type");
    }

    // Build parameters array
    let queryParams = [];
    
    // Add parameters for recharge query
    if (rechargeQuery) {
      queryParams.push(userId, userId, userId); // user filter
      queryParams.push(...filterParams); // date and status filters
    }
    
    // Add parameters for balance transfer query  
    if (balanceQuery) {
      queryParams.push(userId); // mobile number logic
      queryParams.push(userId, userId); // old balance logic
      queryParams.push(userId, userId); // new balance logic
      queryParams.push(userId); // message logic
      queryParams.push(userId, userId); // user filter
      queryParams.push(...filterParams); // date and status filters
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${unionQuery}) as counted`;
    const [countResult] = await db.query(countQuery, queryParams);
    const totalRecords = countResult[0]?.total || 0;

    // Get paginated results
    const offset = (page - 1) * limit;
    const paginatedQuery = `${unionQuery} LIMIT ? OFFSET ?`;
    const [transactions] = await db.query(paginatedQuery, [...queryParams, parseInt(limit), offset]);

    console.log(`Found ${transactions.length} transactions out of ${totalRecords} total`);

    // Process transactions using STORED balances directly
    const processedTransactions = transactions.map(txn => {
      // Use the ACTUAL stored balances from database - NO CALCULATION
      const previousBalance = parseFloat(txn.old_balance || 0);
      const newBalance = parseFloat(txn.new_balance || 0);
      
      // Calculate transaction effect and commission based on your logic
      let transactionEffect = 0;
      let commission = 0;

      if (txn.transaction_type === 'recharge') {
        if (userRole === 5) { // Retailer
          if (txn.user_id === userId) {
            transactionEffect = -parseFloat(txn.final_amount || 0);
            commission = parseFloat(txn.com_retailer || 0);
          }
        } else { // Distributor, Master, Admin, Super Admin  
          if (txn.user_id === userId) {
            // Their own recharge
            transactionEffect = -parseFloat(txn.final_amount || 0);
          } else if (txn.parent_id === userId) {
            // Commission from direct child
            commission = parseFloat(txn.com_parent || 0);
            transactionEffect = commission;
          } else if (txn.superparent_id === userId) {
            // Commission from grandchild
            commission = parseFloat(txn.com_superparent || 0);
            transactionEffect = commission;
          } else {
            // Admin commission
            commission = parseFloat(txn.com_admin || 0);
            transactionEffect = commission;
          }
        }
      } else if (txn.transaction_type === 'balance_transfer') {
        if (txn.to_id === userId) {
          // Receiving transfer
          transactionEffect = parseFloat(txn.final_amount || 0);
        } else if (txn.user_id === userId) {
          // Sending transfer
          transactionEffect = -parseFloat(txn.final_amount || 0);
        }
      }

      return {
        transaction_type: txn.transaction_type || '',
        transaction_id: txn.transaction_id?.toString() || '',
        account_number: txn.account_number || null,
        mobile_number: txn.mobile_number || null,
        original_amount: parseFloat(txn.original_amount || 0),
        amount:userRole < 5? parseFloat(txn.final_amount || 0) : 0,
        commission: commission,
        previous_balance: previousBalance,
        new_balance: newBalance,
        transaction_effect: parseFloat(transactionEffect.toFixed(2)),
        transfer_details: {
          to_user: txn.message || '',
          to_mobile: txn.mobile_number || ''
        },
        status: txn.status || '',
        message: txn.message || '',
        txnid: txn.txnid || '',
        reqid: txn.reqid?.toString() || '',
        service_details: {
          keyword_name: txn.service_name || '',
          operator_name: txn.service_name || '',
          operator_image: null,
          keyword_id: null,
          operator_id: null
        },
        display_type: txn.transaction_type || '',
        timestamps: {
          created_at: txn.created_at,
          updated_at: txn.updated_at
        }
      };
    });

    // Calculate summary
    const summary = {
      total_records: totalRecords,
      successful_recharges: processedTransactions.filter(t => 
        t.transaction_type === 'recharge' && t.status === 'success').length,
      pending_recharges: processedTransactions.filter(t => 
        t.transaction_type === 'recharge' && t.status === 'pending').length,
      failed_recharges: processedTransactions.filter(t => 
        t.transaction_type === 'recharge' && (t.status === 'failed' || t.status === 'refunded')).length,
      successful_transfers: processedTransactions.filter(t => 
        t.transaction_type === 'balance_transfer' && t.status === 'success').length,
      total_recharge_amount: processedTransactions
        .filter(t => t.transaction_type === 'recharge' && t.status === 'success')
        .reduce((sum, t) => sum + t.amount, 0),
      total_transfer_amount: processedTransactions
        .filter(t => t.transaction_type === 'balance_transfer' && t.status === 'success')
        .reduce((sum, t) => sum + t.amount, 0),
      total_commission_earned: processedTransactions
        .reduce((sum, t) => sum + t.commission, 0)
    };

    const response = {
      user: {
        id: userId,
        name: user.person || '',
        mobile: user.mobile || '',
        role: userRole,
        current_balance: parseFloat(user.balance || 0)
      },
      summary,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalRecords / limit),
        total_records: totalRecords,
        per_page: parseInt(limit)
      },
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        type,
        status
      },
      transactions: processedTransactions
    };

    console.log('API Success:', { 
      user: response.user.name, 
      transactions: response.transactions.length,
      totalRecords 
    });

    return res.status(200).json(new ApiResponse(200, response, "Statement fetched successfully"));

  } catch (error) {
    console.error('Statement API Error:', error);
    throw new ApiError(500, `Failed to fetch statement: ${error.message}`);
  }
});

// Corrected balance calculation function following exact user specifications
// Removed calculateRunningBalancesCorrect function - now using stored database balances directly




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
