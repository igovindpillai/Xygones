// ========================================
// XYGONES POPUP SCRIPT
// Manages UI interactions and data sync
// ========================================

// ===== TAB NAVIGATION =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    // Add active class to clicked tab
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab') + '-tab';
    document.getElementById(tabId).classList.add('active');
  });
});

// ===== TIMER FUNCTIONALITY =====
let timerInterval = null;
let timeRemaining = 0;
let isRunning = false;

// Load timer state from background
chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
  if (response) {
    updateTimerDisplay(response.timeRemaining);
    isRunning = response.isRunning;
    
    if (isRunning) {
      document.getElementById('start-timer').style.display = 'none';
      document.getElementById('stop-timer').style.display = 'inline-block';
      document.getElementById('timer-label').textContent = response.isBreak ? 'Break Time' : 'Focus Time';
      startTimerUI();
    }
  }
});

// Start timer button
document.getElementById('start-timer').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'startTimer' }, (response) => {
    if (response.success) {
      isRunning = true;
      document.getElementById('start-timer').style.display = 'none';
      document.getElementById('stop-timer').style.display = 'inline-block';
      document.getElementById('timer-label').textContent = 'Focus Time';
      startTimerUI();
    }
  });
});

// Stop timer button
document.getElementById('stop-timer').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopTimer' }, (response) => {
    if (response.success) {
      isRunning = false;
      document.getElementById('start-timer').style.display = 'inline-block';
      document.getElementById('stop-timer').style.display = 'none';
      document.getElementById('timer-label').textContent = 'Ready to Focus';
      stopTimerUI();
    }
  });
});

// Reset timer button
document.getElementById('reset-timer').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'resetTimer' }, (response) => {
    if (response.success) {
      isRunning = false;
      document.getElementById('start-timer').style.display = 'inline-block';
      document.getElementById('stop-timer').style.display = 'none';
      document.getElementById('timer-label').textContent = 'Ready to Focus';
      updateTimerDisplay(response.timeRemaining);
      stopTimerUI();
    }
  });
});

// Start UI timer countdown
function startTimerUI() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
      if (response && response.isRunning) {
        updateTimerDisplay(response.timeRemaining);
        document.getElementById('timer-label').textContent = response.isBreak ? 'Break Time' : 'Focus Time';
      } else {
        stopTimerUI();
      }
    });
  }, 1000);
}

