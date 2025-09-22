/**
 * Test Beautiful Logging Features
 * This script demonstrates all the beautiful logging capabilities
 */

const {
  logger,
  logRechargeOperation,
  logPaymentOperation,
  logApiOperation,
  logSuccess,
  logFailure,
  logPerformance
} = require('./src/utils/logger');

async function testBeautifulLogging() {
  console.log('\n🌍 Testing Beautiful Logging Features...\n');

  // Test basic log levels with emojis
  logger.debug('🐛 This is a debug message with technical details');
  logger.info('ℹ️ Application started successfully');
  logger.warn('⚠️ Database connection is slow, but functional');
  logger.error('❌ Failed to process payment - invalid card details');

  // Test custom business log levels
  logger.api('📡 External API call initiated');
  logger.recharge('💳 Processing mobile recharge request');
  logger.payment('💰 Payment transaction completed');

  // Test beautiful recharge logging
  logRechargeOperation('Mobile recharge initiated', {
    mobile: '9876543210',
    amount: 299,
    operator: 'Airtel',
    userId: 'USER123',
    requestId: 'REQ-' + Date.now()
  });

  logRechargeOperation('Recharge successful', {
    mobile: '9876543210',
    amount: 299,
    operator: 'Airtel',
    transactionId: 'TXN-' + Date.now(),
    status: 'SUCCESS'
  });

  // Test payment logging
  logPaymentOperation('Wallet debit for recharge', {
    userId: 'USER123',
    amount: 299,
    balanceBefore: 1500,
    balanceAfter: 1201,
    transactionType: 'DEBIT'
  });

  logPaymentOperation('Commission credit', {
    userId: 'RETAILER456',
    amount: 8.97,
    transactionType: 'CREDIT',
    commissionRate: 3
  });

  // Test API logging
  logApiOperation('Fetching operator details', {
    provider: 'CYBERPLAT',
    endpoint: '/api/operators',
    method: 'GET',
    requestId: 'API-' + Date.now()
  });

  logApiOperation('Recharge API response received', {
    provider: 'CYBERPLAT',
    endpoint: '/api/recharge',
    responseTime: 1247,
    status: 'SUCCESS',
    transactionId: 'CP-' + Date.now()
  });

  // Test success and failure logging
  logSuccess('User registration completed', {
    userId: 'USER789',
    email: 'user@example.com',
    role: 'RETAILER'
  });

  logFailure('OTP verification failed', new Error('Invalid OTP provided'), {
    userId: 'USER789',
    mobile: '9876543210',
    attempts: 3
  });

  // Test performance logging
  logPerformance('Database query execution', 156, {
    query: 'SELECT * FROM users WHERE id = ?',
    operation: 'USER_FETCH'
  });

  logPerformance('External API call', 3245, {
    provider: 'SLOW_API',
    endpoint: '/slow-endpoint',
    operation: 'DATA_SYNC'
  });

  // Test complex business scenario
  const rechargeScenario = {
    requestId: 'REQ-' + Date.now(),
    userId: 'USER123',
    mobile: '9876543210',
    amount: 599,
    operator: 'Jio'
  };

  logger.info({
    scenario: 'FULL_RECHARGE_FLOW',
    step: 'INITIATED',
    ...rechargeScenario
  }, '🚀 Starting complete recharge flow');

  // Simulate step-by-step logging
  await new Promise(resolve => setTimeout(resolve, 100));
  logSuccess('User authentication verified', { userId: rechargeScenario.userId });

  await new Promise(resolve => setTimeout(resolve, 100));
  logSuccess('Operator validation completed', { operator: rechargeScenario.operator });

  await new Promise(resolve => setTimeout(resolve, 100));
  logPaymentOperation('Balance check completed', {
    userId: rechargeScenario.userId,
    requiredAmount: rechargeScenario.amount,
    availableBalance: 1200,
    status: 'SUFFICIENT'
  });

  await new Promise(resolve => setTimeout(resolve, 200));
  logApiOperation('Submitting to operator', {
    provider: 'JIO_API',
    endpoint: '/recharge',
    requestData: {
      mobile: rechargeScenario.mobile,
      amount: rechargeScenario.amount,
      circle: 'DELHI'
    }
  });

  await new Promise(resolve => setTimeout(resolve, 300));
  logSuccess('Recharge completed successfully', {
    ...rechargeScenario,
    transactionId: 'TXN-SUCCESS-' + Date.now(),
    operatorRefId: 'JIO-REF-' + Date.now()
  });

  console.log('\n✅ Beautiful logging test completed!');
  console.log('📋 Check the logs with: node log_viewer.js recent');
  console.log('🔍 Watch live logs with: node log_viewer.js watch');
  console.log('❌ See errors only: node log_viewer.js errors');
  console.log('💳 See recharge logs: node log_viewer.js recharge\n');
}

// Run the test
testBeautifulLogging().catch(console.error);