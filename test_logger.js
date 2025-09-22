// Test script to verify the focused logger configuration for critical endpoints
const { 
  createModuleLogger, 
  logBusinessOperation, 
  logFinancialOperation,
  logRechargeStep,
  logApiCallDetailed 
} = require('./src/utils/logger');

// Create test loggers for critical modules
const retailerLogger = createModuleLogger('retailer-controller');
const resellerLogger = createModuleLogger('reseller-controller');

console.log('Testing Focused Logging for Critical Endpoints...\n');

// Test retailer recharge logging
console.log('🏪 Testing Retailer Recharge Logging:');
logBusinessOperation('RECHARGE_INITIATED', {
  keywordId: 123,
  customerNumber: '9876****',
  amount: 100
}, 456);

logFinancialOperation('BALANCE_DEDUCTION', 456, 100, 1500, 1400);

logRechargeStep('API_CALL_START', {
  id: 'TXN123',
  userId: 456,
  keywordId: 123,
  amount: 100,
  customerNumber: '9876****'
}, {
  attempt: 1,
  provider: 'test_provider'
});

// Test reseller endpoints logging  
console.log('\n🤝 Testing Reseller Endpoints Logging:');
logBusinessOperation('RESELLER_RECHARGE_INITIATED', {
  opcode: 'JIO',
  number: '9876****',
  amount: 50
}, 789);

logBusinessOperation('RESELLER_BALANCE_CHECK', {}, 789);

logBusinessOperation('RESELLER_STATUS_CHECK', { txnid: 'TXN456' }, 789);

logBusinessOperation('CALLBACK_RECEIVED', {
  method: 'POST',
  dataKeys: ['txnid', 'status', 'message']
});

// Test API call logging
console.log('\n🔄 Testing API Call Logging:');
logApiCallDetailed(
  'test_provider',
  'recharge_api',
  { mobile: '9876****', amount: 100 },
  { status: 'success', txnid: 'API123' },
  250
);

// Test dynamic recharge logging
console.log('\n🌐 Testing Dynamic Recharge Logging:');
const dynamicLogger = createModuleLogger('dynamic-recharge');
dynamicLogger.info({
  provider: 'TestProvider',
  api: 'RechargeAPI',
  method: 'POST',
  url: 'https://api.test.com/recharge',
  timeout: 30000
}, '🔄 External API call initiated');

console.log('\n✅ Focused logging test completed!');
console.log('📊 Logging is now active for:');
console.log('   - Retailer: recharge endpoint only');  
console.log('   - Reseller: recharge, balanceCheck, statusCheck, callback endpoints');
console.log('   - Dynamic Recharge: All external API calls with full request/response data');
console.log('   - Request/Response: All endpoints (via middleware)');
console.log('💡 Other endpoints keep existing console.log for simplicity');