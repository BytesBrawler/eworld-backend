const pino = require('pino');
const path = require('path');

// Helper functions for beautiful logging
const maskMobile = (mobile) => {
  if (!mobile || mobile.length < 10) return mobile;
  return mobile.replace(/(\d{6})(\d{4})/, '$1****');
};

const sanitizeLogData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'pin', 'otp', 'token', 'secret', 'key', 'auth'];
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

const formatCurrency = (amount) => {
  if (!amount) return amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

// Create logger configuration based on environment
const createLogger = () => {
  const isProduction = process.env.NODE_ENV === 'PRODUCTION'; // Your .env uses 'PRODUCTION'
  
  // Base configuration with custom levels
  const baseConfig = {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    // Custom log levels for business operations
    customLevels: {
      api: 25,      // API calls and external requests
      recharge: 35, // Recharge operations
      payment: 45   // Payment and financial operations
    },
    useOnlyCustomLevels: false,
    // Add useful default fields
    base: {
      pid: process.pid,
      hostname: require('os').hostname(),
      service: 'eworld-backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    },
    // Async logging for better performance
    sync: false,
    // Beautiful timestamp format
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    // Custom serializers for better data representation
    serializers: {
      err: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'authorization': req.headers.authorization ? '[REDACTED]' : undefined
        },
        query: req.query,
        params: req.params,
        // Sanitize body data
        body: req.body ? sanitizeLogData(req.body) : undefined
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length')
        }
      }),
      // Custom serializers for business objects
      rechargeData: (data) => ({
        ...sanitizeLogData(data),
        mobile: data.mobile ? maskMobile(data.mobile) : undefined,
        amount: data.amount,
        operator: data.operator
      }),
      paymentData: (data) => ({
        ...sanitizeLogData(data),
        amount: data.amount,
        transactionId: data.transactionId,
        status: data.status
      })
    }
  };

  // Development configuration with enhanced debugging
  if (!isProduction) {
    return pino({
      ...baseConfig,
      level: 'trace', // Show all logs in development
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          colorizeObjects: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service,version,environment',
          messageFormat: '🌍 {msg}',
          customLevels: 'recharge:35,payment:45,api:25',
          customColors: 'recharge:blue,payment:green,api:cyan,trace:gray,debug:blue,info:green,warn:yellow,error:red,fatal:magenta',
          levelFirst: true,
          errorLikeObjectKeys: ['err', 'error'],
          messageKey: 'msg',
          levelKey: 'level',
          timestampKey: 'time',
          singleLine: false,
          hideObject: false
        }
      }
    });
  }

  // Production configuration with file outputs and rotation
  const logDir = path.join(__dirname, '../../logs');
  require('fs').mkdirSync(logDir, { recursive: true });

  // Log rotation configuration
  const rotationOptions = {
    size: process.env.LOG_MAX_SIZE || '10M',     // Max file size before rotation
    frequency: process.env.LOG_FREQUENCY || 'daily', // daily, hourly, or size-based
    retentionCount: parseInt(process.env.LOG_RETENTION_COUNT) || 7, // Keep 7 files
    compress: process.env.LOG_COMPRESS !== 'false' // Compress old files
  };

  return pino({
    ...baseConfig,
    transport: {
      targets: [
        // Beautiful console output for PM2/Docker logs
        {
          target: 'pino-pretty',
          options: {
            destination: 1, // stdout
            colorize: false, // No colors in production files but structured
            translateTime: 'SYS:dd/mm/yyyy HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageFormat: '🌍 [{service}] {msg}',
            singleLine: false,
            levelFirst: false,
            errorLikeObjectKeys: ['err', 'error']
          },
          level: 'info'
        },
        // Combined logs with rotation (structured JSON with enhanced fields)
        {
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'combined.log'),
            ...rotationOptions
          },
          level: 'debug'
        },
        // Error logs with rotation
        {
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'error.log'),
            ...rotationOptions
          },
          level: 'error'
        },
        // Business operations log
        {
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'business.log'),
            ...rotationOptions
          },
          level: 'info'
        },
        // API calls log
        {
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'api.log'),
            ...rotationOptions
          },
          level: 'info'
        }
      ]
    }
  });
};

// Create singleton logger instance
const logger = createLogger();

// Create child loggers for different modules
const createModuleLogger = (module) => {
  return logger.child({ module });
};

// Helper methods for common logging patterns
const logRequest = (req, message = 'Request received') => {
  logger.info({
    req: {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      ip: req.ip || req.connection.remoteAddress
    }
  }, message);
};

const logResponse = (req, res, duration, message = 'Request completed') => {
  logger.info({
    req: {
      method: req.method,
      url: req.url,
      userId: req.user?.id
    },
    res: {
      statusCode: res.statusCode
    },
    duration: `${duration}ms`
  }, message);
};

