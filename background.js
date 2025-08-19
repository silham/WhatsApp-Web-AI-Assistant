// Background service worker for WhatsApp AI Assistant
chrome.runtime.onInstalled.addListener(() => {
  console.log('WhatsApp AI Assistant installed');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportConversation') {
    // Handle conversation export
    handleConversationExport(request.data);
  } else if (request.action === 'generateResponse') {
    // Handle AI response generation
    handleAIGeneration(request.data);
  }
  
  sendResponse({ success: true });
});

function handleConversationExport(conversationData) {
  // Additional processing for conversation export
  console.log('Exporting conversation:', conversationData);
}

function handleAIGeneration(requestData) {
  // Additional processing for AI generation
  console.log('Generating AI response:', requestData);
}

// Handle tab updates to inject content script
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
    try {
      // Check if content script is already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => window.whatsappAILoaded || false
      });
      
      const isAlreadyLoaded = results && results[0] && results[0].result;
      
      if (!isAlreadyLoaded) {
        // Inject content script only if not already loaded
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        // Inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['styles.css']
        });
        
        console.log('WhatsApp AI content script injected successfully');
      } else {
        console.log('WhatsApp AI already loaded on this tab');
      }
    } catch (err) {
      console.log('Error injecting content script:', err);
    }
  }
});
