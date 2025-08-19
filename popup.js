// Popup script for WhatsApp AI Assistant
document.addEventListener('DOMContentLoaded', function() {
  const openWhatsAppBtn = document.getElementById('openWhatsApp');
  const openSettingsBtn = document.getElementById('openSettings');
  const viewHelpBtn = document.getElementById('viewHelp');
  const statusDiv = document.getElementById('status');

  // Check if we're already on WhatsApp Web
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('web.whatsapp.com')) {
      openWhatsAppBtn.textContent = 'WhatsApp Web Active';
      openWhatsAppBtn.style.background = '#28a745';
      showStatus('Extension is active on WhatsApp Web', 'success');
    }
  });

  openWhatsAppBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      
      if (currentTab.url && currentTab.url.includes('web.whatsapp.com')) {
        // Already on WhatsApp Web, just refresh the content script
        chrome.tabs.reload(currentTab.id);
        showStatus('Refreshing WhatsApp Web...', 'success');
      } else {
        // Open WhatsApp Web
        chrome.tabs.create({ url: 'https://web.whatsapp.com' });
        showStatus('Opening WhatsApp Web...', 'success');
      }
    });
  });

  openSettingsBtn.addEventListener('click', function() {
    // Check if we're on WhatsApp Web to open settings
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      
      if (currentTab.url && currentTab.url.includes('web.whatsapp.com')) {
        // Send message to content script to open settings
        chrome.tabs.sendMessage(currentTab.id, { action: 'openSettings' }, function(response) {
          if (chrome.runtime.lastError) {
            showStatus('Please refresh WhatsApp Web first', 'error');
          } else {
            showStatus('Opening settings...', 'success');
            window.close();
          }
        });
      } else {
        showStatus('Please open WhatsApp Web first', 'warning');
      }
    });
  });

  viewHelpBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status status-${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});
