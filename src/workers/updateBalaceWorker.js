
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const db = require('../db');
const {dynamicRechargeCall, responseCheck} = require('../controllers/dynamicrecharge');
const axios = require('axios');
const admin = require('firebase-admin');
const serviceAccount = require('../utils/serviceAccountKey.json');
const { Queue } = require('bullmq');




// Enhanced logging function
const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
};

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Enhanced Redis connection with error handling
const connection = { 
  host: process.env.REDIS_HOST || '127.0.0.1', 
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 1,
  retryDelayOnFailover: 100,
  connectTimeout: 10000,
  lazyConnect: true,
  maxmemoryPolicy: 'noeviction'
};

if (process.env.REDIS_PASSWORD) {
  connection.password = process.env.REDIS_PASSWORD;
}

log('info', 'Redis connection config', connection);

// Create queues
const updateBalanceQueue = new Queue('updateLineBalanceJob', { connection });
const appNotificationQueue = new Queue('appNotificationJob', { connection });
const smsQueue = new Queue('smsMessageJob', { connection });
const bulkMessagingQueue = new Queue('bulkMessagingJob', { connection });


// Database connection pool monitoring
const monitorDatabaseConnections = async () => {
  try {
    // If you're using mysql2, you can check pool status
    if (db.pool) {
      const poolInfo = {
        totalConnections: db.pool.pool._allConnections.length,
        freeConnections: db.pool.pool._freeConnections.length,
        acquiringConnections: db.pool.pool._acquiringConnections.length
      };
      
      log('info', 'Database connection pool status', poolInfo);
      
      // Alert if pool is getting full
      if (poolInfo.freeConnections === 0) {
        log('warn', 'Database connection pool exhausted - all connections in use');
      }
    }
    
    // Check for long-running queries (if supported)
    try {
      const [processes] = await db.query(`
        SELECT COUNT(*) as active_queries, 
               AVG(TIME) as avg_query_time,
               MAX(TIME) as max_query_time
        FROM INFORMATION_SCHEMA.PROCESSLIST 
        WHERE COMMAND != 'Sleep' AND DB = DATABASE()
      `);
      
      if (processes[0]) {
        log('info', 'Database query statistics', processes[0]);
        
        if (processes[0].max_query_time > 30) {
          log('warn', 'Long-running queries detected', {
            maxQueryTime: processes[0].max_query_time,
            activeQueries: processes[0].active_queries
          });
        }
      }
    } catch (err) {
      // Ignore if we don't have permissions to check INFORMATION_SCHEMA
      log('debug', 'Could not check query statistics (permissions may be limited)');
    }
    
  } catch (error) {
    log('error', 'Database connection monitoring failed', error.message);
  }
};

