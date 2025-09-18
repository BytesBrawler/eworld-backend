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
  const userRole = req.user.role_id; // Use role_id instead of role
  
  console.log('=== Statement API Called ===');
  console.log('User ID:', userId, 'Role:', userRole);
  
  const {
    startDate,
    endDate,
    type = 'all', // 'all', 'recharge', 'balance_transfer'
    status = 'all', // 'all', 'success', 'pending', 'failed'
    page = 1,
    limit = 50
  } = req.query;

  console.log('Query Params:', { startDate, endDate, type, status, page, limit });

  try {
    // Get user details and current balance
    const [userResult] = await db.query(`
      SELECT u.balance, u.person, u.mobile, r.role as role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [userId]);
    
    if (!userResult || userResult.length === 0) {
      throw new ApiError(404, "User not found");
    }
    
    const user = userResult[0];
    const currentBalance = parseFloat(user.balance || 0);
    
    console.log('User found:', { balance: currentBalance, name: user.person });

    // Build filters
    let dateCondition = '';
    let typeCondition = '';
    let statusCondition = '';
    let queryParams = [];

    if (startDate && endDate) {
      dateCondition = `AND DATE(created_at) BETWEEN ? AND ?`;
      queryParams.push(startDate, endDate);
    }

    if (type !== 'all') {
      if (type === 'recharge') {
        typeCondition = `AND transaction_type = 'recharge'`;
      } else if (type === 'balance_transfer') {
        typeCondition = `AND transaction_type = 'balance_transfer'`;
      }
    }

    if (status !== 'all') {
      statusCondition = `AND status = ?`;
      queryParams.push(status);
    }

    // Unified query with consistent field mapping
    const baseQuery = `
      SELECT * FROM (
        -- Recharge transactions with unified structure
        SELECT 
          'recharge' as transaction_type,
          r.id as transaction_id,
          r.user_id,
          NULL as to_id,
          r.number as mobile_number,
          r.account as account_number,
          r.amount as original_amount,
          r.deducted_amount as pay_amount,
          r.deducted_amount as final_amount,
          CASE 
            WHEN r.user_id = ? THEN r.com_retailer
            WHEN r.parent_id = ? THEN r.com_parent  
            WHEN r.superparent_id = ? THEN r.com_superparent
            ELSE r.com_admin
          END as commission,
          r.user_prev_balance as stored_old_balance,
          r.user_new_balance as stored_new_balance,
          r.parent_id,
          r.superparent_id,
          r.com_parent,
          r.com_superparent,
          r.com_admin,
          r.status,
          r.message as description,
          r.txnid,
          r.reqid as reference_id,
          CONCAT(COALESCE(k.description, 'Unknown'), ' - ', COALESCE(o.name, 'Unknown')) as service_name,
          r.created_at,
          r.updated_at
        FROM recharges r
        LEFT JOIN keywords k ON r.keyword_id = k.id
        LEFT JOIN operators o ON k.operator_id = o.id
        WHERE (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)
        
        UNION ALL
        
        -- Balance transfer transactions with unified structure  
        SELECT 
          'balance_transfer' as transaction_type,
          bt.id as transaction_id,
          bt.user_id,
          bt.to_id,
          CASE 
            WHEN bt.user_id = ? THEN u_to.mobile
            ELSE u_from.mobile
          END as mobile_number,
          NULL as account_number,
          bt.amount as original_amount,
          bt.amount as pay_amount,
          bt.amount as final_amount,
          0 as commission,
          CASE 
            WHEN bt.user_id = ? THEN bt.prev_balance
            ELSE bt.Maalik_prev_balance  
          END as stored_old_balance,
          CASE 
            WHEN bt.user_id = ? THEN bt.new_balance
            ELSE bt.Maalik_new_balance
          END as stored_new_balance,
          NULL as parent_id,
          NULL as superparent_id,
          NULL as com_parent,
          NULL as com_superparent,
          NULL as com_admin,
          bt.status,
          CONCAT('Transfer ', 
            CASE 
              WHEN bt.user_id = ? THEN CONCAT('to ', COALESCE(u_to.person, 'Unknown'), ' (', COALESCE(u_to.mobile, 'N/A'), ')')
              ELSE CONCAT('from ', COALESCE(u_from.person, 'Unknown'), ' (', COALESCE(u_from.mobile, 'N/A'), ')')
            END,
            CASE WHEN bt.remark IS NOT NULL THEN CONCAT(' - ', bt.remark) ELSE '' END
          ) as description,
          CONCAT('TXN', bt.id) as txnid,
          bt.id as reference_id,
          'Balance Transfer' as service_name,
          bt.created_at,
          bt.updated_at
        FROM bal_transactions bt
        LEFT JOIN users u_to ON bt.to_id = u_to.id
        LEFT JOIN users u_from ON bt.user_id = u_from.id
        WHERE (bt.user_id = ? OR bt.to_id = ?)
      ) as unified_transactions
      WHERE 1=1 ${dateCondition} ${typeCondition} ${statusCondition}
      ORDER BY created_at DESC
    `;

    // Parameters for the query (6 for recharge + 6 for balance_transfer + filter params)
    const queryParameters = [
      userId, userId, userId, // for recharge commission logic
      userId, userId, userId, // for recharge user filter
      userId, userId, userId, userId, // for balance transfer logic  
      userId, userId, // for balance transfer user filter
      ...queryParams // date, status filters
    ];

    console.log('Query parameters:', queryParameters);

    // Get total count first for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as counted`;
    const [countResult] = await db.query(countQuery, queryParameters);
    const totalRecords = countResult[0]?.total || 0;

    console.log('Total records found:', totalRecords);

    // Get paginated transactions
    const offset = (page - 1) * limit;
    const paginatedQuery = `${baseQuery} LIMIT ? OFFSET ?`;
    const [transactions] = await db.query(paginatedQuery, [...queryParameters, parseInt(limit), offset]);

    console.log(`Retrieved ${transactions.length} transactions for page ${page}`);

    // Calculate running balances with corrected logic
    const transactionsWithBalances = calculateRunningBalancesCorrect(transactions, userRole, userId, currentBalance);

    // Calculate summary
    const summary = {
      total_records: totalRecords,
      total_credits: 0,
      total_debits: 0,
      net_amount: 0,
      recharge_count: 0,
      recharge_amount: 0,
      transfer_count: 0,
      transfer_amount: 0,
      commission_earned: 0,
      opening_balance: transactionsWithBalances.length > 0 ? transactionsWithBalances[transactionsWithBalances.length - 1]?.calculated_previous_balance || 0 : currentBalance,
      closing_balance: transactionsWithBalances.length > 0 ? transactionsWithBalances[0]?.calculated_new_balance || 0 : currentBalance
    };

    transactionsWithBalances.forEach(txn => {
      const effect = txn.transaction_effect || 0;
      
      if (effect > 0) {
        summary.total_credits += effect;
      } else {
        summary.total_debits += Math.abs(effect);
      }

      if (txn.transaction_type === 'recharge') {
        summary.recharge_count++;
        summary.recharge_amount += Math.abs(txn.final_amount || 0);
        summary.commission_earned += Math.abs(txn.commission || 0);
      } else if (txn.transaction_type === 'balance_transfer') {
        summary.transfer_count++;
        summary.transfer_amount += Math.abs(txn.final_amount || 0);
      }
    });

    summary.net_amount = summary.total_credits - summary.total_debits;

    const response = {
      success: true,
      data: {
        user: {
          id: userId,
          name: user.person || '',
          mobile: user.mobile || '',
          role: user.role_name || '',
          current_balance: currentBalance
        },
        transactions: transactionsWithBalances,
        summary,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_records: totalRecords,
          total_pages: Math.ceil(totalRecords / limit),
          has_next: page * limit < totalRecords,
          has_prev: page > 1
        },
        filters: {
          start_date: startDate || null,
          end_date: endDate || null,
          type,
          status
        }
      }
    };

    console.log('=== Statement API Response Ready ===');
    console.log(`Returning ${transactionsWithBalances.length} transactions`);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Statement API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch statement',
      error: error.message
    });
  }
});

