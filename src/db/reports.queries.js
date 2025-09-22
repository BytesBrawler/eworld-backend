const { recharge } = require("../controllers/retailer.controller");
const db = require("../db");
const { transactions } = require("./queries");

async function getHistory(userId, options = {}) {
  const {
    page = 1,
    limit = 10,
    mobile,
    account,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    status,
    operatorId
  } = options;

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base query with user details
  let query = `
      SELECT 
        r.id, 
        r.number, 
        r.account,
        r.amount, 
        r.reqid,
        r.txnid,
        r.message,
        r.com_retailer as comission,
        r.user_prev_balance,
        r.user_new_balance,
        r.status, 
        r.created_at,
        r.completed_at,
        k.description as operator_name,
        o.logo as operator_logo 
      FROM recharges as  r
      LEFT JOIN keywords as k ON r.keyword_id = k.id
      LEFT JOIN operators as o ON k.operator_id = o.id
       where r.user_id = ?
    `;

  const queryParams = [userId];

  // Date range filter
  if (startDate && endDate) {
    query += ` AND r.created_at BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  }

  // Amount range filter
  if (minAmount !== undefined) {
    query += ` AND r.amount >= ?`;
    queryParams.push(minAmount);
  }
  if (maxAmount !== undefined) {
    query += ` AND r.amount <= ?`;
    queryParams.push(maxAmount);
  }

  // Status filter
  if (status) {
    query += ` AND r.status = ?`;
    queryParams.push(status);
  }

  if(mobile) {
    query += ` AND r.number LIKE ?`;
    queryParams.push(`%${mobile}%`);
  }

  if(account) {
    query += ` AND r.account LIKE ?`;
    queryParams.push(`%${account}%`);
  }

  // Operator filter
  if (operatorId) {
    query += ` AND r.keyword_id = ?`;
    queryParams.push(operatorId);
  }

  // Add sorting and pagination
  query += ` 
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
  queryParams.push(limit, offset);

  // Count total records for pagination
  const countQuery = query
    .replace(/SELECT.*?FROM/s, "SELECT COUNT(*) as total FROM")
    .replace(/LIMIT.*OFFSET.*$/s, "");

  // Total amount of successful recharges (with same filters except page/limit)
  let totalAmountQuery = `
    SELECT SUM(r.amount) as total_success_amount
    FROM recharges as r
    LEFT JOIN keywords as k ON r.keyword_id = k.id
    LEFT JOIN operators as o ON k.operator_id = o.id

    WHERE 
    
    r.user_id = ?
  `;
  const totalAmountParams = [userId];

  if (startDate && endDate) {
    totalAmountQuery += ` AND r.created_at BETWEEN ? AND ?`;
    totalAmountParams.push(startDate, endDate);
  }
  if (minAmount !== undefined) {
    totalAmountQuery += ` AND r.amount >= ?`;
    totalAmountParams.push(minAmount);
  }
  if (maxAmount !== undefined) {
    totalAmountQuery += ` AND r.amount <= ?`;
    totalAmountParams.push(maxAmount);
  }
  if(mobile) {
    totalAmountQuery += ` AND r.number LIKE ?`;
    totalAmountParams.push(`%${mobile}%`);
  }
  if(account) {
    totalAmountQuery += ` AND r.account LIKE ?`;
    totalAmountParams.push(`%${account}%`);
  }
  if (operatorId) {
    totalAmountQuery += ` AND r.keyword_id = ?`;
    totalAmountParams.push(operatorId);
  }
  // Only successful status 
  totalAmountQuery += ` AND r.status = 'success'`;

  const [reports] = await db.query(query, queryParams);
  const [countResult] = await db.query(countQuery, queryParams.slice(0, -2));
  const [totalAmountResult] = await db.query(totalAmountQuery, totalAmountParams);

  return {
    transactions: reports,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    },
    totalSuccessAmount: totalAmountResult[0].total_success_amount || 0
  };
}