// Enhanced monitoring with database health
const monitorQueuesWithDatabase = async () => {
  const memUsage = process.memoryUsage();
  
  // Check database health
  const dbHealth = await checkDatabaseHealth();
  
  log('info', 'System Resources & Database Health', {
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime())}s`,
    database: dbHealth
  });

  // Monitor database connections
  await monitorDatabaseConnections();

  // Continue with existing queue monitoring...
  for (const queue of queues) {
    try {
      const [waiting, active, failed, completed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getFailed(),
        queue.getCompleted()
      ]);
      
      log('info', `Queue ${queue.name} status`, {
        waiting: waiting.length,
        active: active.length,
        failed: failed.length,
        completed: completed.length
      });
      
      // Enhanced failed job analysis
      if (failed.length > 0) {
        log('warn', `Queue ${queue.name} has ${failed.length} failed jobs`);
        
        // Group failures by error type
        const failuresByError = {};
        failed.slice(0, 10).forEach(job => { // Check last 10 failed jobs
          const errorKey = job.failedReason || 'Unknown error';
          if (!failuresByError[errorKey]) {
            failuresByError[errorKey] = 0;
          }
          failuresByError[errorKey]++;
        });
        
        log('info', `Queue ${queue.name} failure analysis`, failuresByError);
        
        // Check for database-related failures
        const dbFailures = failed.filter(job => 
          job.failedReason && (
            job.failedReason.includes('Database') ||
            job.failedReason.includes('connection') ||
            job.failedReason.includes('ECONNREFUSED') ||
            job.failedReason.includes('timeout')
          )
        );
        
        if (dbFailures.length > 0) {
          log('error', `Queue ${queue.name} has ${dbFailures.length} database-related failures`, {
            examples: dbFailures.slice(0, 3).map(job => ({
              id: job.id,
              error: job.failedReason,
              attempts: job.attemptsMade
            }))
          });
        }
      }
      
      // Clean up old jobs
      await queue.clean(30000, 10, 'completed');
      await queue.clean(300000, 5, 'failed');
      
    } catch (error) {
      log('error', `Error monitoring queue ${queue.name}`, error.message);
    }
  }
};

// Replace the existing monitorQueues call with this enhanced version

const enhancedMonitorInterval = setInterval(monitorQueuesWithDatabase, 15000);
clearInterval(enhancedMonitorInterval); // Clear existing interval

// Update graceful shutdown to use new interval
const gracefulShutdown = async (signal) => {
  log('info', `Received ${signal}, shutting down gracefully...`);
  
  clearInterval(enhancedMonitorInterval);
  
  log('info', 'Closing workers...');
  await Promise.all(workers.map(worker => worker.close()));
  
  log('info', 'Closing queues...');
  await Promise.all(queues.map(queue => queue.close()));
  
  log('info', 'Graceful shutdown completed');
  process.exit(0);
};




const workers = [];

// Your existing worker for balance updates
const udpateBalanceWorker = new Worker('updateLineBalanceJob', async job => {
  const { lineId, keywordId, type } = job.data;
  let line = [];
  console.log("lineId", lineId);
  console.log(job.data);

  if (type === "single") {
    console.log("1");
    try {
      [line] = await db.query(
        `SELECT * FROM keyword_lines WHERE id = ? AND keyword_id = ?`,
        [lineId, keywordId]
      );
      console.log("line", line);
    } catch (error) {
      console.error("❌ DB Query Error:", error);
    }
    console.log("line", line);
  } else if (type === "keyword") {
    console.log("2");
    [line] = await db.query(`SELECT * FROM keyword_lines WHERE keyword_id = ?`, [keywordId]);
    console.log("line", line);
  } else if (type === "all") {
    console.log("3");
    [line] = await db.query(`SELECT * FROM keyword_lines`);
    console.log("line", line);
  }
  console.log("line", line);

  for (const lineItem of line) {
    const response = await dynamicRechargeCall(
      lineItem.api_provider,
      lineItem.balance_check_api,
      { opcode: lineItem.merchant_code }
    );

    if (
      response.status === "error" ||
      response.status === "failed" ||
      !response.filters.bal
    ) continue;

    let balanceValue = response.filters.bal;
    // Handle case where balance is an object with multiple values
    if (typeof balanceValue === 'object' && balanceValue !== null) {
      balanceValue = Object.values(balanceValue).reduce((sum, val) => {
        const numVal = parseFloat(val);
        return sum + (isNaN(numVal) ? 0 : numVal);
      }, 0);
    }

    const finalBalance = parseFloat(balanceValue) || 0;

    await db.query(
      `UPDATE kl_financials SET balance = ? WHERE kl_id = ?`,
      [finalBalance, lineItem.id]
    );
  }
}, { connection });

workers.push(udpateBalanceWorker);

// Enhanced SMS worker with robust database connection handling
const smsWorker = new Worker('smsMessageJob', async job => {
  const jobStartTime = Date.now();
  const jobId = job.id;
  
  log('info', `SMS Job ${jobId} started`, job.data);
  
  // Declare userMobile at the top of the function scope
  let userMobile = null;
  let dbConnectionStatus = 'unknown';
  
  try {
    const { userId, message, mobile, phoneNumber } = job.data;
    
    // Validate required data
    if (!message) {
      throw new Error("Message is required");
    }
    
    // Phone number lookup with database connection retry logic
    userMobile = mobile || phoneNumber;
    
    if (!userMobile && userId) {
      log('info', `Looking up phone number for user ${userId}`);
      
      // Test database connection first
      try {
        const [connectionTest] = await db.query("SELECT 1 as test");
        dbConnectionStatus = connectionTest ? 'connected' : 'disconnected';
        log('info', `Database connection test: ${dbConnectionStatus}`);
      } catch (connError) {
        dbConnectionStatus = 'failed';
        log('error', `Database connection test failed: ${connError.message}`);
        throw new Error(`Database connection failed: ${connError.message}`);
      }
      
      // Retry logic for user lookup
      let userRows = null;
      let attempts = 0;
      const maxAttempts = 1;
      
      while (attempts < maxAttempts && !userRows) {
        attempts++;
        try {
          log('info', `Database lookup attempt ${attempts}/${maxAttempts} for user ${userId}`);
          
          [userRows] = await db.query(
            "SELECT mobile FROM users WHERE id = ?",
            [userId]
          );
          
          log('info', `Database lookup successful on attempt ${attempts}`, {
            userId,
            rowsFound: userRows ? userRows.length : 0
          });
          
          break; // Success, exit retry loop
          
        } catch (dbError) {
          log('error', `Database lookup attempt ${attempts} failed for user ${userId}`, {
            error: dbError.message,
            code: dbError.code,
            errno: dbError.errno
          });
          
          if (attempts === maxAttempts) {
            throw new Error(`Database lookup failed after ${maxAttempts} attempts: ${dbError.message}`);
          }
          
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s
          log('info', `Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Validate user lookup results
      if (!userRows || userRows.length === 0) {
        throw new Error(`User with ID ${userId} not found in database after ${attempts} attempts`);
      }
      
      const userData = userRows[0];
      if (!userData || !userData.mobile) {
        throw new Error(`No mobile number found for user ${userId} - user exists but mobile field is empty`);
      }
      
      userMobile = userData.mobile;
      log('info', `Successfully found phone number for user ${userId}: ${userMobile}`);
    }
    
    // Final validation
    if (!userMobile) {
      throw new Error("Phone number is required - no mobile/phoneNumber provided in job data and no userId for lookup");
    }
    
    // Validate phone number format
    const cleanedMobile = userMobile.toString().replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(cleanedMobile)) {
      log('warn', `Potentially invalid phone number format: ${userMobile}`);
    }
    
    log('info', `Using phone number: ${userMobile} for job ${jobId}`);
    
    // Get SMS API with database retry logic
    log('info', `Fetching SMS API for job ${jobId}`);
    let apiRows = null;
    let apiAttempts = 0;
    const maxApiAttempts = 1;
    
    while (apiAttempts < maxApiAttempts && !apiRows) {
      apiAttempts++;
      try {
        log('info', `API lookup attempt ${apiAttempts}/${maxApiAttempts}`);
        
        [apiRows] = await db.query(
          "SELECT * FROM apis WHERE type = ? AND status = 1 ORDER BY id ASC LIMIT 1",
          ["message"]
        );
        
        break; // Success
        
      } catch (apiError) {
        log('error', `API lookup attempt ${apiAttempts} failed`, {
          error: apiError.message,
          code: apiError.code
        });
        
        if (apiAttempts === maxApiAttempts) {
          throw new Error(`SMS API lookup failed after ${maxApiAttempts} attempts: ${apiError.message}`);
        }
        
        // Wait before retry
        const delay = Math.pow(2, apiAttempts) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!apiRows || apiRows.length === 0) {
      throw new Error('No active message API found in database');
    }

    const api = apiRows[0];
    log('info', `Using SMS API: ${api.id} - ${api.request_url_endpoint}`);

    // Build API request (same as before)
    let apiUrl = api.request_url_endpoint;
    apiUrl = apiUrl.replace("[message]", encodeURIComponent(message));
    apiUrl = apiUrl.replace("[mobile]", userMobile);

    const config = {
      method: api.request_type.toLowerCase(),
      url: apiUrl,
      timeout: (api.timeout_seconds * 1000) || 30000
    };

    // Add headers
    if (api.headers && api.headers !== "{}") {
      try {
        config.headers = JSON.parse(api.headers);
      } catch (err) {
        log('warn', `Error parsing API headers for job ${jobId}`, err.message);
      }
    }

    // Add body params for POST
    if (api.request_type.toLowerCase() === "post" && api.body_params) {
      try {
        let bodyParams = JSON.parse(api.body_params);
        Object.keys(bodyParams).forEach((key) => {
          if (typeof bodyParams[key] === "string") {
            bodyParams[key] = bodyParams[key]
              .replace("[message]", message)
              .replace("[mobile]", userMobile);
          }
        });
        config.data = bodyParams;
      } catch (err) {
        log('warn', `Error parsing body params for job ${jobId}`, err.message);
      }
    }

    // Add query params
    if (api.query_params) {
      try {
        let queryParams = JSON.parse(api.query_params);
        Object.keys(queryParams).forEach((key) => {
          if (typeof queryParams[key] === "string") {
            queryParams[key] = queryParams[key]
              .replace("[message]", message)
              .replace("[mobile]", userMobile);
          }
        });
        config.params = queryParams;
      } catch (err) {
        log('warn', `Error parsing query params for job ${jobId}`, err.message);
      }
    }

    log('info', `SMS API config for job ${jobId}`, {
      method: config.method,
      url: config.url,
      timeout: config.timeout,
      hasHeaders: !!config.headers,
      hasBody: !!config.data,
      hasParams: !!config.params
    });

    // Make API call with timing
    const apiStartTime = Date.now();
    let response;
    let responseCheckData;
    
    try {
      response = await axios(config);
      const apiDuration = Date.now() - apiStartTime;
      log('info', `SMS API call completed for job ${jobId} in ${apiDuration}ms`, {
        status: response.status,
        statusText: response.statusText
      });
      
      responseCheckData = await responseCheck(api, response);
      log('info', `Response check for job ${jobId}`, responseCheckData);
      
    } catch (error) {
      const apiDuration = Date.now() - apiStartTime;
      log('error', `SMS API call failed for job ${jobId} after ${apiDuration}ms`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      response = error.response || { data: { error: error.message } };
      responseCheckData = { status: "failed", message: error.message };
    }

    // Database record with retry logic
    if (userId) {
      const dbStartTime = Date.now();
      let dbAttempts = 0;
      const maxDbAttempts = 1;
      let dbSuccess = false;
      
      while (dbAttempts < maxDbAttempts && !dbSuccess) {
        dbAttempts++;
        try {
          log('info', `Database insert attempt ${dbAttempts}/${maxDbAttempts} for job ${jobId}`);
          await db.query(
            "UPDATE messages SET response = ?, status = ? WHERE user_id = ? AND message = ? AND type = ?",
            [JSON.stringify(response.data), responseCheckData.status === "success", userId, message , "number"]
          );
          
          dbSuccess = true;
          const dbDuration = Date.now() - dbStartTime;
          log('info', `Database record saved for job ${jobId} in ${dbDuration}ms on attempt ${dbAttempts}`);
          
        } catch (dbError) {
          log('error', `Database insert attempt ${dbAttempts} failed for job ${jobId}`, {
            error: dbError.message,
            code: dbError.code
          });
          
          if (dbAttempts === maxDbAttempts) {
            log('error', `Database insert failed after ${maxDbAttempts} attempts for job ${jobId}`, dbError.message);
            // Continue with job - don't fail just because DB insert failed
          } else {
            // Wait before retry
            const delay = Math.pow(2, dbAttempts) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    const isSuccess = responseCheckData.status === "success";
    const totalDuration = Date.now() - jobStartTime;
    
    if (!isSuccess) {
      log('error', `SMS job ${jobId} failed after ${totalDuration}ms`, {
        reason: responseCheckData.message,
        userId,
        mobile: userMobile,
        dbConnectionStatus
      });
      throw new Error(`SMS sending failed: ${responseCheckData.message || 'Unknown error'}`);
    }

    log('info', `SMS job ${jobId} completed successfully in ${totalDuration}ms`, {
      userId,
      mobile: userMobile,
      dbConnectionStatus
    });

    return {
      success: true,
      phoneNumber: userMobile,
      userId,
      duration: totalDuration,
      message: "SMS sent successfully",
      apiResponse: response.data,
      dbConnectionStatus
    };
    
  } catch (error) {
    const totalDuration = Date.now() - jobStartTime;
    log('error', `SMS job ${jobId} failed after ${totalDuration}ms`, {
      error: error.message,
      stack: error.stack,
      data: job.data,
      userMobile: userMobile,
      dbConnectionStatus
    });
    
    // Record failure in database with retry logic
    const { userId, message } = job.data;
    if (userId) {
      let dbAttempts = 0;
      const maxDbAttempts = 2; // Fewer attempts for error logging
      
      while (dbAttempts < maxDbAttempts) {
        dbAttempts++;
        try {
          await db.query(
            "UPDATE messages SET response = ?, status = ? WHERE user_id = ? AND message = ? AND type = ?",
            [
              JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString(),
                jobId: jobId,
                userMobile: userMobile,
                dbConnectionStatus
              }),
              false,
              userId,
              message,
              "number"
            ]
          );
          
          log('info', `Failure recorded in database for job ${jobId} on attempt ${dbAttempts}`);
          break;
          
        } catch (dbError) {
          log('error', `Failed to record failure in database for job ${jobId} (attempt ${dbAttempts})`, dbError.message);
          
          if (dbAttempts < maxDbAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }
    
    throw error;
  }
}, { 
  connection,
  concurrency: 1, // Reduced concurrency to avoid overwhelming DB
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1,
  }
});

workers.push(smsWorker);
// Enhanced App Notification Worker
const appWorker = new Worker('appNotificationJob', async job => {
  const jobStartTime = Date.now();
  const jobId = job.id;
  
  log('info', `App notification job ${jobId} started`, job.data);
  
  try {
    const { userId, message, title } = job.data;
    
    // Record message in database first
    const [result] = await db.query(
      "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
      [userId, message, "app"]
    );
    
    log('info', `Message recorded in database for job ${jobId}, message ID: ${result.insertId}`);
    
    // Get FCM tokens
    const [rows] = await db.query(
      "SELECT fbkey FROM user_logs WHERE user_id = ? AND action = ? AND created_at >= ? ORDER BY created_at DESC",
      [userId, "login", new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)]
    );
    
    log('info', `Found ${rows.length} device tokens for user ${userId}`);
    
    if (!rows.length) {
      const duration = Date.now() - jobStartTime;
      log('info', `App notification job ${jobId} completed in ${duration}ms - no active devices`);
      return {
        success: true,
        messageId: result.insertId,
        type: "app",
        duration,
        message: "In-app notification saved (no active devices found)"
      };
    }

    // Send notifications
    const tokens = rows.map((row) => row.fbkey);
    const messagePayload = {
      notification: {
        title: title || "MTC",
        body: message || "You have a new notification"
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        notification: {
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'high_importance_channel',
          title: title || "MTC",
          body: message || "You have a new notification"
        }
      }
    };

    const results = [];
    const invalidTokens = [];

    for (const token of tokens) {
      try {
        const response = await admin.messaging().send({
          ...messagePayload,
          token: token
        });
        results.push({ token, success: true, messageId: response });
        log('debug', `FCM sent successfully to token for job ${jobId}`);
      } catch (error) {
        log('warn', `FCM failed for token in job ${jobId}`, error.code);
        
        if (error.errorInfo && error.errorInfo.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(token);
        }
        results.push({ token, success: false, error: error.code });
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      try {
        await db.query(
          "DELETE FROM user_logs WHERE fbkey IN (?) AND user_id = ? AND action = ?",
          [invalidTokens, userId, "login"]
        );
        log('info', `Cleaned up ${invalidTokens.length} invalid tokens for user ${userId}`);
      } catch (err) {
        log('error', `Error cleaning up invalid tokens for job ${jobId}`, err.message);
      }
    }

    const duration = Date.now() - jobStartTime;
    const successCount = results.filter(r => r.success).length;
    
    log('info', `App notification job ${jobId} completed in ${duration}ms`, {
      deliveryAttempts: tokens.length,
      successful: successCount,
      failed: tokens.length - successCount
    });

    return {
      success: true,
      messageId: result.insertId,
      deliveryAttempts: tokens.length,
      successfulDeliveries: successCount,
      duration,
      message: "In-app notification processed successfully"
    };
    
  } catch (error) {
    const duration = Date.now() - jobStartTime;
    log('error', `App notification job ${jobId} failed after ${duration}ms`, {
      error: error.message,
      stack: error.stack,
      data: job.data
    });
    throw error;
  }
}, { 
  connection,
  concurrency: 3, // Reduced for debugging
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1,
  }
});

workers.push(appWorker);

// Enhanced queue monitoring
const queues = [appNotificationQueue, smsQueue];

queues.forEach((queue) => {
  const queueName = queue.name;
  
  queue.on('failed', (job, err) => {
    log('error', `Queue ${queueName} - Job ${job.id} failed`, {
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      error: err.message,
      data: job.data
    });
  });

  queue.on('stalled', (job) => {
    log('warn', `Queue ${queueName} - Job ${job.id} stalled`, {
      attempts: job.attemptsMade,
      data: job.data
    });
  });

  queue.on('completed', (job, result) => {
    log('info', `Queue ${queueName} - Job ${job.id} completed`, {
      duration: result?.duration || 'unknown',
      attempts: job.attemptsMade
    });
  });

  queue.on('active', (job) => {
    log('debug', `Queue ${queueName} - Job ${job.id} started processing`);
  });

  queue.on('waiting', (job) => {
    log('debug', `Queue ${queueName} - Job ${job.id} added to queue`);
  });
});
  
  const checkDatabaseHealth = async () => {
  try {
    const startTime = Date.now();
    const [result] = await db.query("SELECT 1 as health_check, NOW() as server_time");
    const duration = Date.now() - startTime;
    
    log('info', 'Database health check passed', {
      duration: `${duration}ms`,
      serverTime: result[0]?.server_time
    });
    
    return { healthy: true, duration, serverTime: result[0]?.server_time };
    
  } catch (error) {
    log('error', 'Database health check failed', {
      error: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState
    });
    
    return { healthy: false, error: error.message, code: error.code };
  }
};


log('info', 'Enhanced debug workers started successfully');

//// Graceful shutdown
//const gracefulShutdown = async (signal) => {
  //log('info', `Received ${signal}, shutting down gracefully...`);
  
 // clearInterval(monitorInterval);
  
 // log('info', 'Closing workers...');
 // await Promise.all(workers.map(worker => worker.close()));
  
 // log('info', 'Closing queues...');
  //await Promise.all(queues.map(queue => queue.close()));
  
  //log('info', 'Graceful shutdown completed');
 // process.exit(0);
//};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught Exception', {
    message: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
});
