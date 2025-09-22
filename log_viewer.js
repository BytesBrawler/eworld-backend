#!/usr/bin/env node
/**
 * Beautiful Log Viewer for EWorld Backend
 * Usage: node log_viewer.js [options]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Log level colors and icons
const levelConfig = {
  10: { color: colors.dim, icon: '🔍', name: 'TRACE' },
  20: { color: colors.blue, icon: '🐛', name: 'DEBUG' },
  25: { color: colors.cyan, icon: '📡', name: 'API  ' },
  30: { color: colors.green, icon: 'ℹ️ ', name: 'INFO ' },
  35: { color: colors.blue, icon: '💳', name: 'RECH ' },
  40: { color: colors.yellow, icon: '⚠️ ', name: 'WARN ' },
  45: { color: colors.green, icon: '💰', name: 'PAY  ' },
  50: { color: colors.red, icon: '❌', name: 'ERROR' },
  60: { color: colors.bgRed, icon: '💥', name: 'FATAL' }
};

class BeautifulLogViewer {
  constructor(logDir = './logs') {
    this.logDir = path.resolve(logDir);
    this.filters = {};
    this.showTimestamp = true;
    this.showLevel = true;
    this.showService = true;
    this.colorize = true;
  }

  // Format timestamp beautifully
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return `${colors.dim}${date.toLocaleDateString()} ${date.toLocaleTimeString()}${colors.reset}`;
  }

  // Format log level with color and icon
  formatLevel(level) {
    const config = levelConfig[level] || { color: colors.white, icon: '📋', name: 'UNKN ' };
    return `${config.color}${config.icon} ${config.name}${colors.reset}`;
  }

  // Format service name
  formatService(service) {
    return `${colors.bright}[${service || 'eworld'}]${colors.reset}`;
  }

  // Format message with highlighting
  formatMessage(msg, logObj) {
    let formatted = msg;

    // Highlight important operations
    if (msg.includes('RECHARGE:')) {
      formatted = `${colors.blue}${msg}${colors.reset}`;
    } else if (msg.includes('PAYMENT:')) {
      formatted = `${colors.green}${msg}${colors.reset}`;
    } else if (msg.includes('API:')) {
      formatted = `${colors.cyan}${msg}${colors.reset}`;
    } else if (msg.includes('SUCCESS:')) {
      formatted = `${colors.green}${msg}${colors.reset}`;
    } else if (msg.includes('FAILURE:') || msg.includes('ERROR:')) {
      formatted = `${colors.red}${msg}${colors.reset}`;
    }

    return formatted;
  }

  // Format additional data
  formatData(logObj) {
    const details = [];
    
    if (logObj.requestId) {
      details.push(`${colors.cyan}🔗 ${logObj.requestId}${colors.reset}`);
    }
    
    if (logObj.userId) {
      details.push(`${colors.yellow}👤 ${logObj.userId}${colors.reset}`);
    }
    
    if (logObj.amount) {
      details.push(`${colors.green}💵 ${logObj.amount}${colors.reset}`);
    }
    
    if (logObj.mobile) {
      details.push(`${colors.blue}📱 ${logObj.mobile}${colors.reset}`);
    }
    
    if (logObj.operator) {
      details.push(`${colors.magenta}📞 ${logObj.operator}${colors.reset}`);
    }
    
    if (logObj.duration) {
      const duration = parseInt(logObj.duration);
      const durationColor = duration > 5000 ? colors.red : duration > 2000 ? colors.yellow : colors.green;
      details.push(`${durationColor}⏱️  ${logObj.duration}${colors.reset}`);
    }

    return details.length > 0 ? ` ${details.join(' ')}` : '';
  }

  // Parse and format a single log line
  formatLogLine(line) {
    try {
      const logObj = JSON.parse(line);
      
      // Apply filters
      if (this.filters.level && logObj.level < this.filters.level) {
        return null;
      }
      
      if (this.filters.service && !logObj.service?.includes(this.filters.service)) {
        return null;
      }

      let formatted = '';
      
      // Add timestamp
      if (this.showTimestamp && logObj.time) {
        formatted += this.formatTime(logObj.time) + ' ';
      }
      
      // Add level
      if (this.showLevel && logObj.level !== undefined) {
        formatted += this.formatLevel(logObj.level) + ' ';
      }
      
      // Add service
      if (this.showService && logObj.service) {
        formatted += this.formatService(logObj.service) + ' ';
      }
      
      // Add message
      if (logObj.msg) {
        formatted += this.formatMessage(logObj.msg, logObj);
      }
      
      // Add additional data
      formatted += this.formatData(logObj);
      
      // Add error details if present
      if (logObj.err) {
        formatted += `\n  ${colors.red}Error: ${logObj.err.message}${colors.reset}`;
        if (logObj.err.stack && this.filters.showStack) {
          formatted += `\n  ${colors.dim}${logObj.err.stack}${colors.reset}`;
        }
      }

      return formatted;
    } catch (error) {
      return `${colors.dim}${line}${colors.reset}`;
    }
  }

  // Watch and display logs in real-time
  async watchLogs(filename = 'combined.log') {
    const filePath = path.join(this.logDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`${colors.red}Log file not found: ${filePath}${colors.reset}`);
      return;
    }

    console.log(`${colors.green}🌍 Watching logs: ${filePath}${colors.reset}`);
    console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}\n`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    // Display existing logs
    for await (const line of rl) {
      const formatted = this.formatLogLine(line);
      if (formatted) {
        console.log(formatted);
      }
    }

    // Watch for new logs
    fs.watchFile(filePath, { interval: 1000 }, () => {
      // Implementation for real-time log watching would go here
      // For now, just notify that file changed
      console.log(`${colors.yellow}📝 Log file updated${colors.reset}`);
    });
  }

  // Display recent logs
  async showRecentLogs(filename = 'combined.log', lines = 50) {
    const filePath = path.join(this.logDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.error(`${colors.red}Log file not found: ${filePath}${colors.reset}`);
      return;
    }

    console.log(`${colors.green}🌍 Recent logs from: ${filename}${colors.reset}\n`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const logLines = [];
    for await (const line of rl) {
      logLines.push(line);
    }

    // Show last N lines
    const recentLines = logLines.slice(-lines);
    for (const line of recentLines) {
      const formatted = this.formatLogLine(line);
      if (formatted) {
        console.log(formatted);
      }
    }
  }

  // Set filters
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
  }
}

// CLI Usage
if (require.main === module) {
  const viewer = new BeautifulLogViewer();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'recent';
  
  switch (command) {
    case 'watch':
      const watchFile = args[1] || 'combined.log';
      viewer.watchLogs(watchFile);
      break;
      
    case 'recent':
      const recentFile = args[1] || 'combined.log';
      const recentLines = parseInt(args[2]) || 50;
      viewer.showRecentLogs(recentFile, recentLines);
      break;
      
    case 'errors':
      viewer.setFilters({ level: 50 }); // Error level and above
      viewer.showRecentLogs('error.log', 20);
      break;
      
    case 'recharge':
      viewer.setFilters({ level: 35 }); // Recharge level and above
      viewer.showRecentLogs('app.log', 30);
      break;
      
    default:
      console.log(`${colors.green}🌍 EWorld Beautiful Log Viewer${colors.reset}`);
      console.log(`${colors.bright}Usage:${colors.reset}`);
      console.log(`  node log_viewer.js recent [file] [lines]  - Show recent logs`);
      console.log(`  node log_viewer.js watch [file]          - Watch logs in real-time`);
      console.log(`  node log_viewer.js errors                - Show recent errors`);
      console.log(`  node log_viewer.js recharge              - Show recharge operations`);
      console.log(`\n${colors.dim}Examples:${colors.reset}`);
      console.log(`  node log_viewer.js recent app.log 100`);
      console.log(`  node log_viewer.js watch combined.log`);
  }
}

module.exports = BeautifulLogViewer;