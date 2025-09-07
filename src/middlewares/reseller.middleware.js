// middlewares/auth.middleware.js

const asyncHandler = require("../utils/asyncHandler");
const db = require("../db");


const verifyReseller = asyncHandler(async (req, res, next) => {
    const key =
      req.query.key ||
      req.body.key ||
      req.headers["x-api-key"] ||
      req.cookies.key;
    console.log(key);
  
    if (!key) {
      return res.status(401).json({
        status: "failed",
        message: "API key is missing"
      });
    }
  
    const [[tokenData]] = await db.query(
      `SELECT u.status, u.role_id, u.parent_id, u.balance, u.id as user_id
       FROM users as u
       WHERE api_key = ?`,
      [key]
    );
  
    if (!tokenData) {
      return res.status(401).json({
        status: "failed",
        message: "Invalid API key"
      });
    }
  
    if (tokenData.status !== "active") {
      return res.status(401).json({
        status: "failed",
        message: "Account is inactive"
      });
    }
  
    // Get IP from request (handles proxies and direct)
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection.remoteAddress;

      console.log("clientIp", clientIp);
  
    // Check if the IP exists and is active in reseller_ip table
    const [[ipMatch]] = await db.query(
      `SELECT * FROM reseller_ips WHERE user_id = ? AND ip = ? AND status = 'active'`,
      [tokenData.user_id, clientIp]
    );

    console.log("ipMatch", ipMatch);
  
    if (!ipMatch) {
      return res.status(403).json({
        status: "failed",
        message: "Unauthorized IP address"
      });
    }
  
    // Attach user info to request
    req.user = {
      id: tokenData.user_id,
      parent: tokenData.parent_id,
      role: tokenData.role_id,
      balance: tokenData.balance
    };
  
    next();
  });
  

module.exports = verifyReseller;
