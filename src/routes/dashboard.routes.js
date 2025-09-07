// routes/auth.routes.js
const { Router } = require("express");
const controller = require("../controllers/dashboard.controller.js");
const verifyAuth = require("../middlewares/auth.middleware.js");
const db = require("../db");

const router = Router();

router.route("/").post(verifyAuth, controller.dashboardData);



// Get dashboard statistics
router.route("/stats").get( verifyAuth, async (req, res) => {
    console.log("Dashboard stats endpoint hit");
  try {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const pool = db;
    
    // Get user information
    const [userInfo] = await pool.query(
      'SELECT balance, role_id FROM users WHERE id = ?',
      [userId]
    );
    
    // Get today's recharges count and total amount
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let rechargeQuery = 'SELECT COUNT(*) as count, SUM(amount) as amount FROM recharges WHERE created_at >= ?';
    const queryParams = [today];
    
    // For different roles, filter by appropriate user hierarchy
    if (roleId > 2) { // Not Super Admin or Admin
      rechargeQuery += ' AND (user_id = ? OR parent_id = ? OR superparent_id = ?)';
      queryParams.push(userId, userId, userId);
    }
    
    const [todayRecharges] = await pool.query(rechargeQuery, queryParams);
    
    // Get pending recharges count
    let pendingQuery = 'SELECT COUNT(*) as count FROM recharges WHERE status = "pending"';
    if (roleId > 2) {
      pendingQuery += ' AND (user_id = ? OR parent_id = ? OR superparent_id = ?)';
      queryParams.splice(1); // Keep only the first parameter (today)
      queryParams.push(userId, userId, userId);
    }
    
    const [pendingRecharges] = await pool.query(pendingQuery, queryParams);
    
    // Get recent transactions
    let recentQuery = 'SELECT r.id, r.account, r.number, r.amount, r.status, r.created_at, ' +
                      'u.person as user_name, k.description as service ' +
                      'FROM recharges r ' +
                      'JOIN users u ON r.user_id = u.id ' +
                      'JOIN keywords k ON r.keyword_id = k.id ' +
                      'WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
    
    if (roleId > 2) {
      recentQuery += ' AND (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)';
      queryParams.splice(1); // Keep only the first parameter (today)
      queryParams.push(userId, userId, userId);
    }
    
    recentQuery += ' ORDER BY r.created_at DESC LIMIT 10';
    
    const [recentTransactions] = await pool.query(recentQuery, queryParams);
    
    // Get recharge statistics by status
    let statusQuery = 'SELECT status, COUNT(*) as count, SUM(amount) as amount ' +
                      'FROM recharges WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    
    if (roleId > 2) {
      statusQuery += ' AND (user_id = ? OR parent_id = ? OR superparent_id = ?)';
      queryParams.splice(1); // Keep only the first parameter (today)
      queryParams.push(userId, userId, userId);
    }
    
    statusQuery += ' GROUP BY status';
    
    const [statusStats] = await pool.query(statusQuery, queryParams);
    
    // Get keyword performance data for charts
    let keywordQuery = 'SELECT k.description, COUNT(r.id) as count, SUM(r.amount) as amount ' +
                       'FROM recharges r ' +
                       'JOIN keywords k ON r.keyword_id = k.id ' +
                       'WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    
    if (roleId > 2) {
      keywordQuery += ' AND (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)';
      queryParams.splice(1);
      queryParams.push(userId, userId, userId);
    }
    
    keywordQuery += ' GROUP BY r.keyword_id ORDER BY amount DESC LIMIT 10';
    
    const [keywordStats] = await pool.query(keywordQuery, queryParams);
    
    // Get daily transaction data for trend chart
    let dailyQuery = 'SELECT DATE(created_at) as date, COUNT(*) as count, SUM(amount) as amount ' +
                     'FROM recharges WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    
    if (roleId > 2) {
      dailyQuery += ' AND (user_id = ? OR parent_id = ? OR superparent_id = ?)';
      queryParams.splice(1);
      queryParams.push(userId, userId, userId);
    }
    
    dailyQuery += ' GROUP BY DATE(created_at) ORDER BY date';
    
    const [dailyStats] = await pool.query(dailyQuery, queryParams);
    
    // For Admin and Super Admin, get subordinate statistics
    let subordinateStats = [];
    if (roleId <= 2) { // Super Admin or Admin
      const [subordinates] = await pool.query(
        'SELECT role, COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id GROUP BY role'
      );
      subordinateStats = subordinates;
    }
    
   // await pool.end();

    console.log("Dashboard stats:", {
      balance: userInfo[0].balance,
      todayRecharges: {
        count: todayRecharges[0].count || 0,
        amount: todayRecharges[0].amount || 0
      },
      pendingRecharges: {
        count: pendingRecharges[0].count || 0
      },
      recentTransactions,
      statusStats,
      keywordStats,
      dailyStats,
      subordinateStats
    });
    
    res.json({
      success: true,
      data: {
        balance: userInfo[0].balance,
        todayRecharges: {
          count: todayRecharges[0].count || 0,
          amount: todayRecharges[0].amount || 0
        },
        pendingRecharges: {
          count: pendingRecharges[0].count || 0
        },
        recentTransactions,
        statusStats,
        keywordStats,
        dailyStats,
        subordinateStats
      }
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

// Get sales report by keywords
router.get('/sales-report', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const { startDate, endDate } = req.query;
    
    const pool = db;
    
    let query = 'SELECT k.description, k.code, o.name as operator, ' +
                'COUNT(r.id) as transaction_count, ' +
                'SUM(r.amount) as total_amount, ' +
                'SUM(CASE WHEN r.status = "success" THEN 1 ELSE 0 END) as success_count, ' +
                'SUM(CASE WHEN r.status = "failed" THEN 1 ELSE 0 END) as failed_count, ' +
                'SUM(CASE WHEN r.status = "pending" THEN 1 ELSE 0 END) as pending_count, ' +
                'SUM(CASE WHEN r.status = "success" THEN r.amount ELSE 0 END) as success_amount, ' +
                'SUM(CASE WHEN r.status = "success" THEN r.com_retailer ELSE 0 END) as retailer_commission, ' +
                'SUM(CASE WHEN r.status = "success" THEN r.com_parent ELSE 0 END) as parent_commission, ' +
                'SUM(CASE WHEN r.status = "success" THEN r.com_superparent ELSE 0 END) as superparent_commission, ' +
                'SUM(CASE WHEN r.status = "success" THEN r.com_admin ELSE 0 END) as admin_commission ' +
                'FROM recharges r ' +
                'JOIN keywords k ON r.keyword_id = k.id ' +
                'JOIN operators o ON k.operator_id = o.id ' +
                'WHERE r.created_at BETWEEN ? AND ?';
    
    const queryParams = [startDate || '1970-01-01', endDate || new Date()];
    
    if (roleId > 2) { // Not Super Admin or Admin
      query += ' AND (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)';
      queryParams.push(userId, userId, userId);
    }
    
    query += ' GROUP BY r.keyword_id ORDER BY total_amount DESC';
    
    const [salesReport] = await pool.query(query, queryParams);
    console.log( salesReport);
    
  //  await pool.end();
    
    res.json({
      success: true,
      data: salesReport
    });
    
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales report',
      error: error.message
    });
  }
});

// Get pending recharges
router.get('/pending-recharges', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    
    const pool =db;
    
    let query = 'SELECT r.id, r.account, r.number, r.amount, r.created_at, ' +
                'r.txnid, r.reqid, r.retry_count, r.message, ' +
                'u.person as user_name, u.mobile as user_mobile, ' +
                'k.description as service, o.name as operator ' +
                'FROM recharges r ' +
                'JOIN users u ON r.user_id = u.id ' +
                'JOIN keywords k ON r.keyword_id = k.id ' +
                'JOIN operators o ON k.operator_id = o.id ' +
                'WHERE r.status = "pending"';
    
    const queryParams = [];
    
    if (roleId > 2) { // Not Super Admin or Admin
      query += ' AND (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)';
      queryParams.push(userId, userId, userId);
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    const [pendingRecharges] = await pool.query(query, queryParams);
    
   // await pool.end();
    
    res.json({
      success: true,
      data: pendingRecharges
    });
    
  } catch (error) {
    console.error('Pending recharges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending recharges',
      error: error.message
    });
  }
});

