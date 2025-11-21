// ========================================
// XYGONES BACKGROUND SERVICE WORKER
// Handles timers, blocking, and notifications
// ========================================

// ===== GLOBAL STATE =====
let timerState = {
  isRunning: false,
  isBreak: false,
  timeRemaining: 0,
  focusDuration: 25 * 60, // seconds
  breakDuration: 5 * 60   // seconds
};

let timerInterval = null;
let blockingActive = false;

// ===== INITIALIZATION =====
chrome.runtime.onInstalled.addListener(() => {
  console.log('Xygones Extension Installed');
  
  // Initialize default settings
  chrome.storage.sync.get(['focusDuration', 'breakDuration', 'blockedSites', 'stats'], (result) => {
    if (!result.focusDuration) {
      chrome.storage.sync.set({ 
        focusDuration: 25,
        breakDuration: 5,
        blockedSites: [],
        greyscaleMode: false,
        stats: {
          focusTime: 0,
          completedPomodoros: 0,
          blockedAttempts: 0,
          streak: 0,
          lastActiveDate: new Date().toDateString()
        }
      });
    }
  });
  
  // Load settings
  loadSettings();
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(['focusDuration', 'breakDuration'], (result) => {
    timerState.focusDuration = (result.focusDuration || 25) * 60;
    timerState.breakDuration = (result.breakDuration || 5) * 60;
    timerState.timeRemaining = timerState.focusDuration;
  });
}

// ===== TIMER MANAGEMENT =====
function startTimer() {
  if (timerState.isRunning) return;
  
  timerState.isRunning = true;
  timerState.isBreak = false;
  blockingActive = true;
  
  if (timerState.timeRemaining === 0) {
    timerState.timeRemaining = timerState.focusDuration;
  }
  
  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Focus Session Started',
    message: 'Stay focused! Distractions are now blocked.',
    priority: 2
  });
  
  // Start countdown
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    timerState.timeRemaining--;
    
    if (timerState.timeRemaining <= 0) {
      timerComplete();
    }
  }, 1000);
  
  return true;
}

function stopTimer() {
  timerState.isRunning = false;
  blockingActive = false;
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Timer Stopped',
    message: 'Focus session paused.',
    priority: 1
  });
  
  return true;
}

function resetTimer() {
  stopTimer();
  timerState.timeRemaining = timerState.focusDuration;
  timerState.isBreak = false;
  return true;
}

function timerComplete() {
  if (!timerState.isBreak) {
    // Focus session complete, start break
    updateStats('pomodoro');
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🎉 Focus Session Complete!',
      message: 'Great work! Time for a break.',
      priority: 2
    });
    
    timerState.isBreak = true;
    timerState.timeRemaining = timerState.breakDuration;
    blockingActive = false; // Disable blocking during break
    
  } else {
    // Break complete
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Break Over',
      message: 'Ready to focus again?',
      priority: 2
    });
    
    stopTimer();
    timerState.timeRemaining = timerState.focusDuration;
  }
}

// ===== SITE BLOCKING =====
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!blockingActive || details.frameId !== 0) return;
  
  const url = new URL(details.url);
  const hostname = url.hostname.replace(/^www\./, '');
  
  chrome.storage.sync.get(['blockedSites'], (result) => {
    const blockedSites = result.blockedSites || [];
    
    const isBlocked = blockedSites.some(site => {
      return hostname.includes(site) || site.includes(hostname);
    });
    
    if (isBlocked) {
      // Redirect to blocked page
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('blocked.html')
      });
      
      // Update stats
      updateStats('block');
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '🛡️ Site Blocked',
        message: `Stay focused! ${hostname} is blocked during focus time.`,
        priority: 1
      });
    }
  });
});

// ===== GREYSCALE MODE =====
function applyGreyscale(enabled) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (enabled) => {
            if (enabled) {
              document.documentElement.style.filter = 'grayscale(100%)';
            } else {
              document.documentElement.style.filter = 'none';
            }
          },
          args: [enabled]
        }).catch(() => {
          // Ignore errors for restricted pages
        });
      }
    });
  });
}

// ===== STATISTICS =====
function updateStats(type) {
  chrome.storage.sync.get(['stats'], (result) => {
    const stats = result.stats || {
      focusTime: 0,
      completedPomodoros: 0,
      blockedAttempts: 0,
      streak: 0,
      lastActiveDate: new Date().toDateString()
    };
    
    const today = new Date().toDateString();
    
    // Update streak
    if (stats.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (stats.lastActiveDate === yesterday.toDateString()) {
        stats.streak++;
      } else {
        stats.streak = 1;
      }
      
      stats.lastActiveDate = today;
    }
    
    // Update specific stat
    if (type === 'pomodoro') {
      stats.completedPomodoros++;
      stats.focusTime += Math.floor(timerState.focusDuration / 60);
    } else if (type === 'block') {
      stats.blockedAttempts++;
    }
    
    chrome.storage.sync.set({ stats }, () => {
      // Notify popup to update
      chrome.runtime.sendMessage({ action: 'statsUpdated' }).catch(() => {
        // Popup might be closed
      });
    });
  });
}

// ===== MESSAGE HANDLING =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startTimer':
      const started = startTimer();
      sendResponse({ success: started });
      break;
      
    case 'stopTimer':
      const stopped = stopTimer();
      sendResponse({ success: stopped });
      break;
      
    case 'resetTimer':
      resetTimer();
      sendResponse({ 
        success: true, 
        timeRemaining: timerState.timeRemaining 
      });
      break;
      
    case 'getTimerState':
      sendResponse(timerState);
      break;
      
    case 'toggleGreyscale':
      applyGreyscale(message.enabled);
      sendResponse({ success: true });
      break;
      
    case 'updateSettings':
      loadSettings();
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false });
  }
  
  return true; // Keep message channel open for async responses
});

// Apply greyscale on new tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.sync.get(['greyscaleMode'], (result) => {
      if (result.greyscaleMode) {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              document.documentElement.style.filter = 'grayscale(100%)';
            }
          }).catch(() => {
            // Ignore errors for restricted pages
          });
        }
      }
    });
  }
});

// Load settings on startup
loadSettings();