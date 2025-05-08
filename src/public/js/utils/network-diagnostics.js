window.networkDiagnostics = (function() {
  // Private variables
  const diagnosticsData = {
    connectionAttempts: 0,
    successfulConnections: 0,
    disconnections: 0,
    errors: [],
    latency: [],
    lastPing: 0
  };
  
  let pingInterval = null;
  const maxStoredErrors = 10;
  
  function init() {
    setupEventListeners();
    
    // Start ping tests when connected
    if (window.socket && window.socket.connected) {
      startPingTests();
    }
    
    console.log('Network diagnostics initialized');
  }
  
  function setupEventListeners() {
    // Listen for socket connection events
    document.addEventListener('socket-connected', function() {
      diagnosticsData.successfulConnections++;
      diagnosticsData.lastConnectedAt = Date.now();
      startPingTests();
    });
    
    document.addEventListener('socket-disconnected', function(event) {
      diagnosticsData.disconnections++;
      diagnosticsData.lastDisconnectedAt = Date.now();
      diagnosticsData.lastDisconnectReason = event.detail.reason;
      stopPingTests();
    });
    
    // Set up global error capture for socket errors
    window.addEventListener('error', function(event) {
      if (event.message && (
          event.message.includes('socket') || 
          event.message.includes('websocket') ||
          event.message.includes('connection')
      )) {
        recordError(event.message);
      }
    });
    
    // Add command to console for debugging
    window.showNetworkDiagnostics = getDiagnosticsReport;
  }
  
  function startPingTests() {
    // Clear any existing interval
    stopPingTests();
    
    // Start regular ping tests to measure latency
    pingInterval = setInterval(function() {
      if (!window.socket || !window.socket.connected) {
        stopPingTests();
        return;
      }
      
      const startTime = Date.now();
      diagnosticsData.lastPing = startTime;
      
      window.socket.emit('ping', null, function() {
        const latency = Date.now() - startTime;
        diagnosticsData.latency.push(latency);
        
        // Keep only the last 10 measurements
        if (diagnosticsData.latency.length > 10) {
          diagnosticsData.latency.shift();
        }
      });
    }, 30000); // Every 30 seconds
  }
  
  function stopPingTests() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }
  
  function recordError(error) {
    // Store error with timestamp
    diagnosticsData.errors.push({
      time: Date.now(),
      message: error.toString()
    });
    
    // Keep only the most recent errors
    if (diagnosticsData.errors.length > maxStoredErrors) {
      diagnosticsData.errors.shift();
    }
  }
  
  function getDiagnosticsReport() {
    // Calculate average latency
    const avgLatency = diagnosticsData.latency.length > 0 
      ? diagnosticsData.latency.reduce((sum, val) => sum + val, 0) / diagnosticsData.latency.length 
      : 0;
    
    // Build report
    const report = {
      connectionStatus: window.socket && window.socket.connected ? 'connected' : 'disconnected',
      successfulConnections: diagnosticsData.successfulConnections,
      disconnections: diagnosticsData.disconnections,
      lastConnectedAt: diagnosticsData.lastConnectedAt 
        ? new Date(diagnosticsData.lastConnectedAt).toLocaleTimeString() 
        : 'never',
      lastDisconnectedAt: diagnosticsData.lastDisconnectedAt 
        ? new Date(diagnosticsData.lastDisconnectedAt).toLocaleTimeString() 
        : 'never',
      lastDisconnectReason: diagnosticsData.lastDisconnectReason || 'n/a',
      latency: {
        average: Math.round(avgLatency) + 'ms',
        values: diagnosticsData.latency
      },
      recentErrors: diagnosticsData.errors.map(err => ({
        time: new Date(err.time).toLocaleTimeString(),
        message: err.message
      })),
      browserInfo: {
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        connectionType: getConnectionType()
      },
      serverInfo: {
        url: window.location.hostname,
        port: window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
      }
    };
    
    console.table(report);
    return report;
  }
  
  function getConnectionType() {
    // Get connection information if available
    if (navigator.connection) {
      return {
        effectiveType: navigator.connection.effectiveType || 'unknown',
        downlink: navigator.connection.downlink || 'unknown',
        rtt: navigator.connection.rtt || 'unknown',
        saveData: navigator.connection.saveData || false
      };
    }
    return 'unavailable';
  }
  
  function runConnectionTest() {
    const results = {
      serverReachable: false,
      webSocketSupported: 'WebSocket' in window,
      networkOnline: navigator.onLine,
      testTime: new Date().toLocaleTimeString()
    };
    
    // Create promise for server test
    const serverTest = new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          results.serverStatus = xhr.status;
          results.serverReachable = xhr.status >= 200 && xhr.status < 300;
          resolve();
        }
      };
      xhr.onerror = function() {
        results.serverReachable = false;
        results.serverError = 'Network error';
        resolve();
      };
      xhr.open('GET', '/ping', true);
      xhr.timeout = 5000;
      xhr.ontimeout = function() {
        results.serverReachable = false;
        results.serverError = 'Timeout';
        resolve();
      };
      xhr.send();
    });
    
    // Return results when tests complete
    return serverTest.then(() => {
      console.log('Connection test results:', results);
      return results;
    });
  }
  
  function runFullDiagnostics() {
    const report = getDiagnosticsReport();
    
    return runConnectionTest().then(connectionResults => {
      const fullReport = {
        ...report,
        connectionTest: connectionResults,
        timestamp: new Date().toISOString(),
      };
      
      console.log('Full diagnostic report:', fullReport);
      
      // Optional - send to server for logging if connected
      if (window.socket && window.socket.connected) {
        window.socket.emit('client-diagnostics-report', fullReport);
      }
      
      return fullReport;
    });
  }
  
  // Public API
  return {
    init,
    getReport: getDiagnosticsReport,
    testConnection: runConnectionTest,
    runDiagnostics: runFullDiagnostics
  };
})();

// Initialize after socket-handler
document.addEventListener('socket-connected', function() {
  if (window.networkDiagnostics) {
    window.networkDiagnostics.init();
  }
});

// Also initialize on page load in case it missed the event
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (window.networkDiagnostics) {
      window.networkDiagnostics.init();
    }
  }, 2000);
});