const logError = (error, context = {}) => {
  logger.error({
    err: error,
    ...context
  }, error.message || 'An error occurred');
};

const logDbQuery = (query, params, duration) => {
  logger.debug({
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    params,
    duration: `${duration}ms`
  }, 'Database query executed');
};

const logApiCall = (provider, endpoint, params, duration, response) => {
  logger.info({
    apiProvider: provider,
    endpoint,
    requestParams: params,
    duration: `${duration}ms`,
    responseStatus: response?.status || 'unknown',
    timestamp: new Date().toISOString()
  }, `🔄 API CALL: ${provider}`);
};

// Enhanced API call logging with full request/response data
const logApiCallDetailed = (provider, endpoint, requestData, responseData, duration, error = null) => {
  const logData = {
    apiProvider: provider,
    endpoint,
    requestData,
    responseData,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    success: !error
  };

  if (error) {
    logData.error = error.message || error;
    logger.error(logData, `❌ API CALL FAILED: ${provider} - ${endpoint}`);
  } else {
    logger.info(logData, `✅ API CALL SUCCESS: ${provider} - ${endpoint}`);
  }
};

// Business logic logging for important operations
const logBusinessOperation = (operation, data, userId = null) => {
  logger.info({
    operation,
    userId,
    data,
    timestamp: new Date().toISOString()
  }, `🏢 BUSINESS: ${operation}`);
};

// Balance and financial operations logging
const logFinancialOperation = (operation, userId, amount, balanceBefore, balanceAfter, transactionId = null) => {
  logger.info({
    operation,
    userId,
    amount: parseFloat(amount),
    balanceBefore: parseFloat(balanceBefore),
    balanceAfter: parseFloat(balanceAfter),
    transactionId,
    timestamp: new Date().toISOString()
  }, `💰 FINANCIAL: ${operation}`);
};

// Recharge lifecycle logging
const logRechargeStep = (step, rechargeData, additionalInfo = {}) => {
  logger.info({
    step,
    rechargeId: rechargeData.id,
    userId: rechargeData.userId,
    keywordId: rechargeData.keywordId,
    amount: rechargeData.amount,
    customerNumber: rechargeData.customerNumber?.substring(0, 4) + '****',
    status: rechargeData.status,
    ...additionalInfo,
    timestamp: new Date().toISOString()
  }, `🔄 RECHARGE: ${step}`);
};

// Beautiful logging helpers using custom levels
const logRechargeOperation = (message, data = {}) => {
  logger.recharge({
    operation: 'recharge',
    ...data,
    mobile: data.mobile ? maskMobile(data.mobile) : undefined,
    amount: data.amount ? formatCurrency(data.amount) : undefined,
    timestamp: new Date().toISOString()
  }, `💳 RECHARGE: ${message}`);
};

const logPaymentOperation = (message, data = {}) => {
  logger.payment({
    operation: 'payment',
    ...data,
    amount: data.amount ? formatCurrency(data.amount) : undefined,
    timestamp: new Date().toISOString()
  }, `💰 PAYMENT: ${message}`);
};

const logApiOperation = (message, data = {}) => {
  logger.api({
    operation: 'api',
    ...data,
    timestamp: new Date().toISOString()
  }, `📡 API: ${message}`);
};

// Beautiful success and error logging
const logSuccess = (message, data = {}) => {
  logger.info({
    status: 'success',
    ...data,
    timestamp: new Date().toISOString()
  }, `✅ SUCCESS: ${message}`);
};

const logFailure = (message, error, data = {}) => {
  logger.error({
    status: 'failure',
    error: error?.message || error,
    stack: error?.stack,
    ...data,
    timestamp: new Date().toISOString()
  }, `❌ FAILURE: ${message}`);
};

// Performance logging
const logPerformance = (operation, duration, data = {}) => {
  const level = duration > 5000 ? 'warn' : duration > 2000 ? 'info' : 'debug';
  logger[level]({
    operation,
    duration: `${duration}ms`,
    performance: duration > 5000 ? 'slow' : duration > 2000 ? 'medium' : 'fast',
    ...data,
    timestamp: new Date().toISOString()
  }, `⏱️  PERFORMANCE: ${operation} took ${duration}ms`);
};

module.exports = {
  logger,
  createModuleLogger,
  logRequest,
  logResponse,
  logError,
  logDbQuery,
  logApiCall,
  logApiCallDetailed,
  logBusinessOperation,
  logFinancialOperation,
  logRechargeStep,
  // Beautiful logging helpers
  logRechargeOperation,
  logPaymentOperation,
  logApiOperation,
  logSuccess,
  logFailure,
  logPerformance
};