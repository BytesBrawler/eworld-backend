const { createModuleLogger } = require('../utils/logger');

const logger = createModuleLogger('request-middleware');

// Helper function to sanitize sensitive data
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = ['password', 'token', 'authorization', 'cookie'];
  const phoneFields = [];
  
  const sanitized = { ...data };
  
  // Mask sensitive authentication data
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***HIDDEN***';
    }
  });
  
  // Partially mask phone numbers (show first 4 digits)
  phoneFields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string' && sanitized[field].length > 4) {
      sanitized[field] = sanitized[field].substring(0, 4) + '****';
    }
  });
  
  return sanitized;
};

// Middleware to log all incoming requests and outgoing responses
const requestResponseLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Generate unique request ID for tracking
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log incoming request
  logger.info({
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id,
    headers: {
      'content-type': req.get('Content-Type'),
      'user-agent': req.get('User-Agent'),
      'accept': req.get('Accept')
    },
    query: sanitizeData(req.query),
    body: sanitizeData(req.body),
    timestamp: new Date().toISOString()
  }, '📥 INCOMING REQUEST');

  // Capture original res.json method
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Override res.json to log response
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      userId: req.user?.id,
      duration: `${duration}ms`,
      responseData: sanitizeData(data),
      timestamp: new Date().toISOString()
    }, '📤 OUTGOING RESPONSE');
    
    return originalJson.call(this, data);
  };
  
  // Override res.send to log response
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      userId: req.user?.id,
      duration: `${duration}ms`,
      responseSize: Buffer.byteLength(data || '', 'utf8'),
      timestamp: new Date().toISOString()
    }, '📤 OUTGOING RESPONSE (SEND)');
    
    return originalSend.call(this, data);
  };
  
  // Log when request finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id
    }, '✅ REQUEST COMPLETED');
  });
  
  // Log if request errors
  res.on('error', (err) => {
    const duration = Date.now() - startTime;
    
    logger.error({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      duration: `${duration}ms`,
      userId: req.user?.id,
      err: err
    }, '❌ REQUEST ERROR');
  });
  
  next();
};

module.exports = {
  requestResponseLogger,
  sanitizeData
};