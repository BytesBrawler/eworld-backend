const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const query = require("../db/queries.js");
const db = require("../db");

const dashboardData = asyncHandler(async (req, res) => {

const {lat , long , deviceInfo , token} = req.body;
  console.log("lat long", lat, long, deviceInfo , token);

  const [updateDatatoLogin] = await db.query(
    `Update user_logs set location = ? , extra = ? , fbkey = ? where user_id = ? and token = ?`,
    [JSON.stringify({ lat, long }),deviceInfo , token , req.user.id , req.user.token]
  );



  // if (!lat || !long || !deviceInfo) {
  //   throw new ApiError(400, "Some error Occured Try again");
  // }

  //role 1 is superadmin
  const getAllowedFunctionalities = await query.getAllowedFunctionalities(
    req.user.role
  );
  const getLatestNews = await query.getLatestNews(req.user.role);
  const getLatestImageNews = await query.getLatestImageNews(req.user.role);


  // const curDate = new Date().toISOString().split("T")[0];
  // const eDate = new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000)
  //   .toISOString()
  //   .split("T")[0];
 const now = new Date();

// Start of today: 00:00:00
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

// End of today: 23:59:59.999
const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

// Convert to 'YYYY-MM-DD HH:MM:SS' format
const formatDate = (date) =>
  date.toISOString().slice(0, 19).replace('T', ' ');

const eDate = formatDate(startOfToday); // e.g., '2025-06-24 00:00:00'
const curDate = formatDate(endOfToday); // e.g., '2025-06-24 23:59:59'




  let data;
  let extraData;

  const user = await query.getUserDetails(req.user.id);

  if (req.user.role === 1) {
    // Get daily transaction data for trend chart
    let dailyQuery =
      "SELECT DATE(created_at) as date, COUNT(*) as count, SUM(amount) as amount " +
      "FROM recharges WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";

    dailyQuery += " GROUP BY DATE(created_at) ORDER BY date";

    const [dailyStats] = await db.query(dailyQuery);


    let subordinateStats = [];
    // Super Admin or Admin
    const [subordinates] = await db.query(
      "SELECT role, COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id GROUP BY role"
    );
    subordinateStats = subordinates;

    const [[totalUsers]] = await db.query(
      `SELECT COUNT(*) as total FROM users WHERE status = 'active'`
    );
    const [[totalRecharges]] = await db.query(
    `SELECT COUNT(*) as totalCount, SUM(amount) as total_amount
FROM recharges
WHERE status = 'success'
  AND DATE(created_at) = CURDATE();
`,
   
  );

  //  const [[totalRecharges]] = await db.query(
  //    `SELECT COUNT(*) as totalCount, sum(amount) as total_amount FROM recharges WHERE status = 'success' and created_at BETWEEN ? AND ?`,
   //   [eDate, curDate]
   // );
 
  const [[totalPendingRecharges]] = await db.query(
    `SELECT COUNT(*) as totalCount, sum(amount)  as total_amount FROM recharges WHERE status = 'pending' AND created_at BETWEEN ? AND ?`,
    [eDate, curDate]
  );
  const [[totalBalanceTransactions]] = await db.query(
    `SELECT COUNT(*) as totalCount, sum(amount)  as total_amount FROM bal_transactions WHERE status = 'success' AND created_at BETWEEN ? AND ?`,
    [eDate, curDate]
  );

   const [settings] = await db.query(
      `SELECT Key_value, key_name FROM settings WHERE key_name = 'pending_time'`
    );

    const pendingTime = settings.find(setting => setting.key_name === 'pending_time');
    console.log("pendingTime", pendingTime);

    extraData = {
      totalUsers,
      totalRecharges,
      totalPendingRecharges,
      totalBalanceTransactions,
      dailyStats,
      subordinateStats,
      pendingTime: pendingTime ? pendingTime.Key_value : 60
    };
    data = {
      allowed: getAllowedFunctionalities,
      news: getLatestNews ?? "",
      alert: "",
      extraData,
      user,
      minAmount: 0,

      // totalBalance: await query.getTotalBalance()
    };


  } else if (req.user.role === 2) {
    let dailyQuery =
      "SELECT DATE(created_at) as date, COUNT(*) as count, SUM(amount) as amount " +
      "FROM recharges WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";

    dailyQuery += " GROUP BY DATE(created_at) ORDER BY date";

    const [dailyStats] = await db.query(dailyQuery);

    let subordinateStats = [];
    // Super Admin or Admin
    const [subordinates] = await db.query(
      "SELECT role, COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id GROUP BY role"
    );
    subordinateStats = subordinates;

   const  [[totalUsers]] = await db.query(
    `SELECT COUNT(*) as total FROM users WHERE status = 'active'`
  );

//   const [[totalRecharges]] = await db.query(
//     `SELECT COUNT(*) as totalCount, SUM(amount) as total_amount
// FROM recharges
// WHERE status = 'success'
//   AND DATE(created_at) = CURDATE();
// `,
   
//   );

const [[totalRecharges]] = await db.query(
    `SELECT COUNT(*) as totalCount, SUM(amount) as total_amount
FROM recharges
WHERE status = 'success'
  AND DATE(created_at) = CURDATE();
`,
   
  );
 
  const [[totalPendingRecharges]] = await db.query(
    `SELECT COUNT(*) as totalCount, sum(amount)  as total_amount FROM recharges WHERE status = 'pending' AND created_at BETWEEN ? AND ?`,
    [eDate, curDate]
  );
  const [[totalBalanceTransactions]] = await db.query(
    `SELECT COUNT(*) as totalCount, sum(amount)  as total_amount FROM bal_transactions WHERE status = 'success' AND DATE(created_at) = CURDATE()`,
    [eDate, curDate]
  );

   const [settings] = await db.query(
      `SELECT Key_value, key_name FROM settings WHERE key_name = 'pending_time'`
    );

    const pendingTime = settings.find(setting => setting.key_name === 'pending_time');
    console.log("pendingTime", pendingTime);

    extraData = {
      totalUsers,
      totalRecharges,
      totalPendingRecharges,
      totalBalanceTransactions,
      dailyStats,
      subordinateStats,
       pendingTime: pendingTime ? pendingTime.Key_value : 60
    };
 
    data = {
      allowed: getAllowedFunctionalities,
      news: getLatestNews,
      extraData,
      user,
      minAmount: 0

      // totalBalance: await query.getTotalBalance()
    };
  } else if (req.user.role === 3 || req.user.role === 4) {
    const  [[totalUsers]] = await db.query(
      `SELECT COUNT(*) as total FROM users WHERE status = 'active' and parent_id = ?`,
      [req.user.id]
    );




    const [[totalBalanceTransactions]] = await db.query(
      `SELECT COUNT(*) as totalCount, sum(amount)  as total_amount FROM bal_transactions WHERE  created_at BETWEEN ? AND ? and user_id = ?`,
      [eDate, curDate, req.user.id]
    );

    const [[totalEarning]] = await db.query(
      `SELECT
    SUM(
        CASE 
            WHEN parent_id = ? THEN com_parent 
            ELSE 0 
        END +
        CASE 
            WHEN superparent_id = ? THEN com_superparent 
            ELSE 0 
        END
    ) AS total_commission
FROM recharges
WHERE (parent_id = ? OR superparent_id = ?);
`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );
  

    extraData = {
      totalUsers,
      totalBalanceTransactions,
   totalEarning,
    };
    // const [[min_amount]] = await db.query(
    //   `SELECT Key_value FROM settings WHERE key_name = 'distributor_limit_minimum' `,

    // );
    const [settings] = await db.query(
      `SELECT Key_value, key_name FROM settings WHERE key_name IN ('retailer_limit_minimum', 'gateway_active')`
    );

    const min_amount = settings.find(setting => setting.key_name === 'retailer_limit_minimum');
    const gateway = settings.find(setting => setting.key_name === 'gateway_active');
    if(gateway.Key_value === '0'){
    user.isWalletAllowed =0;
    }

    data = {
      allowed: getAllowedFunctionalities,
      news: getLatestNews,
      images: getLatestImageNews,
      extraData,
      user,
      minAmount: min_amount.Key_value,

      // totalBalance: await query.getTotalBalance()
    };
  } else if (req.user.role === 6) {
    extraData = {
      totalUsers: await query.users({
        factor: "count",
        parent_id: req.user.id
      }),
      totalBalanceTransactions: await query.balTransactions({
        factor: "sum",
        status: "success",
        dates: [eDate, curDate],
        user_id: req.user.id
      }),
      totalTransactions: await query.transactions({
        factor: "sum",
        status: "success",
        dates: [eDate, curDate]
      })
    };
    // const [[min_amount]] = await db.query(
    //   `SELECT Key_value FROM settings WHERE key_name = 'retailer_limit_minimum' `,

    // );
    const [settings] = await db.query(
      `SELECT Key_value, key_name FROM settings WHERE key_name IN ('retailer_limit_minimum', 'gateway_active')`
    );

    const min_amount = settings.find(setting => setting.key_name === 'retailer_limit_minimum');
    const gateway = settings.find(setting => setting.key_name === 'gateway_active');
    if(gateway.Key_value === '0'){
    user.isWalletAllowed =0;
    }

    data = {
      allowed: getAllowedFunctionalities,
      news: getLatestNews,
      images: getLatestImageNews,
      extraData,
      user,
      minAmount: min_amount.Key_value,

      // totalBalance: await query.getTotalBalance()
    };
  } else if (req.user.role === 5) {
    const [settings] = await db.query(
      `SELECT Key_value, key_name FROM settings WHERE key_name IN ('retailer_limit_minimum', 'gateway_active')`
    );



    const min_amount = settings.find(setting => setting.key_name === 'retailer_limit_minimum');
    const gateway = settings.find(setting => setting.key_name === 'gateway_active');
    if(gateway.Key_value === '0'){
    user.isWalletAllowed =0;
    }

   

    data = {
      allowed: getAllowedFunctionalities,
      news: getLatestNews,
      // alert: getLatestAlert,
      user,
     minAmount: min_amount.Key_value,

      // totalBalance: await query.getTotalBalance()
    };
  }

  console.log(data);

  return res
    .status(200)
    .json(new ApiResponse(200, data, "Dashboard data fetched"));

  // const data = {
  //   totalUsers: await query.getTotalUsers(),
  //   totalWallets: await query.getTotalWallets(),
  //   totalTransactions: await query.getTotalTransactions(),
  //   totalBalance: await query.getTotalBalance()
  // };

  // res.status(200).json(new ApiResponse(200, data, "Dashboard data fetched"));
});

const getBalReport = asyncHandler(async (req, res) => {
  const transactions = await query.getBalanceReport(req.user.id);
  if (!transactions) throw new ApiError(404, "Balance Report not found");
  if (transactions.length === 0)
    throw new ApiError(404, "No Balance Report found");

  res
    .status(200)
    .json(new ApiResponse(200, transactions, "Balance Report fetched"));
});

module.exports = {
  dashboardData,
  getBalReport
};