// Corrected balance calculation function following exact user specifications
function calculateRunningBalancesCorrect(transactions, userRole, userId, startingBalance) {
  if (!transactions || transactions.length === 0) {
    console.log('No transactions to process');
    return [];
  }

  console.log(`=== Calculating Running Balances ===`);
  console.log(`User: ${userId}, Role: ${userRole}, Starting Balance: ${startingBalance}`);
  console.log(`Total Transactions: ${transactions.length}`);

  // Sort chronologically (oldest first) for calculation
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );

  let runningBalance = startingBalance;

  // Try to get better starting balance from first transaction
  if (sortedTransactions.length > 0) {
    const firstTxn = sortedTransactions[0];
    const storedBalance = parseFloat(firstTxn.stored_old_balance || 0);
    if (storedBalance > 0) {
      runningBalance = storedBalance;
      console.log(`Using stored balance as starting point: ${runningBalance}`);
    }
  }

  const processedTransactions = sortedTransactions.map((txn, index) => {
    const previousBalance = runningBalance;
    let transactionEffect = 0;

    console.log(`\n--- Transaction ${index + 1} ---`);
    console.log(`Type: ${txn.transaction_type}, User: ${txn.user_id}, Amount: ${txn.final_amount}`);
    console.log(`Previous Balance: ${previousBalance}`);

    // Apply your exact logic specifications
    if (txn.transaction_type === 'recharge') {
      if (userRole === 5) { // Retailer
        if (txn.user_id === userId) {
          // Retailer's own recharge: old balance - deducted amount = new balance
          transactionEffect = -Math.abs(parseFloat(txn.pay_amount || txn.final_amount || 0));
          console.log(`Retailer own recharge: -${Math.abs(parseFloat(txn.pay_amount || txn.final_amount || 0))}`);
        }
        // Note: Retailers don't get commission from others' recharges in your logic
      } else { // Distributor, Master, Admin, Super Admin
        if (txn.user_id === userId) {
          // Their own recharge: old balance - deducted amount = new balance
          transactionEffect = -Math.abs(parseFloat(txn.pay_amount || txn.final_amount || 0));
          console.log(`Own recharge: -${Math.abs(parseFloat(txn.pay_amount || txn.final_amount || 0))}`);
        } else {
          // Commission based on role and relationship
          let commission = 0;
          
          if (txn.parent_id === userId) {
            // User is parent of the recharge user
            commission = parseFloat(txn.com_parent || 0);
            console.log(`Parent commission: ${commission}`);
          } else if (txn.superparent_id === userId) {
            // User is superparent of the recharge user  
            commission = parseFloat(txn.com_superparent || 0);
            console.log(`Superparent commission: ${commission}`);
          } else if (userRole === 1 || userRole === 2) { // Admin or Super Admin
            commission = parseFloat(txn.com_admin || 0);
            console.log(`Admin commission: ${commission}`);
          }
          
          transactionEffect = Math.abs(commission);
        }
      }
    } else if (txn.transaction_type === 'balance_transfer') {
      // For all roles (distributor, master, admins, super admin)
      if (txn.to_id === userId) {
        // Receiving transfer: old balance + amount = new balance
        transactionEffect = Math.abs(parseFloat(txn.final_amount || 0));
        console.log(`Received transfer: +${Math.abs(parseFloat(txn.final_amount || 0))}`);
      } else if (txn.user_id === userId) {
        // Sending transfer: old balance - amount = new balance
        transactionEffect = -Math.abs(parseFloat(txn.final_amount || 0));
        console.log(`Sent transfer: -${Math.abs(parseFloat(txn.final_amount || 0))}`);
      }
    }

    // Update running balance
    runningBalance = parseFloat((previousBalance + transactionEffect).toFixed(2));

    console.log(`Transaction Effect: ${transactionEffect}`);
    console.log(`New Balance: ${runningBalance}`);

    return {
      ...txn,
      calculated_previous_balance: parseFloat(previousBalance.toFixed(2)),
      calculated_new_balance: runningBalance,
      transaction_effect: parseFloat(transactionEffect.toFixed(2)),
      // Clean up amounts
      original_amount: parseFloat(txn.original_amount || 0),
      pay_amount: parseFloat(txn.pay_amount || 0),
      final_amount: parseFloat(txn.final_amount || 0),
      commission: parseFloat(txn.commission || 0)
    };
  });

  console.log(`=== Balance Calculation Complete ===`);
  console.log(`Final Balance: ${runningBalance}`);

  // Return in display order (newest first)
  return processedTransactions.reverse();
}




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