// Recharge retry endpoint
router.post('/retry-recharge/:id', verifyAuth, async (req, res) => {
  try {
    const rechargeId = req.params.id;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    
    const pool = mysql.db;
    
    // Check if the recharge is actually pending and user has permission
    let checkQuery = 'SELECT r.* FROM recharges r WHERE r.id = ? AND r.status = "pending"';
    
    if (roleId > 2) { // Not Super Admin or Admin
      checkQuery += ' AND (r.user_id = ? OR r.parent_id = ? OR r.superparent_id = ?)';
    }
    
    const checkParams = [rechargeId];
    if (roleId > 2) {
      checkParams.push(userId, userId, userId);
    }
    
    const [recharge] = await pool.query(checkQuery, checkParams);
    
    if (!recharge || recharge.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recharge not found or no permission to retry'
      });
    }
    
    // Here you would typically call your actual recharge processing service
    // For now, we'll just update the retry_count
    await pool.query(
      'UPDATE recharges SET retry_count = retry_count + 1 WHERE id = ?',
      [rechargeId]
    );
    
    // In a real implementation, this would trigger your recharge processing logic
    // processRecharge(rechargeId);
    
  //  await pool.end();
    
    res.json({
      success: true,
      message: 'Recharge retry initiated',
      data: {
        rechargeId
      }
    });
    
  } catch (error) {
    console.error('Recharge retry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry recharge',
      error: error.message
    });
  }
});



module.exports = router;