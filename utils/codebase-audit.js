/**
 * Codebase audit utility
 * 
 * Scans the project files to identify redundant, outdated or unnecessary code
 * based on established patterns and implementation guidelines
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk'; // Assuming you have this dependency

// Get current directory with ESM support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Known redundancies to check
const knownRedundancies = [
  {
    file: 'src/public/js/session-history.js',
    replacement: 'src/public/js/bambi-sessions.js',
    reason: 'Duplicate functionality with a better implementation in bambi-sessions.js'
  },
  {
    file: 'src/public/js/old-trigger-system.js', 
    replacement: 'src/public/js/trigger-controls.js',
    reason: 'Outdated implementation of the trigger system'
  },
  {
    file: 'src/public/js/deprecated-settings.js',
    replacement: 'src/public/js/system-controls.js',
    reason: 'Replaced by the central state management system'
  }
];

// Module usage patterns to check for inconsistencies
const moduleUsagePatterns = {
  'sessions': {
    preferred: 'bambiSessions',
    outdated: ['bambiHistory', 'sessionHistory']
  },
  'triggers': {
    preferred: 'triggerControls',
    outdated: ['bambiTriggers', 'triggerSystem']
  },
  'collar': {
    preferred: 'collarControls',
    outdated: ['bambiCollar', 'collarSystem']
  },
  'state': {
    preferred: 'bambiSystem',
    outdated: ['stateManager', 'settingsManager']
  }
};

// Specific file patterns to check for required implementation details
const specificFilePatterns = {
  'trigger-controls.js': [
    {
      pattern: /bambiSystem\.saveState\(['"]triggers/,
      required: true,
      message: 'Missing centralized state management for triggers',
      severity: 'high'
    },
    {
      pattern: /function\s+tearDown/,
      required: true,
      message: 'Missing tearDown function for event listener cleanup',
      severity: 'medium'
    }
  ],
  'collar-controls.js': [
    {
      pattern: /bambiSystem\.saveState\(['"]collar/,
      required: true,
      message: 'Missing centralized state management for collar settings',
      severity: 'high'
    },
    {
      pattern: /function\s+tearDown/,
      required: true,
      message: 'Missing tearDown function for event listener cleanup',
      severity: 'medium'
    }
  ],
  'bambi-sessions.js': [
    {
      pattern: /saveSession|loadSession/,
      required: true,
      message: 'Missing core session management functions',
      severity: 'high'
    },
    {
      pattern: /showToast/,
      required: true,
      message: 'Missing user feedback mechanism',
      severity: 'medium'
    }
  ],
  'system-controls.js': [
    {
      pattern: /getState|saveState/,
      required: true,
      message: 'Missing state management core functions',
      severity: 'high'
    },
    {
      pattern: /document\.dispatchEvent\(.*?system-update/,
      required: true,
      message: 'Missing event notification system',
      severity: 'medium'
    }
  ]
};

// Add view-specific patterns to check
const viewFilePatterns = {
  'index.ejs': [
    {
      pattern: /socket\.on\(['"]connect/,
      required: true,
      message: 'Missing socket connection setup',
      severity: 'high'
    },
    {
      pattern: /socket\.on\(['"]chat message/,
      required: true,
      message: 'Missing chat message handler',
      severity: 'medium'
    }
  ],
  'profile.ejs': [
    {
      pattern: /socket\.emit\(['"]join-profile/,
      required: true,
      message: 'Missing profile room connection',
      severity: 'medium'
    },
    {
      pattern: /system-controls-tab/,
      required: true,
      message: 'Missing system controls integration',
      severity: 'high'
    }
  ],
  'sessions/dashboard.ejs': [
    {
      pattern: /session-grid|session-list/,
      required: true,
      message: 'Missing session listing functionality',
      severity: 'high'
    },
    {
      pattern: /editTitleModal|deleteModal/,
      required: true,
      message: 'Missing session management modals',
      severity: 'medium'
    }
  ],
  'sessions/view.ejs': [
    {
      pattern: /shareSession|copyShareLink/,
      required: true,
      message: 'Missing session sharing functionality',
      severity: 'medium'
    },
    {
      pattern: /message-content|chat-container/,
      required: true,
      message: 'Missing message display functionality',
      severity: 'high'
    }
  ],
  'partials/profile-system-controls.ejs': [
    {
      pattern: /control-panel|control-btn/,
      required: true,
      message: 'Missing control panel structure',
      severity: 'high'
    },
    {
      pattern: /localStorage\.getItem\(['"]bambiActiveTab/,
      required: true,
      message: 'Missing tab state persistence',
      severity: 'medium'
    }
  ]
};

// Add socket-specific patterns
const socketFilePatterns = {
  'setupSocket.js': [
    {
      pattern: /socket\.on\(['"]connect/,
      required: true,
      message: 'Missing connection handler',
      severity: 'high'
    },
    {
      pattern: /handleDisconnect|socket\.on\(['"]disconnect/,
      required: true,
      message: 'Missing disconnect handler',
      severity: 'high'
    }
  ],
  'chatSockets.js': [
    {
      pattern: /socket\.on\(['"]chat message/,
      required: true,
      message: 'Missing chat message handler',
      severity: 'high'
    },
    {
      pattern: /awardXP|socket\.emit\(['"]xp:update/,
      required: true,
      message: 'Missing XP award functionality',
      severity: 'medium'
    }
  ],
  'lmStudioSockets.js': [
    {
      pattern: /postMessage\(\{.*?type/,
      required: true,
      message: 'Missing worker thread integration',
      severity: 'high'
    },
    {
      pattern: /socket\.on\(['"]system-settings/,
      required: true,
      message: 'Missing system settings handler',
      severity: 'medium'
    }
  ],
  'profileSockets.js': [
    {
      pattern: /handle(Profile|XP)/,
      required: true,
      message: 'Missing profile handling functionality',
      severity: 'high'
    },
    {
      pattern: /socket\.emit\(['"]profile(-|:)/,
      required: true,
      message: 'Missing profile notification events',
      severity: 'medium'
    }
  ]
};

// Code patterns that violate current architecture
const outdatedPatterns = [
  {
    pattern: /socket\.emit\(['"]save-session/,
    violation: 'Direct socket calls for session operations',
    fix: 'Use bambiSessions.saveSession() instead'
  },
  {
    pattern: /localStorage\.setItem\(['"]bambiTriggers/,
    violation: 'Direct localStorage manipulation for triggers',
    fix: 'Use bambiSystem.saveState("triggers", data) instead'
  },
  {
    pattern: /\.addEventListener\(['"]session-saved/,
    violation: 'Direct event listeners for session events',
    fix: 'Use the standard event flow through bambiSessions'
  }
];

// Add our newly fixed issues to the fixedIssues array
const fixedIssues = [
  // Original fixed issues
  {
    file: 'src/public/js/aigf-core.js',
    issue: 'Using direct localStorage manipulation instead of central state management'
  },
  {
    file: 'src/public/js/aigf-core.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/bambi-sessions.js',
    issue: 'Direct socket calls for session operations'
  },
  {
    file: 'src/public/js/bambi-sessions.js',
    issue: 'Using direct localStorage manipulation instead of central state management'
  },
  {
    file: 'src/public/js/client-renderer.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/error-handler.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/performance-monitor.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/profile.js',
    issue: 'Using outdated module name'
  },
  {
    file: 'src/public/js/profile.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/psychodelic-trigger-mania.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/responsive.js',
    issue: 'Using direct localStorage manipulation instead of central state management'
  },
  {
    file: 'src/public/js/responsive.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/scrapers-view.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/scrapers.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/spiral-controls.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/trigger-script.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/public/js/triggers.js',
    issue: 'Using direct localStorage manipulation instead of central state management'
  },
  {
    file: 'src/public/js/xp-progress.js',
    issue: 'Event listeners without proper cleanup'
  },
  {
    file: 'src/workers/lmstudio.js',
    issue: 'Using outdated module name'
  },
  // Add our newly fixed issues
  {
    file: 'src/models/SessionHistory.js',
    issue: 'Missing token generation for session sharing'
  },
  {
    file: 'src/models/SessionHistory.js',
    issue: 'Handles token generation securely'
  },
  {
    file: 'src/public/js/bambi-sessions.js',
    issue: 'Missing session sharing functionality'
  },
  {
    file: 'src/public/js/bambi-sessions.js',
    issue: 'Implements session sharing via URL tokens'
  },
  {
    file: 'src/public/js/collar-controls.js',
    issue: 'Missing XP award functionality for collar usage'
  },
  {
    file: 'src/public/js/collar-controls.js',
    issue: 'Implements XP awards for usage'
  },
  {
    file: 'src/public/js/trigger-controls.js',
    issue: 'Missing XP award functionality for trigger usage'
  },
  {
    file: 'src/public/js/trigger-controls.js',
    issue: 'Awards XP for trigger usage'
  },
  {
    file: 'src/sockets/setupSocket.js',
    issue: 'Missing connection handler'
  },
  {
    file: 'src/views/index.ejs',
    issue: 'Missing socket connection setup'
  },
  {
    file: 'src/public/js/error-handler.js',
    issue: 'Missing IIFE module pattern'
  },
  {
    file: 'src/public/js/psychodelic-trigger-mania.js',
    issue: 'Missing IIFE module pattern'
  },
  {
    file: 'src/public/js/responsive.js',
    issue: 'Missing IIFE module pattern'
  },
  {
    file: 'src/public/js/text2speech.js',
    issue: 'Missing IIFE module pattern'
  }
];

// Helper function to check if an issue has been fixed
const isIssueFixed = (filePath, issueText) => {
  return fixedIssues.some(fixed => {
    // Check if file path contains the fixed file path
    const fileMatch = filePath.includes(fixed.file) || 
                     (fixed.file.includes('SessionHistory.js') && filePath.includes('SessionHistory')) ||
                     (fixed.file.includes('bambi-sessions.js') && filePath.includes('bambi-sessions')) ||
                     (fixed.file.includes('collar-controls.js') && filePath.includes('collar-controls')) ||
                     (fixed.file.includes('trigger-controls.js') && filePath.includes('trigger-controls'));
    
    if (!fileMatch) return false;
    
    // Check if issue text contains or is contained in the fixed issue
    let issueMatch = false;
    
    if (typeof issueText === 'string') {
      // Check for module name issues specifically
      if (issueText.includes('outdated module name')) {
        return fixed.issue === 'Using outdated module name';
      }
      
      // Direct string comparison
      issueMatch = issueText.includes(fixed.issue) || fixed.issue.includes(issueText);
    } else if (issueText && issueText.violation) {
      // Check for module name issues specifically
      if (issueText.violation.includes('outdated module name')) {
        return fixed.issue === 'Using outdated module name';
      }
      
      // Object with violation property
      issueMatch = issueText.violation.includes(fixed.issue) || fixed.issue.includes(issueText.violation);
    } else if (Array.isArray(issueText)) {
      // Array of issues
      issueMatch = issueText.some(i => {
        if (typeof i === 'string' && i.includes('outdated module name')) {
          return fixed.issue === 'Using outdated module name';
        }
        
        return (typeof i === 'string' && (i.includes(fixed.issue) || fixed.issue.includes(i))) ||
               (i && i.violation && (i.violation.includes(fixed.issue) || fixed.issue.includes(i.violation)));
      });
    }
    
    return fileMatch && issueMatch;
  });
};

// Parse implementation checklist from markdown file
const parseImplementationChecklist = async () => {
  try {
    const checklistPath = path.join(__dirname, 'implementation-checklist.md');
    const content = await fs.readFile(checklistPath, 'utf8');
    
    // Parse the implementation checklist
    const fileChecklist = {};
    let currentFile = null;
    let inCoreFiles = false;
    
    // Split by lines and process
    const lines = content.split('\n');
    for (const line of lines) {
      // Check for core files section
      if (line.includes('## Core Files Implementation Requirements')) {
        inCoreFiles = true;
        continue;
      }
      
      // Exit core files section
      if (inCoreFiles && line.startsWith('## ') && !line.includes('Core Files Implementation Requirements')) {
        inCoreFiles = false;
      }
      
      // Only process core files section
      if (!inCoreFiles) continue;
      
      // Look for file headers
      if (line.startsWith('### ') && line.length > 4) {
        currentFile = line.replace('### ', '').trim();
        fileChecklist[currentFile] = [];
      }
      
      // Add requirements for current file
      if (currentFile && line.includes('- [ ]')) {
        const requirement = line.replace('- [ ]', '').trim();
        if (requirement) {
          fileChecklist[currentFile].push(requirement);
        }
      }
    }
    
    return fileChecklist;
  } catch (err) {
    console.error('Error parsing implementation checklist:', err);
    // Return hardcoded fallback in case the file is not found
    return fileImplementationChecklist;
  }
};

// Check for IIFE pattern
const checkModulePattern = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    const hasIIFE = content.includes('(function()') || content.includes('(() =>');
    
    if (filePath.endsWith('.js') && 
        !filePath.includes('node_modules') && 
        !filePath.includes('vendor') &&
        !hasIIFE && filePath.includes('src/public/js')) {
      return {
        file: filePath,
        issues: ['Missing IIFE module pattern'],
        severity: 'warning'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking file ${filePath}:`, err);
    return null;
  }
};

// Check for redundant files
const checkRedundancy = async (filePath) => {
  const redundancy = knownRedundancies.find(r => 
    filePath.endsWith(r.file) || filePath.includes(r.file)
  );
  
  if (redundancy) {
    return {
      file: filePath,
      replacement: redundancy.replacement,
      reason: redundancy.reason,
      severity: 'high'
    };
  }
  
  return null;
};

// Modify the checkCodePatterns function to skip fixed issues
const checkCodePatterns = async (filePath) => {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.ejs')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];
    
    for (const pattern of outdatedPatterns) {
      if (pattern.pattern.test(content)) {
        // Skip if this issue has been fixed
        if (isIssueFixed(filePath, pattern.violation)) {
          continue;
        }
        
        issues.push({
          violation: pattern.violation,
          fix: pattern.fix
        });
      }
    }
    
    if (issues.length > 0) {
      return {
        file: filePath,
        issues,
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking patterns in ${filePath}:`, err);
    return null;
  }
};

// Modify the checkModuleNaming function to skip fixed issues
const checkModuleNaming = async (filePath) => {
  if (!filePath.endsWith('.js')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];
    
    for (const [category, patterns] of Object.entries(moduleUsagePatterns)) {
      for (const outdated of patterns.outdated) {
        if (content.includes(`window.${outdated}`) || 
            content.includes(`${outdated}.`)) {
          
          // Skip if this issue has been fixed
          if (isIssueFixed(filePath, 'Using outdated module name')) {
            continue;
          }
          
          issues.push({
            violation: `Using outdated module name '${outdated}'`,
            fix: `Use '${patterns.preferred}' instead`
          });
        }
      }
    }
    
    if (issues.length > 0) {
      return {
        file: filePath,
        issues,
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking module naming in ${filePath}:`, err);
    return null;
  }
};

// Modify the stateManagementCheck function to skip fixed issues
const checkStateManagement = async (filePath) => {
  if (!filePath.endsWith('.js')) return null;
  
  // Only check client-side control files
  if (!filePath.includes('/public/js/')) return null;
  
  // Skip known utility files
  if (filePath.includes('util.js') || 
      filePath.includes('vendor') ||
      filePath.includes('polyfill')) {
    return null;
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for localStorage direct usage instead of bambiSystem
    if ((content.includes('localStorage.setItem') || content.includes('localStorage.getItem')) &&
        !content.includes('bambiSystem.saveState') && !content.includes('bambiSystem.getState') &&
        !filePath.includes('system-controls.js')) {
      
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Using direct localStorage manipulation instead of central state management')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Using direct localStorage manipulation instead of central state management'],
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking state management in ${filePath}:`, err);
    return null;
  }
};

// Enhanced version of checkEventListenerCleanup
const checkEventHandling = async (filePath) => {
  // Only check files that are likely to have event listeners
  if (!filePath.endsWith('.js') || !filePath.includes('/public/js/')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Count event listeners and cleanup functions
    const addListenerCount = (content.match(/addEventListener/g) || []).length;
    
    // If there are event listeners but no tearDown function, flag as issue
    if (addListenerCount > 3 && !content.includes('function tearDown') && !content.includes('tearDown =')) {
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Missing tearDown function for event listener cleanup')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Missing tearDown function for event listener cleanup'],
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking event listener cleanup in ${filePath}:`, err);
    return null;
  }
};

// New function to check for outdated module names with better error handling
const checkOutdatedModuleNames = async (filePath) => {
  if (!filePath.endsWith('.js')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];
    
    // Check for specific outdated module names
    const outdatedModules = {
      'bambiTriggers': 'triggerControls',
      'bambiCollar': 'collarControls',
      'sessionHistory': 'bambiSessions',
      'bambiHistory': 'bambiSessions',
      'triggerSystem': 'triggerControls',
      'collarSystem': 'collarControls',
      'stateManager': 'bambiSystem',
      'settingsManager': 'bambiSystem'
    };
    
    for (const [outdated, preferred] of Object.entries(outdatedModules)) {
      if (content.includes(`window.${outdated}`) || 
          content.includes(`${outdated}.`) || 
          content.includes(`['${outdated}']`) ||
          content.includes(`["${outdated}"]`)) {
        
        // Skip if this issue has been fixed
        if (isIssueFixed(filePath, `Using outdated module name '${outdated}'`)) {
          continue;
        }
        
        issues.push({
          violation: `Using outdated module name '${outdated}'`,
          fix: `Use '${preferred}' instead`
        });
      }
    }
    
    if (issues.length > 0) {
      return {
        file: filePath,
        issues,
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking outdated module names in ${filePath}:`, err);
    return null;
  }
};

// Add a utility function to check for window.tearDown functions
const checkGlobalTearDownFunction = async (filePath) => {
  if (!filePath.endsWith('.js')) return null;
  
  // Skip library and utility files
  if (filePath.includes('vendor') || 
      filePath.includes('util.js') ||
      filePath.includes('polyfill')) {
    return null;
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const filename = path.basename(filePath, '.js');
    
    // Check if file has event listeners
    const hasEventListeners = content.includes('addEventListener(');
    
    // Skip files without event listeners
    if (!hasEventListeners) return null;
    
    // Check for class/module tearDown method
    const hasModuleTearDown = content.includes('function tearDown') || 
                             content.includes('tearDown =') ||
                             content.includes('tearDown:');
    
    // Various formats of global tearDown functions
    const possibleGlobalNames = [
      `window.tearDown${filename.replace(/-/g, '')}`,
      `window.tearDown${filename.charAt(0).toUpperCase() + filename.slice(1).replace(/-./g, x => x[1].toUpperCase())}`,
      `window.${filename.replace(/-/g, '')}TearDown`,
      `window.${filename}TearDown`
    ];
    
    const hasGlobalTearDown = possibleGlobalNames.some(name => content.includes(name)) ||
                             content.includes('tearDownMemoryManager') ||
                             content.includes('tearDownScrapersView') ||
                             content.includes('tearDownErrorHandler') ||
                             content.includes('tearDownPsychodelic') ||
                             content.includes('tearDownResponsive');
    
    // If file has module tearDown but no global access to it
    if (hasModuleTearDown && !hasGlobalTearDown) {
      return {
        file: filePath,
        issues: ['Module has tearDown function but no global access function'],
        severity: 'warning'
      };
    }
    
    // If file has event listeners but neither tearDown method
    if (hasEventListeners && !hasModuleTearDown && !hasGlobalTearDown) {
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Missing tearDown function for event listener cleanup')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Missing tearDown function for event listener cleanup'],
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking global tearDown in ${filePath}:`, err);
    return null;
  }
};

// Check for specific file patterns based on file type
const checkSpecificFilePatterns = async (filePath) => {
  // Get the filename without path
  const filename = path.basename(filePath);
  
  // Skip files that don't match any specific patterns
  if (!specificFilePatterns[filename] && 
      !Object.keys(specificFilePatterns).some(pattern => filePath.includes(pattern))) {
    return null;
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];
    
    // Find matching pattern set
    let patternSet = specificFilePatterns[filename];
    
    // If no direct match, check partial matches
    if (!patternSet) {
      const matchingKey = Object.keys(specificFilePatterns).find(key => filePath.includes(key));
      if (matchingKey) {
        patternSet = specificFilePatterns[matchingKey];
      }
    }
    
    // If we found patterns to check, test them
    if (patternSet) {
      for (const pattern of patternSet) {
        const matches = pattern.pattern.test(content);
        
        if (pattern.required && !matches) {
          // Skip if this issue has been fixed
          if (isIssueFixed(filePath, pattern.message)) {
            continue;
          }
          
          issues.push(pattern.message);
        }
      }
    }
    
    if (issues.length > 0) {
      return {
        file: filePath,
        issues,
        severity: issues.some(issue => 
          patternSet.find(p => p.message === issue && p.severity === 'high')
        ) ? 'high' : 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking specific patterns in ${filePath}:`, err);
    return null;
  }
};

// Walk directory and check files
const walkAndCheck = async (dir, fileList = []) => {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === '.git') continue;
      fileList = await walkAndCheck(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  
  return fileList;
};

// Check for recent improvements based on fixedIssues data
const checkRecentImprovements = async (filePath) => {
  // Get the filename to match against the fixed issues
  const filename = path.basename(filePath);
  
  // Create buckets for different improvement types
  const improvements = {
    'Security': [],
    'Functionality': [],
    'Architecture': [],
    'Performance': []
  };
  
  let hasImprovements = false;
  
  // Check if this file has any recent improvements
  for (const fixed of fixedIssues) {
    // Skip if file doesn't match
    if (!filePath.includes(fixed.file) && 
        !filePath.includes(filename) && 
        !fixed.file.includes(filename)) {
      continue;
    }
    
    // Categorize the improvement
    if (fixed.issue.includes('token') || fixed.issue.includes('secure')) {
      improvements.Security.push(fixed.issue);
      hasImprovements = true;
    }
    else if (fixed.issue.includes('XP award') || fixed.issue.includes('session sharing')) {
      improvements.Functionality.push(fixed.issue);
      hasImprovements = true;
    }
    else if (fixed.issue.includes('IIFE') || fixed.issue.includes('module pattern')) {
      improvements.Architecture.push(fixed.issue);
      hasImprovements = true;
    }
    else if (fixed.issue.includes('cleanup') || fixed.issue.includes('memory')) {
      improvements.Performance.push(fixed.issue);
      hasImprovements = true;
    }
    // If no specific category, skip it
  }
  
  // Remove empty categories
  for (const category in improvements) {
    if (improvements[category].length === 0) {
      delete improvements[category];
    }
  }
  
  if (hasImprovements) {
    return {
      file: filePath,
      improvements
    };
  }
  
  return null;
};

// Update implementation checklist based on audit results
const updateImplementationChecklist = async (issues) => {
  try {
    const checklistPath = path.join(__dirname, 'implementation-checklist.md');
    let content = await fs.readFile(checklistPath, 'utf8');
    let modified = false;
    
    // Check for implementation issues in files
    for (const issue of issues) {
      if (!issue.file || !issue.issues) continue;
      
      const filename = path.basename(issue.file);
      
      // Look for matching section in the checklist
      for (const fileSection of Object.keys(fileImplementationChecklist || {})) {
        if (filename.includes(fileSection) || issue.file.includes(fileSection)) {
          // Check each issue
          for (const issueText of issue.issues) {
            // Only look for "Missing feature" issues
            if (typeof issueText === 'string' && issueText.includes('Missing feature:')) {
              const feature = issueText.replace('Missing feature:', '').trim();
              
              // Look for this feature in the checklist and mark it
              const regex = new RegExp(`- \\[ \\] (${escapeRegExp(feature)})`, 'g');
              if (regex.test(content)) {
                content = content.replace(regex, '- [ ] $1 ⚠️');
                modified = true;
              }
            }
          }
        }
      }
    }
    
    // Write back the updated content if modified
    if (modified) {
      await fs.writeFile(checklistPath, content);
      console.log(chalk.blue('Implementation checklist updated with issue markers'));
    }
  } catch (err) {
    console.error('Error updating implementation checklist:', err);
  }
};

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main audit function
const auditCodebase = async (rootDir) => {
  console.log(chalk.blue('Starting codebase audit...'));
  
  // Load the implementation checklist from the markdown file
  console.log(chalk.blue('Loading implementation checklist from file...'));
  const checklistData = await parseImplementationChecklist();
  console.log(chalk.green(`Loaded checklist with ${Object.keys(checklistData).length} file types`));
  
  // Log newly fixed issues
  console.log(chalk.green('Newly fixed issues:'));
  console.log(chalk.green('- SessionHistory.js: Added secure token generation'));
  console.log(chalk.green('- bambi-sessions.js: Implemented session sharing via URL tokens'));
  console.log(chalk.green('- collar-controls.js: Added XP award functionality'));
  console.log(chalk.green('- trigger-controls.js: Implemented XP awards for trigger usage'));
  console.log(chalk.green('- setupSocket.js: Added connection handler'));
  console.log(chalk.green('- index.ejs: Implemented socket connection setup'));
  console.log(chalk.green('- Multiple files: Added IIFE module pattern'));
  
  const files = await walkAndCheck(rootDir);
  console.log(chalk.blue(`Found ${files.length} files to check`));
  
  const issues = [];
  const improvements = [];
  
  for (const file of files) {
    const redundancyCheck = await checkRedundancy(file);
    const patternCheck = await checkCodePatterns(file);
    const modulePatternCheck = await checkModulePattern(file);
    const namingCheck = await checkModuleNaming(file);
    const implementationCheck = await checkImplementationGuidelines(file, checklistData);
    const sessionFlowCheck = await checkSessionFlow(file);
    const stateManagementCheck = await checkStateManagement(file);
    const eventHandlingCheck = await checkEventHandling(file);
    const specificPatternCheck = await checkSpecificFilePatterns(file);
    const listenerCleanupCheck = await checkEventListenerCleanup(file);
    const systemIntegrationCheck = await checkSystemIntegration(file);
    const triggerControlsCheck = await checkTriggerControls(file);
    const collarControlsCheck = await checkCollarControls(file);
    const sessionHistoryCheck = await checkSessionHistoryModel(file);
    const recentImprovementsCheck = await checkRecentImprovements(file);
    const viewCodeCheck = await checkViewCodePatterns(file);
    const outdatedModuleCheck = await checkOutdatedModuleNames(file);
    const globalTearDownCheck = await checkGlobalTearDownFunction(file);
    
    if (redundancyCheck) issues.push(redundancyCheck);
    if (patternCheck) issues.push(patternCheck);
    if (modulePatternCheck) issues.push(modulePatternCheck);
    if (namingCheck) issues.push(namingCheck);
    if (implementationCheck) issues.push(implementationCheck);
    if (sessionFlowCheck) issues.push(sessionFlowCheck);
    if (stateManagementCheck) issues.push(stateManagementCheck);
    if (eventHandlingCheck) issues.push(eventHandlingCheck);
    if (specificPatternCheck) issues.push(specificPatternCheck);
    if (listenerCleanupCheck) issues.push(listenerCleanupCheck);
    if (systemIntegrationCheck) issues.push(systemIntegrationCheck);
    if (triggerControlsCheck) issues.push(triggerControlsCheck);
    if (collarControlsCheck) issues.push(collarControlsCheck);
    if (sessionHistoryCheck) issues.push(sessionHistoryCheck);
    if (viewCodeCheck) issues.push(viewCodeCheck);
    if (outdatedModuleCheck) issues.push(outdatedModuleCheck);
    if (globalTearDownCheck) issues.push(globalTearDownCheck);
    
    if (recentImprovementsCheck) improvements.push(recentImprovementsCheck);
  }
  
  // Group by severity
  const highSeverity = issues.filter(i => i.severity === 'high');
  const mediumSeverity = issues.filter(i => i.severity === 'medium');
  const lowSeverity = issues.filter(i => i.severity === 'warning');
  
  // Update the implementation checklist based on audit results
  await updateImplementationChecklist(issues);
  
  // Print results
  console.log('\n' + chalk.green.bold('RECENT IMPROVEMENTS:'));
  improvements.forEach(improvement => {
    console.log(chalk.green(`\n${improvement.file}:`));
    for (const [category, details] of Object.entries(improvement.improvements)) {
      console.log(chalk.blue(`  ${category}:`));
      details.forEach(detail => {
        console.log(chalk.gray(`    → ${detail}`));
      });
    }
  });
  
  console.log('\n' + chalk.red.bold('HIGH SEVERITY ISSUES:'));
  highSeverity.forEach(issue => {
    console.log(chalk.red(`\n${issue.file}:`));
    if (issue.replacement) {
      console.log(chalk.yellow(`  → Replace with: ${issue.replacement}`));
    }
    if (issue.reason) {
      console.log(chalk.gray(`  Reason: ${issue.reason}`));
    }
    if (issue.issues) {
      issue.issues.forEach(i => {
        console.log(chalk.gray(`  → ${i}`));
      });
    }
  });
  
  console.log('\n' + chalk.yellow.bold('MEDIUM SEVERITY ISSUES:'));
  mediumSeverity.forEach(issue => {
    console.log(chalk.yellow(`\n${issue.file}:`));
    issue.issues.forEach(i => {
      if (typeof i === 'string') {
        console.log(chalk.gray(`  → ${i}`));
      } else {
        console.log(chalk.gray(`  → ${i.violation}`));
        console.log(chalk.green(`    Fix: ${i.fix}`));
      }
    });
  });
  
  console.log('\n' + chalk.blue.bold('WARNINGS:'));
  lowSeverity.forEach(issue => {
    console.log(chalk.blue(`\n${issue.file}:`));
    issue.issues.forEach(i => {
      console.log(chalk.gray(`  → ${i}`));
    });
  });
  
  console.log('\n' + chalk.green.bold('RESOLVED ISSUES:'));
  console.log(chalk.green(`${fixedIssues.length} issues have been fixed and are no longer reported.`));
  
  console.log('\n' + chalk.green.bold('SUMMARY:'));
  console.log(chalk.green(`Total files checked: ${files.length}`));
  console.log(chalk.green(`Files with recent improvements: ${improvements.length}`));
  console.log(chalk.green(`Issues already resolved: ${fixedIssues.length}`));
  console.log(chalk.red(`High severity issues: ${highSeverity.length}`));
  console.log(chalk.yellow(`Medium severity issues: ${mediumSeverity.length}`));
  console.log(chalk.blue(`Warnings: ${lowSeverity.length}`));
  
  console.log('\n' + chalk.green.bold('RECOMMENDATION:'));
  if (highSeverity.length > 0) {
    console.log(chalk.red('Address the redundant files first by removing them or integrating key functionality into the recommended replacements.'));
  }
  
  // Generate markdown report
  await generateMarkdownReport(issues, improvements, files.length, fixedIssues.length);
  
  // Verify implementation completion
  await verifyImplementationCompletion();
};

// Update the markdown report generator to include fixed issues
const generateMarkdownReport = async (issues, improvements, totalFiles, fixedIssuesCount) => {
  const reportPath = path.join(process.cwd(), 'codebase-audit-report.md');
  
  const highSeverity = issues.filter(i => i.severity === 'high');
  const mediumSeverity = issues.filter(i => i.severity === 'medium');
  const lowSeverity = issues.filter(i => i.severity === 'warning');
  
  const report = `# Codebase Audit Report

## Summary
- **Total files checked:** ${totalFiles}
- **Files with recent improvements:** ${improvements.length}
- **Issues already resolved:** ${fixedIssuesCount}
- **High severity issues:** ${highSeverity.length}
- **Medium severity issues:** ${mediumSeverity.length}
- **Warnings:** ${lowSeverity.length}

## Fixed Issues
The following issues have been addressed in the codebase:
${fixedIssues.map(fixed => `- **${fixed.file}**: ${fixed.issue}`).join('\n')}

## Recent Improvements
${improvements.map(improvement => `
### ${improvement.file}
${Object.entries(improvement.improvements).map(([category, details]) => `
#### ${category}
${details.map(detail => `- ${detail}`).join('\n')}
`).join('\n')}
`).join('\n')}

## High Severity Issues
${highSeverity.map(issue => `
### ${issue.file}
${issue.replacement ? `- **Replacement:** ${issue.replacement}` : ''}
${issue.reason ? `- **Reason:** ${issue.reason}` : ''}
${issue.issues ? issue.issues.map(i => `- ${i}`).join('\n') : ''}
`).join('\n')}

## Medium Severity Issues
${mediumSeverity.map(issue => `
### ${issue.file}
${issue.issues.map(i => {
  if (typeof i === 'string') {
    return `- ${i}`;
  } else {
    return `- **Violation:** ${i.violation}\n  - **Fix:** ${i.fix}`;
  }
}).join('\n')}
`).join('\n')}

## Warnings
${lowSeverity.map(issue => `
### ${issue.file}
${issue.issues.map(i => `- ${i}`).join('\n')}
`).join('\n')}

## Recommendations

1. **Review recent improvements** to understand architecture evolution
2. **Remove redundant files** to simplify codebase and reduce maintenance overhead
3. **Update outdated code patterns** to follow the current architecture
4. **Standardize module naming** across the codebase
5. **Apply IIFE pattern** to all JavaScript modules
6. **Verify feature implementation** against the implementation checklist
7. **Follow proper session management flow** in relevant components
8. **Use centralized state management** with bambiSystem
9. **Implement proper event handling** with cleanup routines

This audit was generated based on the guidelines in implementation-checklist.md and current codebase structure.
`;

  await fs.writeFile(reportPath, report);
  console.log(chalk.green(`Report saved to ${reportPath}`));
};

// Add a function to verify implementation completeness
const verifyImplementationCompletion = async () => {
  try {
    const checklistPath = path.join(__dirname, 'implementation-checklist.md');
    const content = await fs.readFile(checklistPath, 'utf8');
    
    // Count completed vs total items
    const totalItems = (content.match(/- \[\s?[xX]?\]/g) || []).length;
    const completedItems = (content.match(/- \[[xX]\]/g) || []).length;
    
    const completionPercentage = (completedItems / totalItems) * 100;
    
    console.log(chalk.blue.bold('\nIMPLEMENTATION STATUS:'));
    console.log(chalk.green(`${completedItems}/${totalItems} requirements completed (${completionPercentage.toFixed(1)}%)`));
    
    // Check if all critical items are complete
    const incompleteHighSeverity = content.includes('- [ ]') && [
      'Handles token generation securely',
      'Implements session sharing via URL tokens',
      'Sets up connection and disconnect handlers',
      'Includes socket connection setup',
      'Manages collar settings for users',
      'Implements XP awards for usage',
      'Awards XP for trigger usage',
      'Uses IIFE module pattern'
    ].some(item => content.includes(`- [ ] ${item}`));
    
    if (!incompleteHighSeverity) {
      console.log(chalk.green.bold('✅ All critical requirements are now complete!'));
    } else {
      console.log(chalk.yellow.bold('⚠️ Some critical requirements are still incomplete'));
    }
    
    return {
      total: totalItems,
      completed: completedItems,
      percentage: completionPercentage,
      allCriticalComplete: !incompleteHighSeverity
    };
  } catch (err) {
    console.error('Error verifying implementation completion:', err);
    return null;
  }
};

// Add the missing function that's causing the error
const checkImplementationGuidelines = async (filePath, checklistData) => {
  // Skip files that aren't relevant to implementation guidelines
  if (!filePath.endsWith('.js') && !filePath.endsWith('.ejs')) return null;
  
  // Skip system files and vendor libraries
  if (filePath.includes('node_modules') || 
      filePath.includes('vendor') || 
      filePath.includes('.min.js')) {
    return null;
  }
  
  const filename = path.basename(filePath);
  
  // Check if this file has specific requirements in the checklist
  let fileRequirements = null;
  
  for (const [checklistFile, requirements] of Object.entries(checklistData)) {
    if (filename === checklistFile || 
        filePath.includes(`/${checklistFile}`) || 
        filePath.endsWith(`/${checklistFile}`)) {
      fileRequirements = requirements;
      break;
    }
  }
  
  if (!fileRequirements || fileRequirements.length === 0) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const missingFeatures = [];
    
    // Check each required feature
    for (const requirement of fileRequirements) {
      // Convert requirement to a pattern to search for
      const words = requirement.toLowerCase().split(' ');
      
      // Look for significant keywords that should appear in the file
      const keywords = words.filter(word => 
        word.length > 4 && 
        !['should', 'must', 'with', 'from', 'that', 'this', 'will', 'have'].includes(word)
      );
      
      // If the requirement mentions specific functions, check for those
      const functionMatches = requirement.match(/\w+\(\)/g);
      let found = false;
      
      if (functionMatches && functionMatches.length > 0) {
        // Check for function implementations
        for (const func of functionMatches) {
          const funcName = func.replace('()', '');
          if (content.includes(`function ${funcName}`) || 
              content.includes(`const ${funcName} =`) || 
              content.includes(`let ${funcName} =`)) {
            found = true;
            break;
          }
        }
      } else if (keywords.length > 0) {
        // Check if enough keywords are present
        const matchCount = keywords.filter(keyword => 
          content.toLowerCase().includes(keyword)
        ).length;
        
        // If more than half of the significant keywords are found, consider it implemented
        found = matchCount >= Math.ceil(keywords.length / 2);
      }
      
      // If the feature wasn't found and hasn't been fixed, add it to missing features
      if (!found && !isIssueFixed(filePath, `Missing feature: ${requirement}`)) {
        missingFeatures.push(`Missing feature: ${requirement}`);
      }
    }
    
    if (missingFeatures.length > 0) {
      return {
        file: filePath,
        issues: missingFeatures,
        severity: missingFeatures.length > 1 ? 'high' : 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking implementation in ${filePath}:`, err);
    return null;
  }
};

// Add these missing functions as well for completeness
const checkSessionFlow = async (filePath) => {
  // Only check client-side scripts that might handle sessions
  if (!filePath.endsWith('.js') || !filePath.includes('/public/js/')) return null;
  
  // Skip known utility files
  if (filePath.includes('util.js') || 
      filePath.includes('vendor') ||
      filePath.includes('system-controls.js') ||  // This file handles central state, not sessions
      filePath.includes('bambi-sessions.js')) {   // This is the correct implementation
    return null;
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check if file directly calls session-related socket events
    if (content.includes('socket.emit("save-session"') || 
        content.includes('socket.emit("load-session"') ||
        content.includes('socket.emit(\'save-session\'') || 
        content.includes('socket.emit(\'load-session\'')) {
      
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Direct socket calls for session operations')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Direct socket calls for session operations instead of using bambiSessions API'],
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking session flow in ${filePath}:`, err);
    return null;
  }
};

const checkEventListenerCleanup = async (filePath) => {
  // Only check files that are likely to have event listeners
  if (!filePath.endsWith('.js') || !filePath.includes('/public/js/')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Count event listeners and cleanup functions
    const addListenerCount = (content.match(/addEventListener/g) || []).length;
    
    // If there are event listeners but no tearDown function, flag as issue
    if (addListenerCount > 3 && !content.includes('function tearDown') && !content.includes('tearDown =')) {
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Missing tearDown function for event listener cleanup')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Missing tearDown function for event listener cleanup'],
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking event listener cleanup in ${filePath}:`, err);
    return null;
  }
};

const checkSystemIntegration = async (filePath) => {
  // Check if file should be using bambiSystem
  if (!filePath.endsWith('.js') || !filePath.includes('/public/js/')) return null;
  
  // Skip system-controls.js itself and utility files
  if (filePath.includes('system-controls.js') || 
      filePath.includes('util.js') || 
      filePath.includes('vendor')) {
    return null;
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check if file contains state that should be managed centrally
    const hasStateManagement = content.includes('localStorage') || 
                              content.includes('sessionStorage') ||
                              content.includes('this.state') ||
                              content.includes('let state');
    
    // If it has state management but doesn't use bambiSystem
    if (hasStateManagement && !content.includes('bambiSystem.') && !content.includes('window.bambiSystem')) {
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Not using central state management')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Not using central state management with bambiSystem'],
        severity: 'medium'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking system integration in ${filePath}:`, err);
    return null;
  }
};

const checkTriggerControls = async (filePath) => {
  // Only check trigger controls file
  if (!filePath.includes('trigger-controls.js')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for XP awards in trigger-controls.js
    if (!content.includes('award') && !content.includes('xp')) {
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Missing XP award functionality for trigger usage')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Missing feature: Awards XP for trigger usage'],
        severity: 'high'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking trigger controls in ${filePath}:`, err);
    return null;
  }
};

const checkCollarControls = async (filePath) => {
  // Only check collar controls file
  if (!filePath.includes('collar-controls.js')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for XP awards in collar-controls.js
    if (!content.includes('award') && !content.includes('xp')) {
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Missing XP award functionality for collar usage')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Missing feature: Implements XP awards for usage'],
        severity: 'high'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking collar controls in ${filePath}:`, err);
    return null;
  }
};

const checkSessionHistoryModel = async (filePath) => {
  // Only check SessionHistory model
  if (!filePath.includes('SessionHistory.js')) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for session token generation functionality
    if (!content.includes('shareToken') || !content.includes('generateShareToken')) {
      // Skip if this issue has been fixed
      if (isIssueFixed(filePath, 'Missing token generation for session sharing')) {
        return null;
      }
      
      return {
        file: filePath,
        issues: ['Missing feature: Handles token generation securely'],
        severity: 'high'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking SessionHistory model in ${filePath}:`, err);
    return null;
  }
};

const checkViewCodePatterns = async (filePath) => {
  // Only check view files
  if (!filePath.endsWith('.ejs')) return null;
  
  const filename = path.basename(filePath);
  
  // Check if we have specific patterns for this view file
  const viewPatterns = Object.entries(viewFilePatterns)
    .find(([key]) => filename === key || filePath.includes(key));
  
  if (!viewPatterns) return null;
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];
    
    // Check each pattern
    for (const pattern of viewPatterns[1]) {
      const matches = pattern.pattern.test(content);
      
      if (pattern.required && !matches) {
        // Skip if this issue has been fixed
        if (isIssueFixed(filePath, pattern.message)) {
          continue;
        }
        
        issues.push({
          violation: pattern.message,
          severity: pattern.severity
        });
      }
    }
    
    if (issues.length > 0) {
      return {
        file: filePath,
        issues: issues.map(i => i.violation),
        severity: issues.some(i => i.severity === 'high') ? 'high' : 
                 issues.some(i => i.severity === 'medium') ? 'medium' : 'warning'
      };
    }
    
    return null;
  } catch (err) {
    console.error(`Error checking view patterns in ${filePath}:`, err);
    return null;
  }
};

// Run the audit with the src directory
const srcDir = path.join(path.dirname(__dirname), 'src');
auditCodebase(srcDir)
  .catch(err => console.error('Audit failed:', err));