/**
 * Console utility for system controls debugging
 */
window.bambiConsole = (function() {
  // Private variables
  const logEnabled = true;
  const errorEnabled = true;
  const warnEnabled = true;
  const infoEnabled = true;
  const debugEnabled = false; // Set to true for verbose logging
  
  // Track module loading
  const moduleLoadStatus = {};
  
  // Log with timestamp and module name
  function log(moduleName, message, data) {
    if (!logEnabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${timestamp}][${moduleName}]`;
    
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
  
  function error(moduleName, message, error) {
    if (!errorEnabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${timestamp}][${moduleName}]`;
    
    if (error) {
      console.error(prefix, message, error);
    } else {
      console.error(prefix, message);
    }
  }
  
  function warn(moduleName, message, data) {
    if (!warnEnabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${timestamp}][${moduleName}]`;
    
    if (data) {
      console.warn(prefix, message, data);
    } else {
      console.warn(prefix, message);
    }
  }
  
  function info(moduleName, message, data) {
    if (!infoEnabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${timestamp}][${moduleName}]`;
    
    if (data) {
      console.info(prefix, message, data);
    } else {
      console.info(prefix, message);
    }
  }
  
  function debug(moduleName, message, data) {
    if (!debugEnabled) return;
    
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${timestamp}][${moduleName}]`;
    
    if (data) {
      console.debug(prefix, message, data);
    } else {
      console.debug(prefix, message);
    }
  }
  
  // Module loading tracking
  function moduleLoading(moduleName) {
    moduleLoadStatus[moduleName] = {
      loadStarted: Date.now(),
      status: 'loading'
    };
    log('ModuleLoader', `Module loading: ${moduleName}`);
  }
  
  function moduleLoaded(moduleName) {
    if (moduleLoadStatus[moduleName]) {
      moduleLoadStatus[moduleName].status = 'loaded';
      moduleLoadStatus[moduleName].loadCompleted = Date.now();
      const loadTime = moduleLoadStatus[moduleName].loadCompleted - moduleLoadStatus[moduleName].loadStarted;
      log('ModuleLoader', `Module loaded: ${moduleName} (${loadTime}ms)`);
    } else {
      log('ModuleLoader', `Module loaded: ${moduleName}`);
    }
  }
  
  function moduleInitializing(moduleName) {
    moduleLoadStatus[moduleName] = moduleLoadStatus[moduleName] || {};
    moduleLoadStatus[moduleName].initStarted = Date.now();
    moduleLoadStatus[moduleName].status = 'initializing';
    log('ModuleLoader', `Module initializing: ${moduleName}`);
  }
  
  function moduleInitialized(moduleName) {
    if (moduleLoadStatus[moduleName]) {
      moduleLoadStatus[moduleName].status = 'initialized';
      moduleLoadStatus[moduleName].initCompleted = Date.now();
      const initTime = moduleLoadStatus[moduleName].initCompleted - (moduleLoadStatus[moduleName].initStarted || 0);
      log('ModuleLoader', `Module initialized: ${moduleName} (${initTime}ms)`);
    } else {
      log('ModuleLoader', `Module initialized: ${moduleName}`);
    }
  }
  
  function moduleFailed(moduleName, error) {
    moduleLoadStatus[moduleName] = moduleLoadStatus[moduleName] || {};
    moduleLoadStatus[moduleName].status = 'failed';
    moduleLoadStatus[moduleName].error = error;
    this.error('ModuleLoader', `Module failed: ${moduleName}`, error);
  }
  
  function getModuleStatus() {
    return {...moduleLoadStatus};
  }
  
  // Expose API
  return {
    log,
    error,
    warn,
    info,
    debug,
    moduleLoading,
    moduleLoaded,
    moduleInitializing,
    moduleInitialized,
    moduleFailed,
    getModuleStatus
  };
})();