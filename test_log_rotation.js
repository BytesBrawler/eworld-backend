#!/usr/bin/env node

/**
 * Log Rotation Test Script
 * This script tests the log rotation functionality by generating test logs
 */

const { 
  logger, 
  logBusinessOperation, 
  logApiCallDetailed,
  logError,
  logFinancialOperation 
} = require('./src/utils/logger');
const path = require('path');
const fs = require('fs');

console.log('🔄 Starting Log Rotation Test...\n');

// Test configuration
const testConfig = {
  logCount: 100,           // Number of test logs to generate
  logInterval: 50,         // Milliseconds between logs
  largeLogSize: 1024 * 10, // 10KB per large log entry
};

// Function to generate random data
const generateRandomData = (size) => {
  return 'X'.repeat(size);
};

// Function to check log files
const checkLogFiles = () => {
  const logDir = path.join(__dirname, 'logs');
  
  console.log('\n📁 Log Directory Contents:');
  console.log('─'.repeat(50));
  
  try {
    const files = fs.readdirSync(logDir);
    files.forEach(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`📄 ${file.padEnd(20)} - ${sizeKB} KB`);
    });
  } catch (error) {
    console.log('❌ Error reading log directory:', error.message);
  }
  
  console.log('─'.repeat(50));
};

// Test different log levels
const runLogLevelTest = () => {
  console.log('📝 Testing Different Log Levels...\n');
  
  logger.debug('🐛 Debug log - This is a debug message');
  logger.info('ℹ️  Info log - Application started successfully');
  logger.warn('⚠️  Warning log - This is a warning message');
  logger.error('❌ Error log - This is an error message');
  
  // Test business operation logging
  logBusinessOperation('test-operation', {
    userId: 'test-user-123',
    operation: 'test-recharge',
    amount: 100,
    status: 'success'
  });
  
  // Test API call logging
  logApiCallDetailed('External API Test', 'https://api.example.com/test', 
    { test: 'data' }, 
    { result: 'success' }, 
    150
  );
  
  // Test financial operation logging
  logFinancialOperation('test-recharge', 'user-123', 100, 500, 400, 'txn-123');
};

// Generate large logs to trigger rotation
const generateLargeLogs = async () => {
  console.log(`📊 Generating ${testConfig.logCount} test logs...`);
  console.log('This will help test size-based rotation.\n');
  
  for (let i = 1; i <= testConfig.logCount; i++) {
    // Generate logs of varying sizes
    const largeData = generateRandomData(testConfig.largeLogSize);
    
    logger.info(`Test Log Entry ${i}`, {
      iteration: i,
      timestamp: new Date().toISOString(),
      testData: largeData,
      metadata: {
        testRun: 'rotation-test',
        logSize: testConfig.largeLogSize,
        totalLogs: testConfig.logCount
      }
    });
    
    // Progress indicator
    if (i % 10 === 0) {
      process.stdout.write(`📝 Generated ${i}/${testConfig.logCount} logs\r`);
    }
    
    // Small delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, testConfig.logInterval));
  }
  
  console.log(`\n✅ Generated ${testConfig.logCount} test logs successfully!`);
};

// Main test function
const runRotationTest = async () => {
  try {
    // Check initial state
    console.log('📊 Initial Log File Status:');
    checkLogFiles();
    
    // Test different log levels
    runLogLevelTest();
    
    // Generate large volume of logs
    await generateLargeLogs();
    
    // Check final state
    console.log('\n📊 Final Log File Status:');
    checkLogFiles();
    
    // Test rotation configuration
    console.log('\n⚙️  Current Rotation Configuration:');
    console.log('─'.repeat(50));
    console.log(`📏 Max Size: ${process.env.LOG_MAX_SIZE || '10M'}`);
    console.log(`🔄 Frequency: ${process.env.LOG_FREQUENCY || 'daily'}`);
    console.log(`📚 Retention: ${process.env.LOG_RETENTION_COUNT || '7'} files`);
    console.log(`🗜️  Compression: ${process.env.LOG_COMPRESS !== 'false' ? 'Enabled' : 'Disabled'}`);
    console.log('─'.repeat(50));
    
    console.log('\n✨ Log Rotation Test Completed!');
    console.log('\n📋 What to Check:');
    console.log('1. Log files should be created in /backend/logs/');
    console.log('2. If files exceed configured size, they should rotate');
    console.log('3. Old files should be compressed (if enabled)');
    console.log('4. Only configured number of files should be retained');
    
  } catch (error) {
    console.error('❌ Test Error:', error);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Test interrupted. Checking final log state...');
  checkLogFiles();
  process.exit(0);
});

// Run the test
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Log Level:', process.env.LOG_LEVEL || 'debug');
console.log('');

runRotationTest();