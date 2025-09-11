// messageService.js
const { Queue } = require('bullmq');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const db = require('../db');

// Redis connection configuration
const connection = { 
  host: process.env.REDIS_HOST || '127.0.0.1', 
  port: process.env.REDIS_PORT || 6379,
};

// Create message queues
const appNotificationQueue = new Queue('eworld-appNotificationJob', { connection });
const smsQueue = new Queue('eworld-smsMessageJob', { connection });
const bulkQueue = new Queue('eworld-bulkMessagingJob', { connection });

/**
 * Send message to user asynchronously
 * @param {number} userId - The user ID
 * @param {string} message - The message content
 * @param {string} type - The message type (app or number)
 * @param {string} title - Optional title for app notifications
 * @returns {Promise} - Promise that resolves with job info
 */
async function sendMessageToUserAsync(userId, message, type = "app", title = "MTC") {
  try {
    // Validate inputs
    if (!userId || !message) {
      throw new Error('User ID and message are required');
    }
    
    let jobId;
    
    // Add to appropriate queue based on type
    if (type === "app") {
      jobId = `app-notification-${userId}-${Date.now()}`;
      await appNotificationQueue.add(jobId, {
        userId,
        message,
        title
      }, {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        }
      });
      
    } else if (type === "number") {
        await db.query(
            "INSERT INTO messages (user_id, message, type) VALUES (?, ?, ?)",
            [userId, message, "number"]
          );
      jobId = `sms-${userId}-${Date.now()}`;
      console.log("Adding SMS job to queue:", jobId);
      await smsQueue.add(jobId, {
        userId,
        message
      }, {
        
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 2000,
        }
      });
      
    } else {
      throw new Error(`Unsupported message type: ${type}`);
    }
    
    return {
      success: true,
      jobId,
      message: `Message to user ${userId} queued for delivery`,
      type
    };
  } catch (error) {
    console.error(`Error queuing message for user ${userId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send an SMS directly to a phone number
 * @param {string} phoneNumber - The phone number to send to
 * @param {string} message - The message content
 * @param {number} userId - Optional user ID for tracking
 * @returns {Promise} - Promise that resolves with job info
 */
async function sendSMSAsync(phoneNumber, message, userId = null) {
  try {
    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required');
    }
    
    const jobId = `sms-direct-${phoneNumber.substring(phoneNumber.length - 4)}-${Date.now()}`;
    
    await smsQueue.add(jobId, {
      phoneNumber,
      message,
      userId
    }, {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      }
    });
    
    return {
      success: true,
      jobId,
      message: `SMS to ${phoneNumber} queued for delivery`
    };
  } catch (error) {
    console.error(`Error queuing SMS for ${phoneNumber}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send bulk messages asynchronously
 * @param {Array} messageIds - Array of message IDs to process
 * @returns {Promise} - Promise that resolves with job info
 */
async function sendBulkMessagesAsync(messageIds) {
  try {
    console.log("sendBulkMessagesAsync called with:", messageIds);
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      throw new Error('Valid array of message IDs is required');
    }
    
    // Validate that messages exist
    const [existingMessages] = await db.query(
      "SELECT id FROM messages WHERE id IN (?)",
      [messageIds]
    );
    
    if (!existingMessages || existingMessages.length === 0) {
      throw new Error('No valid messages found for the provided IDs');
    }
    
    if (existingMessages.length !== messageIds.length) {
      console.warn(`Warning: ${messageIds.length - existingMessages.length} message IDs not found in database`);
    }
    
    const validMessageIds = existingMessages.map(msg => msg.id);
    const jobId = `bulk-${Date.now()}`;
    
    console.log("Creating bulk job:", jobId, "for messages:", validMessageIds);
    
    await bulkQueue.add(jobId, { 
      messageIds: validMessageIds 
    }, {
      removeOnComplete: 5,
      removeOnFail: 3,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      }
    });
    
    return {
      success: true,
      jobId,
      message: `Bulk message processing for ${validMessageIds.length} messages queued`,
      processedCount: validMessageIds.length,
      totalRequested: messageIds.length
    };
  } catch (error) {
    console.error('Error queuing bulk messages:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get message history (unchanged from original)
 */
async function getMessageHistory(userId, type = null, limit = 10, offset = 0) {
  try {
    let query = "SELECT * FROM messages WHERE user_id = ?";
    const params = [userId];
    
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const [messages] = await db.query(query, params);
    return messages;
  } catch (error) {
    console.error("Error fetching message history:", error);
    throw error;
  }
}

/**
 * Get job status
 */
async function getJobStatus(jobId, queueName) {
  try {
    let queue;
    
    switch (queueName) {
      case 'app':
        queue = appNotificationQueue;
        break;
      case 'sms':
        queue = smsQueue;
        break;
      case 'bulk':
        queue = bulkQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
    
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return { 
        success: false, 
        message: 'Job not found' 
      };
    }
    
    const state = await job.getState();
    const progress = job.progress;
    const attempts = job.attemptsMade;
    const maxAttempts = job.opts.attempts || 1;
    
    return {
      success: true,
      jobId,
      state,
      progress,
      attempts,
      maxAttempts,
      data: job.data,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason
    };
  } catch (error) {
    console.error(`Error getting job status for ${jobId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get queue stats
 */
async function getQueueStats(queueName = 'all') {
  try {
    const stats = {};
    
    const queues = queueName === 'all' 
      ? [
          { name: 'app', queue: appNotificationQueue },
          { name: 'sms', queue: smsQueue },
          { name: 'bulk', queue: bulkQueue }
        ]
      : [{ name: queueName, queue: getQueueByName(queueName) }];
    
    for (const { name, queue } of queues) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      
      stats[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length
      };
    }
    
    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function getQueueByName(name) {
  switch (name) {
    case 'app':
      return appNotificationQueue;
    case 'sms':
      return smsQueue;
    case 'bulk':
      return bulkQueue;
    default:
      throw new Error(`Unknown queue: ${name}`);
  }
}

// For backwards compatibility
async function sendMessageToUser(userId, message, type = "app") {
  return sendMessageToUserAsync(userId, message, type);
}

async function sendSMS(phoneNumber, message, userId = null) {
  return sendSMSAsync(phoneNumber, message, userId);
}

async function sendBulkMessages(messageIds) {
  return sendBulkMessagesAsync(messageIds);
}

module.exports = {
  // Async queue-based methods
  sendMessageToUserAsync,
  sendSMSAsync,
  sendBulkMessagesAsync,
  getJobStatus,
  getQueueStats,
  
  // Original method names (for backwards compatibility)
  sendMessageToUser,
  sendSMS,
  sendBulkMessages,
  
  // Other methods
  getMessageHistory,
  
  // Helper function
  getNestedValue: (obj, path) => {
    return path.split(".").reduce((prev, curr) => {
      return prev && prev[curr] !== undefined ? prev[curr] : undefined;
    }, obj);
  },
  
  // Queue instances (for advanced usage)
  queues: {
    app: appNotificationQueue,
    sms: smsQueue,
    bulk: bulkQueue
  }
};