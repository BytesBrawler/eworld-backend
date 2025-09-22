const pino = require('pino');
const path = require('path');

// Helper functions for beautiful logging
const maskMobile = (mobile) => {
  if (!mobile || mobile.length < 10) return mobile;
  return mobile;
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

// Simple development logger that works differently
const createDevelopmentLogger = () => {
  // Use simple console logging in development with emojis
  return {
    trace: (msg, data) => console.log(`🔍 TRACE: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    debug: (msg, data) => console.log(`🐛 DEBUG: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    info: (msg, data) => console.log(`✅ INFO:  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    warn: (msg, data) => console.warn(`⚠️  WARN:  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    error: (msg, data) => console.error(`❌ ERROR: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    fatal: (msg, data) => console.error(`💥 FATAL: ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    
    // Custom business methods
    api: (msg, data) => console.log(`📡 API:   ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    recharge: (msg, data) => console.log(`💳 RECH:  ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    payment: (msg, data) => console.log(`💰 PAY:   ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
    
    // Child logger
    child: (context) => {
      const prefix = context.module ? `[${context.module}] ` : '';
      return {
        trace: (msg, data) => console.log(`🔍 TRACE: ${prefix}${msg}`, data ? JSON.stringify(data, null, 2) : ''),
        debug: (msg, data) => console.log(`🐛 DEBUG: ${prefix}${msg}`, data ? JSON.stringify(data, null, 2) : ''),
        info: (msg, data) => console.log(`✅ INFO:  ${prefix}${msg}`, data ? JSON.stringify(data, null, 2) : ''),
        warn: (msg, data) => console.warn(`⚠️  WARN:  ${prefix}${msg}`, data ? JSON.stringify(data, null, 2) : ''),
        error: (msg, data) => console.error(`❌ ERROR: ${prefix}${msg}`, data ? JSON.stringify(data, null, 2) : ''),
        fatal: (msg, data) => console.error(`💥 FATAL: ${prefix}${msg}`, data ? JSON.stringify(data, null, 2) : '')
      };
    }
  };
};

// Create production logger with file outputs
const createProductionLogger = () => {
  const logDir = path.join(__dirname, '../../logs');
  require('fs').mkdirSync(logDir, { recursive: true });

  const rotationOptions = {
    size: process.env.LOG_MAX_SIZE || '10M',
    frequency: process.env.LOG_FREQUENCY || 'daily',
    retentionCount: parseInt(process.env.LOG_RETENTION_COUNT) || 7,
    compress: process.env.LOG_COMPRESS !== 'false'
  };

  return pino({
    level: process.env.LOG_LEVEL || 'info',
    customLevels: {
      api: 25,
      recharge: 35,
      payment: 45
    },
    useOnlyCustomLevels: false,
    base: {
      pid: process.pid,
      hostname: require('os').hostname(),
      service: 'eworld-backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production'
    },
    sync: false,
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
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
        body: req.body ? sanitizeLogData(req.body) : undefined
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length')
        }
      }),
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
    },
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: 1 },
          level: 'info'
        },
        {
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'combined.log'),
            ...rotationOptions
          },
          level: 'debug'
        },
        {
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'error.log'),
            ...rotationOptions
          },
          level: 'error'
        },
        {
          target: 'pino-roll',
          options: {
            file: path.join(logDir, 'business.log'),
            ...rotationOptions
          },
          level: 'info'
        },
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

// Create logger based on environment
const createLogger = () => {
  const isProduction = process.env.NODE_ENV === 'PRODUCTION';
  
  if (isProduction) {
    return createProductionLogger();
  } else {
    return createDevelopmentLogger();
  }
};

// Create the logger instance
const logger = createLogger();

// Create child loggers for different modules
const createModuleLogger = (module) => {
  return logger.child({ module });
};

// Helper methods for common logging patterns
const logRequest = (req, message = 'Request received') => {
  logger.info(`📥 INCOMING REQUEST: ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    ip: req.ip || req.connection?.remoteAddress,
    headers: req.headers,
    query: req.query,
    body: sanitizeLogData(req.body)
  });
};

const logResponse = (req, res, duration, message = 'Request completed') => {
  const statusIcon = res.statusCode >= 400 ? '❌' : '✅';
  logger.info(`📤 OUTGOING RESPONSE: ${statusIcon} ${res.statusCode}`, {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.user?.id
  });
};

const logError = (error, context = {}) => {
  logger.error(`💥 ERROR: ${error.message}`, {
    error: error.message,
    stack: error.stack,
    code: error.code,
    ...context
  });
};

const logDbQuery = (query, duration, results) => {
  logger.debug(`🗄️  DATABASE: ${query}`, {
    query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
    duration: `${duration}ms`,
    resultCount: Array.isArray(results) ? results.length : 1
  });
};

const logApiCall = (method, url, data, response, duration) => {
  logger.api(`📡 API CALL: ${method} ${url}`, {
    method,
    url,
    requestData: sanitizeLogData(data),
    responseStatus: response?.status,
    duration: `${duration}ms`
  });
};

const logApiCallDetailed = (method, url, requestData, responseData, duration, context = {}) => {
  const success = responseData?.status >= 200 && responseData?.status < 300;
  if (success) {
    logger.api(`📡 API CALL SUCCESS: ${method} ${url}`, {
      method,
      url,
      requestData: sanitizeLogData(requestData),
      responseData: sanitizeLogData(responseData),
      duration: `${duration}ms`,
      ...context
    });
  } else {
    logger.error(`📡 API CALL FAILED: ${method} ${url}`, {
      method,
      url,
      requestData: sanitizeLogData(requestData),
      responseData: sanitizeLogData(responseData),
      duration: `${duration}ms`,
      ...context
    });
  }
};

const logBusinessOperation = (operation, status, data) => {
  const statusIcon = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏳';
  logger.recharge(`🏢 BUSINESS ${statusIcon}: ${operation}`, {
    operation,
    status,
    ...sanitizeLogData(data)
  });
};

const logFinancialOperation = (type, amount, userId, transactionId, context = {}) => {
  const typeIcon = type === 'credit' ? '💵' : '💸';
  logger.payment(`💰 FINANCIAL ${typeIcon}: ${type}`, {
    type,
    amount,
    userId,
    transactionId,
    ...context
  });
};

const logRechargeStep = (step, status, mobile, context = {}) => {
  const stepIcons = {
    validation: '🔍',
    api_call: '📡',
    processing: '⚙️',
    completion: '✅',
    failure: '❌'
  };
  
  logger.recharge(`🔄 RECHARGE ${stepIcons[step] || '📋'}: ${step}`, {
    step,
    status,
    mobile: maskMobile(mobile),
    ...context
  });
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
  logRechargeStep
};