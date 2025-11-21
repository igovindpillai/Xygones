// ========================================
// XYGONES CONTENT SCRIPT
// Injects greyscale filter and handles blocking
// ========================================

// Apply greyscale mode if enabled
chrome.storage.sync.get(['greyscaleMode'], (result) => {
  if (result.greyscaleMode) {
    document.documentElement.style.filter = 'grayscale(100%)';
  }
});

// Listen for greyscale toggle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'applyGreyscale') {
    if (message.enabled) {
      document.documentElement.style.filter = 'grayscale(100%)';
    } else {
      document.documentElement.style.filter = 'none';
    }
    sendResponse({ success: true });
  }
  return true;
});