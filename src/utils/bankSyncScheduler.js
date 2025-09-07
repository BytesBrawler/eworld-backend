// Bank Sync Scheduler
// This file contains the cron job setup for automatic bank list synchronization

const cron = require('node-cron');
const { scheduleAutoBankSync } = require('../controllers/dmt.controller.js');

// Schedule bank sync every hour (0 minutes of every hour)
const startBankSyncScheduler = () => {
  console.log("🕒 Starting bank sync scheduler...");
  
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running scheduled bank sync...');
    try {
      const result = await scheduleAutoBankSync();
      console.log('✅ Scheduled bank sync result:', result);
    } catch (error) {
      console.error('❌ Scheduled bank sync error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });
  
  console.log("✅ Bank sync scheduler started (runs every hour)");
};

// Run initial sync when server starts
const runInitialBankSync = async () => {
  console.log("🚀 Running initial bank sync...");
  try {
    const result = await scheduleAutoBankSync();
    console.log('✅ Initial bank sync result:', result);
  } catch (error) {
    console.error('❌ Initial bank sync error:', error.message);
  }
};

module.exports = {
  startBankSyncScheduler,
  runInitialBankSync
};
