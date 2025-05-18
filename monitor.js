// Monitor script for BambiSleep.chat
// Used to monitor the health of a running server instance
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  serverUrl: 'http://localhost:6969', // Default server URL
  checkInterval: 60000, // Check every minute
  logFile: path.join(__dirname, 'monitor.log'),
  memoryLogInterval: 300000, // Log memory stats every 5 minutes
  restartScript: path.join(__dirname, 'restart-server.bat'),
  memoryThreshold: 90, // Percent of memory usage to trigger alert
};

// State
let lastMemoryLog = Date.now();
let serverDownCount = 0;

// Initialize logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(config.logFile, logMessage);
}

// Check server health
async function checkServerHealth() {
  try {
    const response = await axios.get(`${config.serverUrl}/health`, { 
      timeout: 5000 
    });
    
    if (response.status === 200) {
      serverDownCount = 0;
      return true;
    }
    
    log(`WARNING: Server responded with status ${response.status}`);
    serverDownCount++;
    return false;
  } catch (error) {
    log(`ERROR: Server health check failed: ${error.message}`);
    serverDownCount++;
    return false;
  }
}

// Check system memory
function checkSystemMemory() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = (usedMem / totalMem) * 100;
  
  // Log memory usage periodically
  if (Date.now() - lastMemoryLog > config.memoryLogInterval) {
    log(`System memory: ${Math.round(memoryUsagePercent)}% used (${Math.round(usedMem / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB)`);
    lastMemoryLog = Date.now();
  }
  
  // Check if memory usage is too high
  if (memoryUsagePercent > config.memoryThreshold) {
    log(`ALERT: System memory usage is critically high: ${Math.round(memoryUsagePercent)}%`);
    return false;
  }
  
  return true;
}

// Main monitoring loop
async function monitor() {
  log('Starting BambiSleep.chat server monitor');
  
  setInterval(async () => {
    // Check server health
    const serverHealthy = await checkServerHealth();
    const memoryHealthy = checkSystemMemory();
    
    // If server is down multiple times in a row, try to restart
    if (!serverHealthy && serverDownCount >= 3) {
      log(`CRITICAL: Server has been down for ${serverDownCount} checks. Attempting restart.`);
      // Restart server logic would go here
      try {
        if (fs.existsSync(config.restartScript)) {
          log('Executing restart script');
          require('child_process').execSync(config.restartScript);
        } else {
          log('Restart script not found');
        }
      } catch (error) {
        log(`Failed to restart server: ${error.message}`);
      }
    }
    
    // If memory usage is too high, log warning
    if (!memoryHealthy) {
      log('System memory is critically low. Server may be killed by OOM killer.');
    }
  }, config.checkInterval);
}

// Start monitoring
monitor();