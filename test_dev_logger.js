#!/usr/bin/env node

/**
 * Development Logger Test
 * This script demonstrates the enhanced development logging
 */

// Set environment to development for testing
process.env.NODE_ENV = 'DEVELOPMENT';

const { 
  logger, 
  logBusinessOperation, 
  logApiCallDetailed, 
  logFinancialOperation, 
  logRechargeStep 
} = require('./src/utils/logger');

console.log('🧪 Testing Development Logger...\n');

// Test different log levels
logger.trace('🔍 Tracing database query execution');
logger.debug('🐛 Debugging user authentication flow');
logger.info('✅ Server started successfully on port 4000');
logger.warn('⚠️ High memory usage detected: 85%');
logger.error('❌ Failed to connect to external API', {
  error: new Error('Connection timeout'),
  endpoint: 'https://api.external.com',
  timeout: 5000
});

// Test business operations
console.log('\n--- Business Operations ---');
logBusinessOperation('recharge', 'success', {
  mobile: '9876543210',
  amount: 100,
  operator: 'Airtel',
  transactionId: 'TXN123456789',
  userId: 'user_123'
});

logBusinessOperation('payment', 'failed', {
  amount: 500,
  transactionId: 'PAY_FAILED_001',
  userId: 'user_456',
  error: 'Insufficient balance'
});

// Test API calls
console.log('\n--- API Calls ---');
logApiCallDetailed('POST', 'https://api.recharge.com/topup', {
  mobile: '9876543210',
  amount: 100
}, {
  status: 200,
  transactionId: 'EXT123456',
  balance: 45.50
}, 1250, {
  requestId: 'req_dev_001',
  operation: 'mobile_recharge'
});

// Test request/response logging
console.log('\n--- HTTP Requests ---');
logger.info('📥 Incoming request', {
  method: 'POST',
  url: '/api/v1/recharge',
  requestId: 'req_dev_002',
  userId: 'user_789',
  mobile: '9123456789',
  amount: 50
});

logger.info('📤 Outgoing response', {
  method: 'POST',
  statusCode: 200,
  duration: '245ms',
  requestId: 'req_dev_002',
  transactionId: 'TXN_SUCCESS_001'
});

// Test financial operations
console.log('\n--- Financial Operations ---');
logFinancialOperation('debit', 100, 'user_123', 'TXN123456789', {
  previousBalance: 1000,
  newBalance: 900,
  operation: 'recharge_deduction'
});

logFinancialOperation('credit', 50, 'user_456', 'REFUND_001', {
  previousBalance: 200,
  newBalance: 250,
  operation: 'refund_processing'
});

// Test recharge steps
console.log('\n--- Recharge Process Steps ---');
logRechargeStep('validation', 'success', '9876543210', {
  operator: 'Airtel',
  amount: 100,
  circle: 'Rajasthan'
});

logRechargeStep('api_call', 'in_progress', '9876543210', {
  provider: 'primary_gateway',
  endpoint: '/recharge/prepaid'
});

logRechargeStep('completion', 'success', '9876543210', {
  transactionId: 'TXN_FINAL_001',
  operatorRef: 'AIRTEL_123456789',
  balance: 99.75
});

// Test error scenarios
console.log('\n--- Error Scenarios ---');
logger.error('Database connection failed', {
  operation: 'db_connect',
  database: 'svrecharge',
  host: '127.0.0.1',
  err: new Error('Connection refused')
});

logger.warn('Rate limit approaching', {
  operation: 'rate_limit_check',
  currentRequests: 95,
  maxRequests: 100,
  timeWindow: '1 minute',
  userId: 'user_heavy_user'
});

console.log('\n✅ Development logging test completed!');
console.log('🎨 Notice the beautiful colors, emojis, and readable format!');

setTimeout(() => {
  process.exit(0);
}, 500);