async function getPurchasesReports(userId, options) {
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    status,
    transactionType
  } = options;


  
  const offset = (page - 1) * limit;
  let query = `
    SELECT
      bt.amount,
      bt.status,
      bt.transaction_type,
      bt.created_at,
      CASE 
        WHEN bt.reference_id IS NULL THEN bt.id 
        ELSE bt.reference_id 
      END AS reference_id,
      bt.prev_balance,
      bt.new_balance,
      bt.remark,
      bt.balance_type
    FROM bal_transactions AS bt
    WHERE bt.to_id = ?
  `;

  const params = [userId];

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

  // Save where clause for count and statistics
  const whereClause = query.split("WHERE")[1];

  // Add pagination to the main query
  query += ` ORDER BY bt.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Build a proper count query
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM bal_transactions as bt
    WHERE ${whereClause}
  `;

  // Build statistics query
  const statsQuery = `
    SELECT 
      bt.status,
      COUNT(*) as count,
      SUM(bt.amount) as total_amount
    FROM bal_transactions as bt
    WHERE ${whereClause}
    GROUP BY bt.status
  `;

  // Execute queries
  const [rows] = await db.query(query, params);
  const [countResult] = await db.query(countQuery, params.slice(0, -2));
  const [statsResult] = await db.query(statsQuery, params.slice(0, -2));

  // Process statistics
  const statistics = {
    success: { count: 0, amount: 0 },
    failed: { count: 0, amount: 0 },
    pending: { count: 0, amount: 0 },
    total: { count: 0, amount: 0 }
  };

  statsResult.forEach(row => {
    const status = row.status.toLowerCase();
    const count = parseInt(row.count);
    const amount = parseFloat(row.total_amount);
    
    if (statistics[status]) {
      statistics[status].count = count;
      statistics[status].amount = amount;
    }
    
    statistics.total.count += count;
    statistics.total.amount += amount;
  });

  return {
    transactions: rows,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    },
    statistics
  };
}
async function getPurchasesReportsOnline  ({
  page = 1,
  limit = 20,
  startDate,
  endDate,
  minAmount,
  maxAmount,
  status,
  userId,
  mobileNumber
}) {
  console.log("getPurchasesReportsOnline - userId:", userId, "mobileNumber:", mobileNumber);
  
  try {
    let query = `
      SELECT 
        t.id as transaction_id,
        t.amount,
        t.status,
        t.order_id as order_id,
        t.reference_id,
        t.payment_mode,
        t.gateway as gateway,
        t.payment_details,
        t.gateway_response,
        t.created_at,
        t.updated_at,
        u.id as user_id,
        u.person as name,
        u.mobile as phonenumber,
        u.company as shop,
        bt.id as bal_transaction_id,
        bt.transaction_type,
        bt.prev_balance,
        bt.new_balance
      FROM transactions t
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN bal_transactions bt ON t.order_id = bt.reference_id AND bt.transaction_type = 'online'
      WHERE 1=1
    `;

    const queryParams = [];

    // Add user filter only if userId is provided (null = show all users)
    if (userId) {
      query += " AND t.user_id = ?";
      queryParams.push(userId);
    }
    // If userId is null/undefined, we show transactions for ALL users

    if (startDate) {
      query += " AND t.created_at >= ?";
      queryParams.push(startDate);
    }

    if (endDate) {
      query += " AND t.created_at <= ?";
      queryParams.push(endDate);
    }

    if (status) {
      query += " AND t.status = ?";
      queryParams.push(status);
    }

    if (minAmount !== undefined) {
      query += " AND t.amount >= ?";
      queryParams.push(minAmount);
    }

    if (maxAmount !== undefined) {
      query += " AND t.amount <= ?";
      queryParams.push(maxAmount);
    }

    query += " ORDER BY t.created_at DESC";

    // Build count query separately to avoid string replacement issues
    let countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN bal_transactions bt ON t.order_id = bt.reference_id AND bt.transaction_type = 'online'
      WHERE 1=1
    `;

    // Build count query parameters (same as main query but without ORDER BY, LIMIT, OFFSET)
    const countParams = [];

    // Add user filter only if userId is provided (null = show all users)
    if (userId) {
      countQuery += " AND t.user_id = ?";
      countParams.push(userId);
    }

    if (startDate) {
      countQuery += " AND t.created_at >= ?";
      countParams.push(startDate);
    }

    if (endDate) {
      countQuery += " AND t.created_at <= ?";
      countParams.push(endDate);
    }

    if (status) {
      countQuery += " AND t.status = ?";
      countParams.push(status);
    }

    if (minAmount !== undefined) {
      countQuery += " AND t.amount >= ?";
      countParams.push(minAmount);
    }

    if (maxAmount !== undefined) {
      countQuery += " AND t.amount <= ?";
      countParams.push(maxAmount);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const totalItems = countResult.length > 0 ? countResult[0].total : 0;

    query += " LIMIT ? OFFSET ?";
    queryParams.push(parseInt(limit));
    queryParams.push((parseInt(page) - 1) * parseInt(limit));


    
    const [results] = await db.query(query, queryParams);

    if (!results || results.length === 0) {
      return {
        transactions: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 1
        },
        statistics: {
          success: { count: 0, amount: 0 },
          failed: { count: 0, amount: 0 },
          pending: { count: 0, amount: 0 },
          total: { count: 0, amount: 0 }
        }
      };
    }

    const formattedResults = results.map(item => ({
      id: item.transaction_id,
      amount: item.amount,
      status: item.status,
      reference_id: item.reference_id || item.order_id,
      order_id: item.order_id,
      gateway: item.gateway,
      payment_mode: item.payment_mode,
      payment_details: item.payment_details,
      gateway_response: item.gateway_response,
      created_at: item.created_at,
      updated_at: item.updated_at,
      user: {
        id: item.user_id,
        name: item.name,
        phonenumber: item.phonenumber,
        shop: item.shop
      },
      balance: {
        previous: item.prev_balance,
        new: item.new_balance,
        transaction_type: item.transaction_type
      } 
    }));

    // Build statistics query separately to avoid SQL syntax issues
    let statsQuery = `
      SELECT 
        t.status, 
        COUNT(*) as count, 
        SUM(t.amount) as total_amount
      FROM transactions t
      INNER JOIN users u ON t.user_id = u.id
      LEFT JOIN bal_transactions bt ON t.order_id = bt.reference_id AND bt.transaction_type = 'online'
      WHERE 1=1
    `;

    // Build stats query parameters (same as main query but without LIMIT and OFFSET)
    const statsParams = [];

    // Add user filter only if userId is provided (null = show all users)
    if (userId) {
      statsQuery += " AND t.user_id = ?";
      statsParams.push(userId);
    }
    // If userId is null/undefined, we show statistics for ALL users

    if (startDate) {
      statsQuery += " AND t.created_at >= ?";
      statsParams.push(startDate);
    }

    if (endDate) {
      statsQuery += " AND t.created_at <= ?";
      statsParams.push(endDate);
    }

    if (status) {
      statsQuery += " AND t.status = ?";
      statsParams.push(status);
    }

    if (minAmount !== undefined) {
      statsQuery += " AND t.amount >= ?";
      statsParams.push(minAmount);
    }

    if (maxAmount !== undefined) {
      statsQuery += " AND t.amount <= ?";
      statsParams.push(maxAmount);
    }

    statsQuery += " GROUP BY t.status";
    

    
    const [statsResult] = await db.query(statsQuery, statsParams);

    // Process statistics
    const statistics = {
      success: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      total: { count: 0, amount: 0 }
    };

    if (statsResult && statsResult.length > 0) {
      statsResult.forEach(row => {
        const status = row.status.toLowerCase();
        const count = parseInt(row.count);
        const amount = parseFloat(row.total_amount);
        
        if (statistics[status]) {
          statistics[status].count = count;
          statistics[status].amount = amount;
        }
        
        statistics.total.count += count;
        statistics.total.amount += amount;
      });
    }

    return {
      transactions: formattedResults,
      pagination: {
        total: totalItems || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalItems / parseInt(limit)) || 1
      },
      statistics
    };
  } catch (error) {
    console.error("Error in getPurchasesReportsOnline:", error);
    return {
      transactions: [],
      pagination: {
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 1
      },
      statistics: {
        success: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 },
        pending: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 }
      },
      error: "Failed to fetch online purchase reports"
    };
  }
};
// async function getPurchasesReportsOnline(options) {
//   const {
//     page = 1,
//     limit = 20,
//     startDate,
//     endDate,
//     minAmount,
//     maxAmount,
//     status,
//     transactionType,
//     to_id
//   } = options;

//   const offset = (page - 1) * limit;

//   let query = `
//       SELECT
//         u.company as company,
//         u.mobile as mobile,
//         bt.amount,
//         bt.status,
//         bt.transaction_type,
//         bt.created_at,
//         bt.reference_id,
//         bt.prev_balance,
//         bt.new_balance,
//         bt.remark
//       from bal_transactions as bt
//       left join users as u on bt.to_id = u.id
//       WHERE 1=1
//     `;

//   const params = [];



//   if (startDate && endDate) {
//     query += ` AND bt.created_at BETWEEN ? AND ?`;
//     params.push(startDate, endDate);
//   }

//   if (minAmount) {
//     query += ` AND bt.amount >= ?`;
//     params.push(minAmount);
//   }

//   if (maxAmount) {
//     query += ` AND bt.amount <= ?`;
//     params.push(maxAmount);
//   }

//   if (status) {
//     query += ` AND bt.status = ?`;
//     params.push(status);
//   }

//   if (transactionType) {
//     query += ` AND bt.transaction_type = ?`;
//     params.push(transactionType);
//   }

//   if(to_id){
//     query += ` AND bt.to_id = ?`;
//     params.push(to_id);
//   }

//   // Create a copy of the WHERE clause for the count query
//   const whereClause = query.split("WHERE")[1];

//   // Add pagination to the main query
//   query += ` ORDER BY bt.created_at DESC LIMIT ? OFFSET ?`;
//   params.push(limit, offset);

//   // Build a proper count query
//   const countQuery = `
//       SELECT COUNT(*) as total 
//       FROM bal_transactions as bt
//       WHERE ${whereClause}
//     `;

//   // Execute queries
//   const [rows] = await db.query(query, params);
//   const [countResult] = await db.query(countQuery, params.slice(0, -2));
//   console.log("count result", countResult);

//   return {
//     transactions: rows,
//     pagination: {
//       page,
//       limit,
//       total: countResult[0].total,
//       totalPages: Math.ceil(countResult[0].total / limit)
//     }
//   };
// }

async function getRecents(userId,role) {
    console.log("user id", userId);
  const queryRetailer = `
    SELECT 
      r.account as transaction_id,
      r.created_at as transaction_date,
      r.amount,
      r.status,
      r.reqid as details,
      k.description as operator_name,
      r.type as transaction_type,
      o.logo as operator_logo,
      r.type_status as balance_type
    FROM recharges as r
    LEFT JOIN keywords as k ON r.keyword_id = k.id
    LEFT JOIN operators as o ON k.operator_id = o.id
    WHERE r.user_id = ?
    ORDER BY transaction_date DESC
    LIMIT ?
  
  `;

  const query = `
    (SELECT 
      r.reference_id as transaction_id,
      r.created_at as transaction_date,
      r.amount,
      r.status,
      r.remark as details,
      'purchase' as transaction_type,
      NULL as operator_name,
      r.balance_type
    FROM bal_transactions as r
    WHERE r.to_id = ?)
    
    UNION ALL
    
    (SELECT
      bt.reference_id as transaction_id,
      bt.created_at as transaction_date,
      bt.amount,
      bt.status,
      bt.remark as details,
      u.company as transaction_type,
      u.mobile as operator_name,
      bt.balance_type
    FROM bal_transactions as bt
    LEFT JOIN users as u ON bt.to_id = u.id
    WHERE bt.user_id = ?)
    
    ORDER BY transaction_date DESC
    LIMIT ?
  `;
  // const queryRetailer = `
  //   (SELECT 
  //     r.number as transaction_id,
  //     r.created_at as transaction_date,
  //     r.amount,
  //     r.status,
  //     r.reqid as details,
  //     k.description as operator_name,
  //     'recharge' as transaction_type,
  //     NULL as balance_type
  //   FROM recharges as r
  //   LEFT JOIN keywords as k ON r.keyword_id = k.id
  //   WHERE r.user_id = ?)
    
  //   UNION ALL
    
  //   (SELECT
  //     bt.reference_id as transaction_id,
  //     bt.created_at as transaction_date,
  //     bt.amount,
  //     bt.status,
  //     bt.remark as details,
  //     NULL as operator_name,
  //     'balance' as transaction_type,
  //     bt.balance_type
  //   FROM bal_transactions as bt
  //   WHERE bt.to_id = ?)
  
  //   ORDER BY transaction_date DESC
  //   LIMIT ?
  // `;

  // const query = `
  //   (SELECT 
  //     r.reference_id as transaction_id,
  //     r.created_at as transaction_date,
  //     r.amount,
  //     r.status,
  //     r.remark as details,
  //     'purchase' as transaction_type,
  //     NULL as operator_name,
  //     r.balance_type
  //   FROM bal_transactions as r
  //   WHERE r.to_id = ?)
    
  //   UNION ALL
    
  //   (SELECT
  //     bt.reference_id as transaction_id,
  //     bt.created_at as transaction_date,
  //     bt.amount,
  //     bt.status,
  //     bt.remark as details,
  //     u.company as transaction_type,
  //     u.mobile as operator_name,
  //     bt.balance_type
  //   FROM bal_transactions as bt
  //   LEFT JOIN users as u ON bt.to_id = u.id
  //   WHERE bt.user_id = ?)
    
  //   ORDER BY transaction_date DESC
  //   LIMIT ?
  // `;

  let params = [userId,  5];
  if(role == 5){
    const [recents] = await db.query(queryRetailer, params);
    console.log(recents);
    return recents;
  }

   params = [userId, userId, 5];

  const [recents] = await db.query(query, params);
  console.log(recents);
  return recents;
}

async function getEarnings(userId, role, options = {}) {
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
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = options;
  
  console.log("getEarnings", userId, role, options);
  
  // Base query for each role
  let baseQuery = '';
  let countQuery = '';
  let params = [];
  let whereConditions = [];
  
  // Add role-specific query parts
  switch (role) {
    case 5: // Retailer
    case 6: // Retailer (alternate)
      baseQuery = `
        SELECT 
          r.reqid as recharge_id,
          r.account,
          r.number,
          r.amount,
          r.status,
          r.user_prev_balance as prev_balance,
          r.user_new_balance as new_balance,
          r.com_retailer as earnings,
          r.txnid,
          r.created_at,
          r.message,
          k.description as service,
          k.id as keyword_id,
          o.name as operator_name,
          o.id as operator_id
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        WHERE 
          r.user_id = ?
      `;
      
      countQuery = `
        SELECT 
          COUNT(*) as total
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        WHERE 
          r.user_id = ?
      `;
      
      // whereConditions.push('r.user_id = ?');
      params.push(userId);
      break;
      
    case 4: // Distributor (parent)
      baseQuery = `
        SELECT 
          r.reqid as recharge_id,
          r.account,
          r.number,
          r.amount,
          r.status,
          r.com_parent as earnings,
          r.txnid,
          r.created_at,
          r.message,
          k.description as service,
          k.id as keyword_id,
          o.name as operator_name,
          o.id as operator_id,
          u.person as retailer_name,
          u.mobile as retailer_mobile
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        JOIN
          users u ON r.user_id = u.id
        WHERE 
          (r.parent_id = ? or r.user_id = ?)
      `;
      
      countQuery = `
        SELECT 
          COUNT(*) as total
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        JOIN
          users u ON r.user_id = u.id
        WHERE 
         (r.parent_id = ? or r.user_id = ?)
      `;

      // whereConditions.push('r.parent_id = ?');
params.push(userId);
params.push(userId);

      
    //  whereConditions.push('r.parent_id = ?');
      // params.push(userId);
      break;
      
    case 3: // Master Distributor (superparent)
      baseQuery = `
        SELECT 
          r.reqid as recharge_id,
          r.account,
          r.number,
          r.amount,
          r.status,
          CASE
            WHEN r.superparent_id = ? THEN r.com_superparent
            WHEN r.parent_id = ? THEN r.com_parent
            ELSE 0
          END as earnings,
          r.txnid,
          r.reqid,
          r.created_at,
          r.message,
          k.description as service,
          k.id as keyword_id,
          o.name as operator_name,
          o.id as operator_id,
          u.person as retailer_name,
          u.mobile as retailer_mobile,
          p.person as distributor_name,
          p.mobile as distributor_mobile
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        JOIN
          users u ON r.user_id = u.id
        LEFT JOIN
          users p ON r.parent_id = p.id
        WHERE 
          (r.superparent_id = ? OR r.parent_id = ? or r.user_id = ?)
      `;
      
      countQuery = `
        SELECT 
          COUNT(*) as total
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        JOIN
          users u ON r.user_id = u.id
        LEFT JOIN
          users p ON r.parent_id = p.id
        WHERE 
          (r.superparent_id = ? OR r.parent_id = ? or r.user_id = ?)
      `;
      
    //  whereConditions.push('(r.superparent_id = ? OR r.parent_id = ?)');
      params.push(userId, userId,userId,userId , userId);
      break;
      
    case 2:
    case 1: // Admin and Super Admin
      baseQuery = `
        SELECT 
          r.id as recharge_id,
          r.account,
          r.number,
          r.amount,
          r.status,
          r.com_admin as earnings,
          r.txnid,
          r.reqid,
          r.created_at,
          r.message,
          k.description as service,
          k.id as keyword_id,
          o.name as operator_name,
          o.id as operator_id,
          u.person as retailer_name,
          u.mobile as retailer_mobile,
          p.person as distributor_name,
          p.mobile as distributor_mobile,
          sp.person as master_distributor_name,
          sp.mobile as master_distributor_mobile
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        JOIN
          users u ON r.user_id = u.id
        LEFT JOIN
          users p ON r.parent_id = p.id
        LEFT JOIN
          users sp ON r.superparent_id = sp.id
        WHERE 
          1=1
      `;
      
      countQuery = `
        SELECT 
          COUNT(*) as total
        FROM 
          recharges r
        JOIN
          keywords k ON r.keyword_id = k.id
        JOIN
          operators o ON k.operator_id = o.id
        JOIN
          users u ON r.user_id = u.id
        LEFT JOIN
          users p ON r.parent_id = p.id
        LEFT JOIN
          users sp ON r.superparent_id = sp.id
        WHERE 
          1=1
      `;
      
      break;
      
    default:
      return { recharges: [], total: 0 };
  }

    let summaryParams = [];
    let summaryWhere = [];
  
  // Add filter conditions
  if (startDate) {
    whereConditions.push('r.created_at >= ?');
    summaryWhere.push('r.created_at >= ?');
    params.push(startDate);
    summaryParams.push(startDate);
  }
  
  if (endDate) {
    whereConditions.push('r.created_at <= ?');
    summaryWhere.push('r.created_at <= ?');
    params.push(endDate);
    summaryParams.push(endDate);
  }
  
  if (status) {
    whereConditions.push('r.status = ?');

    params.push(status);

  }
  
  if (operatorId) {
    whereConditions.push('o.id = ?');
    summaryWhere.push('o.id = ?');
    params.push(operatorId);
    summaryParams.push(operatorId);
  }
  
  if (keyword) {
    whereConditions.push('k.id = ?');
    params.push(keyword);
    summaryWhere.push('k.id = ?');
    summaryParams.push(keyword);
  }
  
  if (minAmount) {
    whereConditions.push('r.amount >= ?');
    params.push(minAmount);
    summaryWhere.push('r.amount >= ?');
    summaryParams.push(minAmount);
  }
  
  if (maxAmount) {
    whereConditions.push('r.amount <= ?');
    params.push(maxAmount);
    summaryWhere.push('r.amount <= ?');
    summaryParams.push(maxAmount);
  }
  
  if (number) {
    whereConditions.push('r.number LIKE ?');
    params.push(`%${number}%`);
    summaryWhere.push('r.number LIKE ?');
    summaryParams.push(`%${number}%`);
  }
  
  if (account) {
    whereConditions.push('r.account LIKE ?');
    params.push(`%${account}%`);
    summaryWhere.push('r.account LIKE ?');
    summaryParams.push(`%${account}%`);
  }
  
  // Build WHERE clause if conditions exist
  // let whereClause = '';
  // if (whereConditions.length > 0) {
  //   // The first condition is already incorporated in the base query
  //   whereClause = ' AND ' + whereConditions.slice(role === 1 || role === 2 ? 0 : 1).join(' AND ');
  // }

  let whereClause = '';
if (whereConditions.length > 0) {
  whereClause = ' AND ' + whereConditions.join(' AND ');
}

let summaryWhereClause = '';
if(summaryWhere.length > 0) {
  summaryWhereClause = ' AND ' + summaryWhere.join(' AND ');
}



  
  // Complete the queries
  const fullQuery = `
    ${baseQuery}
    ${whereClause}
    ORDER BY r.${sortBy} ${sortOrder}
    LIMIT ${limit} OFFSET ${offset}
  `;

  console.log("fullQuery", fullQuery);

  
  const fullCountQuery = `
    ${countQuery}
    ${whereClause}
  `;
  
  // Add pagination parameters
  const queryParams = [...params];

  console.log(queryParams);

 
  
  // Execute queries
  const [recharges] = await db.execute(fullQuery, queryParams);
   if(role === 3){
    //remvoe 2 userids from params measn it is now [userId, userId,userId,userId] so remove first two userIds
    params.splice(0, 2);
    

  }
  const [totalResult] = await db.execute(fullCountQuery, params);
  const total = totalResult[0].total;


  // Calculate total earnings and fetch summary data via query
  let summaryQuery = '';
  // For each role, restrict summary counts to the same user scope as total_earnings

  if (role === 3) { // Master Distributor
    summaryQuery = `
      SELECT 
      COUNT(*) as total_recharges,
      SUM(r.amount) as total_amount,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
      SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed_recharges,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN r.amount ELSE 0 END) as failed_amount,
      SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
      SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
      SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
      SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
      SUM(
      CASE 
      WHEN r.superparent_id = ? THEN r.com_superparent
      WHEN r.parent_id = ? THEN r.com_parent
      ELSE 0
      END
      ) as total_earnings
      FROM recharges r
      JOIN keywords k ON r.keyword_id = k.id
      JOIN operators o ON k.operator_id = o.id
      WHERE (r.superparent_id = ? OR r.parent_id = ?) ${summaryWhereClause}
    `;
    summaryParams = [userId, userId, userId, userId, ...summaryParams];
  } else if (role === 4) { // Distributor
    summaryQuery = `
      SELECT 
      COUNT(*) as total_recharges,
      SUM(r.amount) as total_amount,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
      SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed_recharges,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN r.amount ELSE 0 END) as failed_amount,
      SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
      SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
      SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
      SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
      SUM(r.com_parent) as total_earnings
      FROM recharges r
      JOIN keywords k ON r.keyword_id = k.id
      JOIN operators o ON k.operator_id = o.id
      WHERE r.parent_id = ? ${summaryWhereClause}
    `;
    summaryParams = [userId, ...summaryParams];
  } else if (role === 5 || role === 6) { // Retailer
    summaryQuery = `
      SELECT 
      COUNT(*) as total_recharges,
      SUM(r.amount) as total_amount,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
      SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed_recharges,
      SUM(CASE WHEN r.status = 'failed'  OR r.status = 'refunded' THEN r.amount ELSE 0 END) as failed_amount,
      SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
      SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
      SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
      SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
      SUM(r.com_retailer) as total_earnings
      FROM recharges r
      JOIN keywords k ON r.keyword_id = k.id
      JOIN operators o ON k.operator_id = o.id
      WHERE r.user_id = ? ${summaryWhereClause}
    `;
    summaryParams = [userId, ...summaryParams];
  } else { // Admin/Super Admin
    summaryQuery = `
      SELECT 
      COUNT(*) as total_recharges,
      SUM(r.amount) as total_amount,
      SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
      SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN 1 ELSE 0 END) as failed_recharges,
      SUM(CASE WHEN r.status = 'failed' OR r.status = 'refunded' THEN r.amount ELSE 0 END) as failed_amount,
      SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
      SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
      SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
      SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
      SUM(r.com_admin) as total_earnings
      FROM recharges r
      JOIN keywords k ON r.keyword_id = k.id
      JOIN operators o ON k.operator_id = o.id
      WHERE 1=1 ${summaryWhereClause}
    `;
    summaryParams = [...summaryParams];
  }

  const [summaryResult] = await db.execute(summaryQuery, summaryParams);

  // Show summary as "count (sum of amount)" for each status
  const summary = {
    total_recharges: `${summaryResult[0].total_recharges || 0} (${parseFloat(summaryResult[0].total_amount || 0).toFixed(2)})`,
    successful_recharges: `${summaryResult[0].successful_recharges || 0} (${parseFloat(summaryResult[0].successful_amount || 0).toFixed(2)})`,
    failed_recharges: `${summaryResult[0].failed_recharges || 0} (${parseFloat(summaryResult[0].failed_amount || 0).toFixed(2)})`,
    pending_recharges: `${summaryResult[0].pending_recharges || 0} (${parseFloat(summaryResult[0].pending_amount || 0).toFixed(2)})`,
    initiated_recharges: `${summaryResult[0].initiated_recharges || 0} (${parseFloat(summaryResult[0].initiated_amount || 0).toFixed(2)})`,
    total_earnings: parseFloat(summaryResult[0].total_earnings || 0).toFixed(2),
  };


  return { recharges, total , summary };
}

// async function getEarnings(userId, role, options = {}) {
//   const {
//     startDate,
//     endDate,
//     status,
//     operatorId,
//     keyword,
//     minAmount,
//     maxAmount,
//     number,
//     account,
//     limit = 10,
//     offset = 0,
//     sortBy = 'created_at',
//     sortOrder = 'DESC'
//   } = options;
  
//   console.log("getEarnings", userId, role, options);
  
//   // Base query for each role
//   let baseQuery = '';
//   let countQuery = '';
//   let params = [];
//   let whereConditions = [];
  
//   // Add role-specific query parts
//   switch (role) {
//     case 5: // Retailer
//     case 6: // Retailer (alternate)
//       baseQuery = `
//         SELECT 
//           r.reqid as recharge_id,
//           r.account,
//           r.number,
//           r.amount,
//           r.status,
//           r.user_prev_balance as prev_balance,
//           r.user_new_balance as new_balance,
//           r.com_retailer as earnings,
//           r.txnid,
//           r.created_at,
//           r.message,
//           k.description as service,
//           k.id as keyword_id,
//           o.name as operator_name,
//           o.id as operator_id
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         WHERE 
//           r.user_id = ?
//       `;
      
//       countQuery = `
//         SELECT 
//           COUNT(*) as total
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         WHERE 
//           r.user_id = ?
//       `;
      
//       // whereConditions.push('r.user_id = ?');
//       params.push(userId);
//       break;
      
//     case 4: // Distributor (parent)
//       baseQuery = `
//         SELECT 
//           r.reqid as recharge_id,
//           r.account,
//           r.number,
//           r.amount,
//           r.status,
//           r.com_parent as earnings,
//           r.txnid,
//           r.created_at,
//           r.message,
//           k.description as service,
//           k.id as keyword_id,
//           o.name as operator_name,
//           o.id as operator_id,
//           u.person as retailer_name,
//           u.mobile as retailer_mobile
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         JOIN
//           users u ON r.user_id = u.id
//         WHERE 
//           r.parent_id = ?
//       `;
      
//       countQuery = `
//         SELECT 
//           COUNT(*) as total
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         JOIN
//           users u ON r.user_id = u.id
//         WHERE 
//          r.parent_id = ?
//       `;

//       // whereConditions.push('r.parent_id = ?');
// params.push(userId);

      
//     //  whereConditions.push('r.parent_id = ?');
//       // params.push(userId);
//       break;
      
//     case 3: // Master Distributor (superparent)
//       baseQuery = `
//         SELECT 
//           r.reqid as recharge_id,
//           r.account,
//           r.number,
//           r.amount,
//           r.status,
//           CASE
//             WHEN r.superparent_id = ? THEN r.com_superparent
//             WHEN r.parent_id = ? THEN r.com_parent
//             ELSE 0
//           END as earnings,
//           r.txnid,
//           r.reqid,
//           r.created_at,
//           r.message,
//           k.description as service,
//           k.id as keyword_id,
//           o.name as operator_name,
//           o.id as operator_id,
//           u.person as retailer_name,
//           u.mobile as retailer_mobile,
//           p.person as distributor_name,
//           p.mobile as distributor_mobile
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         JOIN
//           users u ON r.user_id = u.id
//         LEFT JOIN
//           users p ON r.parent_id = p.id
//         WHERE 
//           (r.superparent_id = ? OR r.parent_id = ?)
//       `;
      
//       countQuery = `
//         SELECT 
//           COUNT(*) as total
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         JOIN
//           users u ON r.user_id = u.id
//         LEFT JOIN
//           users p ON r.parent_id = p.id
//         WHERE 
//           (r.superparent_id = ? OR r.parent_id = ?)
//       `;
      
//     //  whereConditions.push('(r.superparent_id = ? OR r.parent_id = ?)');
//       params.push(userId, userId,userId,userId);
//       break;
      
//     case 2:
//     case 1: // Admin and Super Admin
//       baseQuery = `
//         SELECT 
//           r.id as recharge_id,
//           r.account,
//           r.number,
//           r.amount,
//           r.status,
//           r.com_admin as earnings,
//           r.txnid,
//           r.reqid,
//           r.created_at,
//           r.message,
//           k.description as service,
//           k.id as keyword_id,
//           o.name as operator_name,
//           o.id as operator_id,
//           u.person as retailer_name,
//           u.mobile as retailer_mobile,
//           p.person as distributor_name,
//           p.mobile as distributor_mobile,
//           sp.person as master_distributor_name,
//           sp.mobile as master_distributor_mobile
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         JOIN
//           users u ON r.user_id = u.id
//         LEFT JOIN
//           users p ON r.parent_id = p.id
//         LEFT JOIN
//           users sp ON r.superparent_id = sp.id
//         WHERE 
//           1=1
//       `;
      
//       countQuery = `
//         SELECT 
//           COUNT(*) as total
//         FROM 
//           recharges r
//         JOIN
//           keywords k ON r.keyword_id = k.id
//         JOIN
//           operators o ON k.operator_id = o.id
//         JOIN
//           users u ON r.user_id = u.id
//         LEFT JOIN
//           users p ON r.parent_id = p.id
//         LEFT JOIN
//           users sp ON r.superparent_id = sp.id
//         WHERE 
//           1=1
//       `;
      
//       break;
      
//     default:
//       return { recharges: [], total: 0 };
//   }

//     let summaryParams = [];
//     let summaryWhere = [];
  
//   // Add filter conditions
//   if (startDate) {
//     whereConditions.push('r.created_at >= ?');
//     summaryWhere.push('r.created_at >= ?');
//     params.push(startDate);
//     summaryParams.push(startDate);
//   }
  
//   if (endDate) {
//     whereConditions.push('r.created_at <= ?');
//     summaryWhere.push('r.created_at <= ?');
//     params.push(endDate);
//     summaryParams.push(endDate);
//   }
  
//   if (status) {
//     whereConditions.push('r.status = ?');

//     params.push(status);

//   }
  
//   if (operatorId) {
//     whereConditions.push('o.id = ?');
//     summaryWhere.push('o.id = ?');
//     params.push(operatorId);
//     summaryParams.push(operatorId);
//   }
  
//   if (keyword) {
//     whereConditions.push('k.id = ?');
//     params.push(keyword);
//     summaryWhere.push('k.id = ?');
//     summaryParams.push(keyword);
//   }
  
//   if (minAmount) {
//     whereConditions.push('r.amount >= ?');
//     params.push(minAmount);
//     summaryWhere.push('r.amount >= ?');
//     summaryParams.push(minAmount);
//   }
  
//   if (maxAmount) {
//     whereConditions.push('r.amount <= ?');
//     params.push(maxAmount);
//     summaryWhere.push('r.amount <= ?');
//     summaryParams.push(maxAmount);
//   }
  
//   if (number) {
//     whereConditions.push('r.number LIKE ?');
//     params.push(`%${number}%`);
//     summaryWhere.push('r.number LIKE ?');
//     summaryParams.push(`%${number}%`);
//   }
  
//   if (account) {
//     whereConditions.push('r.account LIKE ?');
//     params.push(`%${account}%`);
//     summaryWhere.push('r.account LIKE ?');
//     summaryParams.push(`%${account}%`);
//   }
  
//   // Build WHERE clause if conditions exist
//   // let whereClause = '';
//   // if (whereConditions.length > 0) {
//   //   // The first condition is already incorporated in the base query
//   //   whereClause = ' AND ' + whereConditions.slice(role === 1 || role === 2 ? 0 : 1).join(' AND ');
//   // }

//   let whereClause = '';
// if (whereConditions.length > 0) {
//   whereClause = ' AND ' + whereConditions.join(' AND ');
// }

// let summaryWhereClause = '';
// if(summaryWhere.length > 0) {
//   summaryWhereClause = ' AND ' + summaryWhere.join(' AND ');
// }



  
//   // Complete the queries
//   const fullQuery = `
//     ${baseQuery}
//     ${whereClause}
//     ORDER BY r.${sortBy} ${sortOrder}
//     LIMIT ${limit} OFFSET ${offset}
//   `;

//   console.log("fullQuery", fullQuery);

  
//   const fullCountQuery = `
//     ${countQuery}
//     ${whereClause}
//   `;
  
//   // Add pagination parameters
//   const queryParams = [...params];

//   console.log(queryParams);
  
//   // Execute queries
//   const [recharges] = await db.execute(fullQuery, queryParams);
//   const [totalResult] = await db.execute(fullCountQuery, params);
//   const total = totalResult[0].total;


//   // Calculate total earnings and fetch summary data via query
//   let summaryQuery = '';



//   if (role === 3) { // Master Distributor
//     summaryQuery = `
//       SELECT 
//       COUNT(*) as total_recharges,
//       SUM(r.amount) as total_amount,
//       SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
//       SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
//       SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed_recharges,
//       SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END) as failed_amount,
//       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
//       SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
//       SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
//       SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
//       SUM(
//         CASE 
//         WHEN r.superparent_id = ? THEN r.com_superparent
//         WHEN r.parent_id = ? THEN r.com_parent
//         ELSE 0
//         END
//       ) as total_earnings
//       FROM recharges r
//       JOIN keywords k ON r.keyword_id = k.id
//       JOIN operators o ON k.operator_id = o.id
//       WHERE 1=1 ${summaryWhereClause}
//     `;
//     summaryParams = [userId, userId, ...summaryParams];
//   } else if (role === 4) { // Distributor
//     summaryQuery = `
//       SELECT 
//       COUNT(*) as total_recharges,
//       SUM(r.amount) as total_amount,
//       SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
//       SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
//       SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed_recharges,
//       SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END) as failed_amount,
//       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
//       SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
//       SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
//       SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
//       SUM(r.com_parent) as total_earnings
//       FROM recharges r
//       JOIN keywords k ON r.keyword_id = k.id
//       JOIN operators o ON k.operator_id = o.id
//       WHERE 1=1 ${summaryWhereClause}
//     `;
//     summaryParams = [...summaryParams];
//   } else if (role === 5 || role === 6) { // Retailer
//     summaryQuery = `
//       SELECT 
//       COUNT(*) as total_recharges,
//       SUM(r.amount) as total_amount,
//       SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
//       SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
//       SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed_recharges,
//       SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END) as failed_amount,
//       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
//       SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
//       SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
//       SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
//       SUM(r.com_retailer) as total_earnings
//       FROM recharges r
//       JOIN keywords k ON r.keyword_id = k.id
//       JOIN operators o ON k.operator_id = o.id
//       WHERE r.user_id = ?  ${summaryWhereClause}
//     `;
//     summaryParams = [userId, ...summaryParams];
//   } else { // Admin/Super Admin
//     summaryQuery = `
//       SELECT 
//       COUNT(*) as total_recharges,
//       SUM(r.amount) as total_amount,
//       SUM(CASE WHEN r.status = 'success' THEN 1 ELSE 0 END) as successful_recharges,
//       SUM(CASE WHEN r.status = 'success' THEN r.amount ELSE 0 END) as successful_amount,
//       SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed_recharges,
//       SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END) as failed_amount,
//       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as pending_recharges,
//       SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END) as pending_amount,
//       SUM(CASE WHEN r.status = 'initiated' THEN 1 ELSE 0 END) as initiated_recharges,
//       SUM(CASE WHEN r.status = 'initiated' THEN r.amount ELSE 0 END) as initiated_amount,
//       SUM(r.com_admin) as total_earnings
//       FROM recharges r
//       JOIN keywords k ON r.keyword_id = k.id
//       JOIN operators o ON k.operator_id = o.id
//       WHERE 1=1 ${summaryWhereClause}
//     `;
//     summaryParams = [...summaryParams];
//   }

//   const [summaryResult] = await db.execute(summaryQuery, summaryParams);

//   // Show summary as "count (sum of amount)" for each status
//   const summary = {
//     total_recharges: `${summaryResult[0].total_recharges || 0} (${parseFloat(summaryResult[0].total_amount || 0).toFixed(2)})`,
//     successful_recharges: `${summaryResult[0].successful_recharges || 0} (${parseFloat(summaryResult[0].successful_amount || 0).toFixed(2)})`,
//     failed_recharges: `${summaryResult[0].failed_recharges || 0} (${parseFloat(summaryResult[0].failed_amount || 0).toFixed(2)})`,
//     pending_recharges: `${summaryResult[0].pending_recharges || 0} (${parseFloat(summaryResult[0].pending_amount || 0).toFixed(2)})`,
//     initiated_recharges: `${summaryResult[0].initiated_recharges || 0} (${parseFloat(summaryResult[0].initiated_amount || 0).toFixed(2)})`,
//     total_earnings: parseFloat(summaryResult[0].total_earnings || 0).toFixed(2),
//   };


//   return { recharges, total , summary };
// }








module.exports = {
  getHistory,
  getPurchasesReports,
  getRecents,
  getEarnings,
  getPurchasesReportsOnline,
};
