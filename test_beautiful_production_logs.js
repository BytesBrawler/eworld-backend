#!/usr/bin/env node

/**
 * Test Beautiful Production Logging
 * This script demonstrates the enhanced logging with beautiful formatting in production
 */

// Set environment to production for testing
process.env.NODE_ENV = 'PRODUCTION';

const { logger, logBusinessOperation, logApiCallDetailed, logFinancialOperation, logRechargeStep } = require('./src/utils/logger');

console.log('🧪 Testing Beautiful Production Logging...\n');

// Test basic logging levels
logger.info('Application started successfully', {
    operation: 'startup',
    version: '1.0.0',
    environment: 'production'
});

logger.debug('Database connection established', {
    operation: 'database_connect',
    connectionTime: '150ms'
});

// Test business operation logging
logBusinessOperation('recharge', 'success', {
    mobile: '9876543210',
    amount: 100,
    operator: 'Airtel',
    transactionId: 'TXN123456789',
    userId: 'user_123'
});

logBusinessOperation('payment', 'success', {
    amount: 500,
    transactionId: 'PAY987654321',
    userId: 'user_456',
    paymentMethod: 'wallet'
});

// Test API call logging
logApiCallDetailed('POST', 'https://api.provider.com/recharge', {
    mobile: '9876543210',
    amount: 100
}, {
    status: 200,
    transactionId: 'EXT123456'
}, 1250, {
    requestId: 'req_789',
    operation: 'external_recharge'
});

// Test error logging
logger.error('Payment processing failed', {
    operation: 'payment_process',
    userId: 'user_789',
    amount: 250,
    transactionId: 'PAY_FAILED_001',
    err: new Error('Insufficient balance in wallet')
});

// Test financial operation
logFinancialOperation('debit', 100, 'user_123', 'TXN123456789', {
    previousBalance: 1000,
    newBalance: 900,
    operation: 'recharge_deduction'
});

// Test recharge steps
logRechargeStep('validation', 'success', 'user_123', {
    mobile: '9876543210',
    amount: 100,
    operator: 'Airtel'
});

logRechargeStep('api_call', 'in_progress', 'user_123', {
    provider: 'primary_provider',
    endpoint: '/recharge'
});

logRechargeStep('completion', 'success', 'user_123', {
    transactionId: 'TXN123456789',
    operatorRef: 'OP987654321'
});

// Test warning
logger.warn('Rate limit approaching threshold', {
    operation: 'rate_limit_check',
    currentRequests: 95,
    maxRequests: 100,
    timeWindow: '1 minute'
});

console.log('\n✅ Production logging test completed!');
console.log('📁 Check the following log files in backend/logs/:');
console.log('   - combined.log (all logs with beautiful formatting)');
console.log('   - error.log (error logs only)');
console.log('   - business.log (business operations)');
console.log('   - api.log (API calls and responses)');

setTimeout(() => {
    process.exit(0);
}, 1000);