// Stop UI timer
function stopTimerUI() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Update timer display
function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById('timer-display').textContent = 
    `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ===== GREYSCALE MODE =====
let greyscaleActive = false;

// Load greyscale state
chrome.storage.sync.get(['greyscaleMode'], (result) => {
  greyscaleActive = result.greyscaleMode || false;
  updateGreyscaleStatus();
});

// Toggle greyscale button
document.getElementById('toggle-greyscale').addEventListener('click', () => {
  greyscaleActive = !greyscaleActive;
  
  // Save state
  chrome.storage.sync.set({ greyscaleMode: greyscaleActive });
  
  // Send message to background to apply to all tabs
  chrome.runtime.sendMessage({ 
    action: 'toggleGreyscale', 
    enabled: greyscaleActive 
  });
  
  updateGreyscaleStatus();
});

// Update status indicator
function updateGreyscaleStatus() {
  const statusEl = document.getElementById('greyscale-status');
  if (greyscaleActive) {
    statusEl.textContent = '🟢';
    statusEl.title = 'Active';
  } else {
    statusEl.textContent = '⚪';
    statusEl.title = 'Inactive';
  }
}

// ===== BLOCKLIST MANAGEMENT =====
let blockedSites = [];

// Load blocked sites
function loadBlockedSites() {
  chrome.storage.sync.get(['blockedSites'], (result) => {
    blockedSites = result.blockedSites || [];
    renderBlockedList();
  });
}

// Render blocked sites list
function renderBlockedList() {
  const listEl = document.getElementById('blocked-list');
  listEl.innerHTML = '';
  
  blockedSites.forEach((site) => {
    const item = document.createElement('div');
    item.className = 'blocked-item';
    item.innerHTML = `
      <span>${site}</span>
      <button class="btn-remove" data-site="${site}">Remove</button>
    `;
    listEl.appendChild(item);
  });
  
  // Add remove event listeners
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const site = btn.getAttribute('data-site');
      removeSite(site);
    });
  });
}

// Add site to blocklist
function addSite(site) {
  // Clean the site URL
  site = site.trim().toLowerCase();
  site = site.replace(/^(https?:\/\/)?(www\.)?/, '');
  site = site.replace(/\/$/, '');
  
  if (!site) return;
  
  // Check if already exists
  if (blockedSites.includes(site)) {
    alert('Site is already in the blocklist!');
    return;
  }
  
  blockedSites.push(site);
  chrome.storage.sync.set({ blockedSites }, () => {
    renderBlockedList();
    document.getElementById('site-input').value = '';
  });
}

// Remove site from blocklist
function removeSite(site) {
  blockedSites = blockedSites.filter(s => s !== site);
  chrome.storage.sync.set({ blockedSites }, () => {
    renderBlockedList();
  });
}

// Add site button
document.getElementById('add-site').addEventListener('click', () => {
  const input = document.getElementById('site-input');
  addSite(input.value);
});

// Add site on Enter key
document.getElementById('site-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSite(e.target.value);
  }
});

// Quick add buttons
document.querySelectorAll('.btn-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    const site = btn.getAttribute('data-site');
    addSite(site);
  });
});

// Initialize blocklist
loadBlockedSites();

// ===== STATISTICS =====
function loadStatistics() {
  chrome.storage.sync.get(['stats'], (result) => {
    const stats = result.stats || {
      focusTime: 0,
      completedPomodoros: 0,
      blockedAttempts: 0,
      streak: 0
    };
    
    document.getElementById('stat-focus-time').textContent = stats.focusTime;
    document.getElementById('stat-pomodoros').textContent = stats.completedPomodoros;
    document.getElementById('stat-blocks').textContent = stats.blockedAttempts;
    document.getElementById('stat-streak').textContent = stats.streak;
  });
}

// Reset statistics
document.getElementById('reset-stats').addEventListener('click', () => {
  if (confirm('Are you sure you want to reset all statistics?')) {
    const resetStats = {
      focusTime: 0,
      completedPomodoros: 0,
      blockedAttempts: 0,
      streak: 0
    };
    
    chrome.storage.sync.set({ stats: resetStats }, () => {
      loadStatistics();
    });
  }
});

// Load stats on tab switch
document.querySelector('[data-tab="stats"]').addEventListener('click', loadStatistics);

// Initial load
loadStatistics();

// ===== SETTINGS =====
// Load settings
chrome.storage.sync.get(['focusDuration', 'breakDuration'], (result) => {
  document.getElementById('focus-duration').value = result.focusDuration || 25;
  document.getElementById('break-duration').value = result.breakDuration || 5;
});

// Save settings
document.getElementById('save-settings').addEventListener('click', () => {
  const focusDuration = parseInt(document.getElementById('focus-duration').value);
  const breakDuration = parseInt(document.getElementById('break-duration').value);
  
  if (focusDuration < 1 || focusDuration > 60 || breakDuration < 1 || breakDuration > 30) {
    alert('Please enter valid durations (Focus: 1-60 min, Break: 1-30 min)');
    return;
  }
  
  chrome.storage.sync.set({ 
    focusDuration, 
    breakDuration 
  }, () => {
    chrome.runtime.sendMessage({ action: 'updateSettings' });
    alert('Settings saved! Reset the timer to apply changes.');
  });
});

// ===== LISTEN FOR UPDATES FROM BACKGROUND =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'statsUpdated') {
    loadStatistics();
  }
});