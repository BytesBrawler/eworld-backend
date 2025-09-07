const { Queue } = require('bullmq');
const connection = { host: '127.0.0.1', port: 6379 }; // Or your Redis config

const updateBalanceQueue = new Queue('updateLineBalanceJob', { connection });

module.exports = updateBalanceQueue;
