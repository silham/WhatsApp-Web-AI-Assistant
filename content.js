// Content script that runs on WhatsApp Web
// Prevent multiple injections
if (window.whatsappAILoaded) {
  console.log('WhatsApp AI already loaded');
} else {
  window.whatsappAILoaded = true;

class WhatsAppAI {
  constructor() {
    this.messages = [];
    this.apiKey = '';
    this.systemInstructions = '';
    this.messageCache = new Map(); // Local cache for messages
    this.chatId = null; // Current chat identifier
    this.lastScrollPosition = 0;
    this.init();
  }

  async init() {
    // Get API key and system instructions from storage
    const result = await chrome.storage.sync.get(['geminiApiKey', 'systemInstructions']);
    this.apiKey = result.geminiApiKey || '';
    this.systemInstructions = result.systemInstructions || 'You are a helpful AI assistant that generates appropriate responses for WhatsApp conversations. Keep responses natural, conversational, and contextually relevant.';
    
    // Initialize chat tracking
    this.initializeChatTracking();
    
    // Wait for WhatsApp to load
    this.waitForWhatsApp();
  }

  initializeChatTracking() {
    // Get current chat identifier
    this.chatId = this.getCurrentChatId();
    
    // Load cached messages for this chat
    this.loadCachedMessages();
    
    // Set up scroll monitoring
    this.setupScrollMonitoring();
  }

  getCurrentChatId() {
    // Try to get a unique identifier for the current chat
    const chatTitle = document.querySelector('[data-testid="conversation-info-header-chat-title"]') ||
                     document.querySelector('header span[title]') ||
                     document.querySelector('header span[dir="auto"]');
    
    if (chatTitle) {
      return chatTitle.textContent?.trim() || 'unknown-chat';
    }
    
    // Fallback: use URL or timestamp
    return window.location.href.split('/').pop() || 'chat-' + Date.now();
  }

  async loadCachedMessages() {
    try {
      const cacheKey = `whatsapp_messages_${this.chatId}`;
      const result = await chrome.storage.local.get([cacheKey]);
      
      if (result[cacheKey]) {
        const cachedData = JSON.parse(result[cacheKey]);
        this.messageCache = new Map(cachedData);
        console.log(`Loaded ${this.messageCache.size} cached messages for chat: ${this.chatId}`);
        
        // Update the UI indicator after loading
        setTimeout(() => {
          this.updateCacheIndicator();
        }, 1000);
      }
    } catch (error) {
      console.error('Error loading cached messages:', error);
    }
  }

  async saveCachedMessages() {
    try {
      const cacheKey = `whatsapp_messages_${this.chatId}`;
      const dataToStore = Array.from(this.messageCache.entries());
      
      await chrome.storage.local.set({
        [cacheKey]: JSON.stringify(dataToStore)
      });
      
      console.log(`Saved ${this.messageCache.size} messages to cache`);
    } catch (error) {
      console.error('Error saving cached messages:', error);
    }
  }

  setupScrollMonitoring() {
    const chatContainer = this.getChatContainer();
    if (!chatContainer) return;

    // Monitor scroll events to refresh message cache
    chatContainer.addEventListener('scroll', this.debounce(() => {
      this.refreshMessageCache();
    }, 500));

    // Initial message scan
    setTimeout(() => {
      this.refreshMessageCache();
    }, 2000);
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  waitForWhatsApp() {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait time
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      // Multiple selectors to check if WhatsApp has loaded
      const chatArea = document.querySelector('[data-testid="conversation-panel"]') || 
                      document.querySelector('#main') ||
                      document.querySelector('div[aria-label="Message list"]') ||
                      document.querySelector('[data-testid="chat-list"]') ||
                      document.querySelector('#pane-side');
      
      console.log(`WhatsApp AI: Checking for WhatsApp load... Attempt ${attempts}`);
      
      if (chatArea) {
        clearInterval(checkInterval);
        console.log('WhatsApp AI: WhatsApp loaded, setting up UI');
        this.setupUI();
        this.observeMessages();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.log('WhatsApp AI: Timeout waiting for WhatsApp to load');
        // Still try to setup UI in case selectors changed
        this.setupUI();
      }
    }, 1000);
  }

  setupUI() {
    // Check if UI is already setup
    if (document.getElementById('whatsapp-ai-fab')) {
      console.log('WhatsApp AI: UI already exists');
      return;
    }

      console.log('WhatsApp AI: Setting up UI');
      
      // Create floating action button with cache status
      const cacheSize = this.messageCache.size;
      const cacheStatus = cacheSize > 0 ? ` (${cacheSize} cached)` : '';
      
      const fab = document.createElement('div');
      fab.id = 'whatsapp-ai-fab';
      fab.innerHTML = `
        <div class="ai-fab-button" title="AI Assistant${cacheStatus}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          ${cacheSize > 0 ? `<div class="cache-indicator">${cacheSize}</div>` : ''}
        </div>
        <div class="ai-menu" id="ai-menu" style="display: none;">
          <button id="export-conversation">📤 Export Conversation</button>
          <button id="generate-response">🤖 Generate AI Response</button>
          <button id="load-full-history">📜 Load Full History</button>
          <button id="clear-cache">🗑️ Clear Cache</button>
          <button id="settings">⚙️ Settings</button>
        </div>
      `;    document.body.appendChild(fab);

    // Add event listeners with error handling
    try {
      const fabButton = document.querySelector('.ai-fab-button');
      const exportBtn = document.getElementById('export-conversation');
      const generateBtn = document.getElementById('generate-response');
      const loadHistoryBtn = document.getElementById('load-full-history');
      const clearCacheBtn = document.getElementById('clear-cache');
      const settingsBtn = document.getElementById('settings');

      if (fabButton) fabButton.addEventListener('click', this.toggleMenu.bind(this));
      if (exportBtn) exportBtn.addEventListener('click', this.exportConversation.bind(this));
      if (generateBtn) generateBtn.addEventListener('click', this.generateResponse.bind(this));
      if (loadHistoryBtn) loadHistoryBtn.addEventListener('click', this.loadFullHistory.bind(this));
      if (clearCacheBtn) clearCacheBtn.addEventListener('click', this.clearMessageCache.bind(this));
      if (settingsBtn) settingsBtn.addEventListener('click', this.openSettings.bind(this));
      
      console.log('WhatsApp AI: UI setup complete');
      this.showNotification('WhatsApp AI Assistant activated!', 'success');
    } catch (error) {
      console.error('WhatsApp AI: Error setting up event listeners:', error);
    }
  }

  toggleMenu() {
    const menu = document.getElementById('ai-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }

  observeMessages() {
    const chatContainer = document.querySelector('[data-testid="conversation-panel"]') || 
                         document.querySelector('#main .copyable-area');
    
    if (!chatContainer) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && this.isMessageNode(node)) {
              // New message detected - could trigger auto-response here
              console.log('New message detected');
            }
          });
        }
      });
    });

    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }

  isMessageNode(node) {
    return node.classList && (
      node.classList.contains('message-in') || 
      node.classList.contains('message-out') ||
      node.querySelector('.message-in, .message-out')
    );
  }

  async extractMessages(forExport = false) {
    // First, refresh cache with currently visible messages
    this.refreshMessageCache();
    
    // Convert cached messages to array and sort by timestamp
    const allCachedMessages = Array.from(this.messageCache.values());
    
    if (allCachedMessages.length === 0) {
      console.log('No cached messages found, scanning current view...');
      const currentMessages = this.scanVisibleMessages();
      return currentMessages;
    }
    
    // Sort messages by timestamp (parse time for proper sorting)
    const sortedMessages = allCachedMessages.sort((a, b) => {
      const timeA = this.parseTimestamp(a.timestamp);
      const timeB = this.parseTimestamp(b.timestamp);
      return timeA - timeB;
    });
    
    // For export, return ALL messages. For AI processing, return recent 50
    if (forExport) {
      console.log(`Exporting all ${sortedMessages.length} cached messages`);
      return sortedMessages;
    } else {
      const recentMessages = sortedMessages.slice(-50);
      console.log(`Using ${recentMessages.length} messages from cache for AI (total cached: ${allCachedMessages.length})`);
      return recentMessages;
    }
  }

  parseTimestamp(timestampStr) {
    try {
      // Parse timestamp like "09:21, 19/08/2025" or just "09:21"
      const match = timestampStr.match(/(\d{1,2}):(\d{2})(?:,\s*(\d{1,2})\/(\d{1,2})\/(\d{4}))?/);
      if (!match) return Date.now();
      
      const [, hours, minutes, day, month, year] = match;
      
      if (year) {
        // Full timestamp with date
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes)).getTime();
      } else {
        // Just time, assume today
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes)).getTime();
      }
    } catch (error) {
      return Date.now();
    }
  }

  scanVisibleMessages() {
    const messages = [];
    
    // Find all elements with data-pre-plain-text (this is the most reliable identifier)
    const messageElements = document.querySelectorAll('[data-pre-plain-text]');
    
    messageElements.forEach((element, index) => {
      try {
        const preText = element.getAttribute('data-pre-plain-text');
        if (!preText) return;

        // Parse the pre-text to extract timestamp and sender
        const match = preText.match(/\[([^\]]+)\]\s*(.+?):\s*$/);
        if (!match) return;

        const [, timestampStr, sender] = match;
        
        // Extract message text
        const messageText = this.extractMessageTextFromElement(element);
        if (!messageText || messageText.trim() === '') return;

        // Determine message type
        const isOutgoing = this.isOutgoingMessageElement(element);
        
        // Create message object
        const message = {
          id: index,
          text: messageText.trim(),
          timestamp: timestampStr,
          sender: sender,
          type: isOutgoing ? 'outgoing' : 'incoming',
          preText: preText,
          element: element
        };

        messages.push(message);
      } catch (error) {
        console.error('Error processing message element:', error);
      }
    });

    return messages;
  }

  createMessageId(message) {
    // Create unique ID using timestamp, sender, and first 50 chars of text
    const textPreview = message.text.substring(0, 50).replace(/\s+/g, ' ');
    return `${message.timestamp}|${message.sender}|${textPreview}`;
  }

  extractMessageTextFromElement(element) {
    // Extract text from the message element, handling multiple spans
    const textSelectors = [
      '.selectable-text span',
      '.selectable-text',
      '._ao3e span',
      '._ao3e'
    ];

    let fullText = '';
    
    for (const selector of textSelectors) {
      const textElements = element.querySelectorAll(selector);
      if (textElements.length > 0) {
        textElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && !this.isTimestamp(text) && !this.isSystemMessage(text)) {
            fullText += text + ' ';
          }
        });
        break; // Use the first selector that finds elements
      }
    }

    // Fallback: get all text content
    if (!fullText.trim()) {
      const allText = element.textContent || '';
      // Remove timestamp and system messages
      fullText = allText.replace(/\d{1,2}:\d{2}/, '').replace(/Edited|Delivered|Read/, '').trim();
    }

    return fullText.trim();
  }

  isOutgoingMessageElement(element) {
    // Check if the message is outgoing by looking at parent containers
    // The element with data-pre-plain-text is nested inside the message container
    
    // First check if the element itself has the class
    if (element.classList.contains('message-out')) {
      return true;
    }
    
    // Then check all parent elements up the tree
    let currentElement = element;
    while (currentElement && currentElement !== document.body) {
      if (currentElement.classList && currentElement.classList.contains('message-out')) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }
    
    return false;
  }

  isSystemMessage(text) {
    const systemKeywords = ['Edited', 'Delivered', 'Read', 'Seen', 'Online', 'Last seen', 'Typing'];
    return systemKeywords.some(keyword => text.includes(keyword));
  }

  updateCacheIndicator() {
    const fab = document.querySelector('.ai-fab-button');
    if (!fab) return;
    
    const existingIndicator = fab.querySelector('.cache-indicator');
    const cacheSize = this.messageCache.size;
    
    if (cacheSize > 0) {
      if (existingIndicator) {
        existingIndicator.textContent = cacheSize;
      } else {
        const indicator = document.createElement('div');
        indicator.className = 'cache-indicator';
        indicator.textContent = cacheSize;
        fab.appendChild(indicator);
      }
      fab.title = `AI Assistant (${cacheSize} cached messages)`;
    } else {
      if (existingIndicator) {
        existingIndicator.remove();
      }
      fab.title = 'AI Assistant';
    }
  }

  refreshMessageCache() {
    const visibleMessages = this.scanVisibleMessages();
    let newMessagesCount = 0;

    visibleMessages.forEach(message => {
      const messageId = this.createMessageId(message);
      if (!this.messageCache.has(messageId)) {
        this.messageCache.set(messageId, message);
        newMessagesCount++;
      }
    });

    if (newMessagesCount > 0) {
      console.log(`Added ${newMessagesCount} new messages to cache. Total: ${this.messageCache.size}`);
      this.saveCachedMessages();
      this.updateCacheIndicator(); // Update the UI indicator
    }
  }

  async loadAllMessages() {
    const chatContainer = this.getChatContainer();
    if (!chatContainer) {
      console.log('Chat container not found for scrolling');
      return;
    }

    let scrollAttempts = 0;
    const maxScrollAttempts = 50; // Increased max attempts
    let previousCacheSize = this.messageCache.size;
    let consecutiveNoChangeAttempts = 0;
    const maxNoChangeAttempts = 3;
    
    console.log('Starting comprehensive message loading...');
    this.showNotification('Loading full conversation history...', 'info');

    // Start from current position and work our way up
    const initialScrollTop = chatContainer.scrollTop;
    let currentScrollPosition = initialScrollTop;
    
    while (scrollAttempts < maxScrollAttempts && consecutiveNoChangeAttempts < maxNoChangeAttempts) {
      scrollAttempts++;
      
      // Calculate how much to scroll up (gradually increase step size)
      const scrollStep = Math.min(chatContainer.clientHeight * 2, 1000 + (scrollAttempts * 100));
      currentScrollPosition = Math.max(0, currentScrollPosition - scrollStep);
      
      // Scroll to the calculated position
      chatContainer.scrollTop = currentScrollPosition;
      console.log(`Scroll attempt ${scrollAttempts}: scrolling to position ${currentScrollPosition}`);
      
      // Wait for messages to load with longer delay for thorough loading
      await this.sleep(1200);
      
      // Additional scroll to absolute top to ensure we catch everything
      if (currentScrollPosition === 0) {
        chatContainer.scrollTop = 0;
        await this.sleep(800);
      }
      
      // Refresh cache with newly visible messages
      this.refreshMessageCache();
      
      const currentCacheSize = this.messageCache.size;
      const newMessagesLoaded = currentCacheSize - previousCacheSize;
      
      console.log(`Attempt ${scrollAttempts}: ${newMessagesLoaded} new messages, total: ${currentCacheSize}`);
      
      if (newMessagesLoaded > 0) {
        consecutiveNoChangeAttempts = 0; // Reset counter when we find new messages
        this.showNotification(`Loading... ${currentCacheSize} messages found`, 'info');
      } else {
        consecutiveNoChangeAttempts++;
        console.log(`No new messages found. Consecutive no-change attempts: ${consecutiveNoChangeAttempts}`);
      }
      
      previousCacheSize = currentCacheSize;
      
      // If we've reached the top and haven't found new messages for a while, we're done
      if (currentScrollPosition === 0 && consecutiveNoChangeAttempts >= maxNoChangeAttempts) {
        console.log('Reached top of conversation and no new messages found');
        break;
      }
    }

    // Final thorough scan at the very top
    chatContainer.scrollTop = 0;
    await this.sleep(1500);
    this.refreshMessageCache();
    
    // Scroll back to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    await this.sleep(500);
    
    // Final cache refresh at bottom
    this.refreshMessageCache();
    
    const finalCount = this.messageCache.size;
    console.log(`Finished comprehensive loading. Total messages cached: ${finalCount}`);
    this.showNotification(`Loaded ${finalCount} messages from conversation`, 'success');
    
    // Update the UI to show new cache count
    this.updateCacheIndicator();
  }

  getChatContainer() {
    // Try multiple selectors to find the chat container
    const selectors = [
      '[data-testid="conversation-panel"] [data-testid="msg-list"]',
      '[data-testid="conversation-panel"] .copyable-area',
      '#main .copyable-area',
      '[data-testid="conversation-panel"]',
      '#main',
      '.two .two-3 .two-1'
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`Found chat container with selector: ${selector}`);
        return container;
      }
    }

    console.log('No chat container found');
    return null;
  }

  isIncomingMessage(container) {
    return container.classList.contains('message-in') ||
           container.querySelector('.message-in') ||
           container.closest('.message-in') ||
           !this.isOutgoingMessage(container) && container.querySelector('[data-testid="msg-container"]');
  }

  isOutgoingMessage(container) {
    return container.classList.contains('message-out') ||
           container.querySelector('.message-out') ||
           container.closest('.message-out') ||
           container.querySelector('[data-testid="msg-container"]')?.closest('.message-out');
  }

  extractMessageText(container) {
    // Try multiple selectors to get message text
    const textSelectors = [
      '.selectable-text:not([data-testid="msg-meta"])',
      '[data-testid="conversation-text"]',
      '.copyable-text .selectable-text',
      '[data-testid="msg-text"]',
      '.quoted-mention',
      'span._ao3e'
    ];

    let text = '';
    
    for (const selector of textSelectors) {
      const elements = container.querySelectorAll(selector);
      elements.forEach(el => {
        const elementText = el.textContent?.trim();
        if (elementText && !text.includes(elementText) && !this.isTimestamp(elementText)) {
          text += elementText + ' ';
        }
      });
    }

    return text.trim();
  }

  extractTimestamp(container) {
    const timeSelectors = [
      '[data-testid="msg-time"]',
      '.x1rg5ohu',
      '._ao3e time',
      '[aria-label*=":"]',
      '.copyable-text[data-pre-plain-text] .x1c4vz4f.x2lah0s',
      'span[title*=":"]'
    ];

    for (const selector of timeSelectors) {
      const timeElement = container.querySelector(selector);
      if (timeElement) {
        const timeText = timeElement.textContent || 
                        timeElement.getAttribute('aria-label') || 
                        timeElement.getAttribute('title');
        if (timeText && this.isTimestamp(timeText)) {
          return timeText;
        }
      }
    }

    // Try to extract from data-pre-plain-text attribute
    const preTextElement = container.querySelector('[data-pre-plain-text]');
    if (preTextElement) {
      const preText = preTextElement.getAttribute('data-pre-plain-text');
      const timeMatch = preText?.match(/\[(\d{1,2}:\d{2}[^\]]*)\]/);
      if (timeMatch) {
        return timeMatch[1];
      }
    }

    return new Date().toLocaleTimeString();
  }

  extractSender(container, isIncoming) {
    if (!isIncoming) return 'You';

    // Try to extract sender from group chat
    const senderSelectors = [
      '[data-testid="msg-meta-sender"]',
      '.copyable-text[data-pre-plain-text]',
      '[data-testid="contact-name"]'
    ];

    for (const selector of senderSelectors) {
      const senderElement = container.querySelector(selector);
      if (senderElement) {
        const preText = senderElement.getAttribute('data-pre-plain-text');
        if (preText) {
          const match = preText.match(/\] (.+?):/);
          if (match) return match[1];
        }
        
        const senderText = senderElement.textContent?.trim();
        if (senderText && !this.isTimestamp(senderText)) {
          return senderText;
        }
      }
    }

    return 'Contact';
  }

  isTimestamp(text) {
    // Check if text looks like a timestamp
    return /^\d{1,2}:\d{2}/.test(text) || 
           /\d{1,2}:\d{2}/.test(text) ||
           text.includes('AM') || 
           text.includes('PM');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async loadFullHistory() {
    try {
      this.showNotification('Loading full conversation history...', 'info');
      await this.loadAllMessages();
      
      const totalMessages = this.messageCache.size;
      this.showNotification(`Loaded ${totalMessages} messages. Cache updated with full conversation history.`, 'success');
    } catch (error) {
      console.error('Error loading full history:', error);
      this.showNotification('Failed to load full conversation history', 'error');
    }
  }

  async clearMessageCache() {
    try {
      this.messageCache.clear();
      const cacheKey = `whatsapp_messages_${this.chatId}`;
      await chrome.storage.local.remove([cacheKey]);
      this.updateCacheIndicator(); // Update UI
      this.showNotification('Message cache cleared', 'success');
    } catch (error) {
      console.error('Error clearing cache:', error);
      this.showNotification('Failed to clear cache', 'error');
    }
  }

  formatConversationForAI(messages, instructionsOrIsExport = false, messageInstructions = '') {
    // Handle both old and new parameter patterns
    let isExport = false;
    let instructions = '';
    
    if (typeof instructionsOrIsExport === 'boolean') {
      // Old usage: formatConversationForAI(messages, isExport)
      isExport = instructionsOrIsExport;
      instructions = messageInstructions;
    } else {
      // New usage: formatConversationForAI(messages, messageInstructions)
      instructions = instructionsOrIsExport || '';
      isExport = false;
    }

    const messageCount = messages.length;
    let conversation = `WhatsApp Conversation Export (${messageCount} messages):\n`;
    conversation += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    if (messageCount === 0) {
      conversation += "No messages found in this conversation.\n";
      return conversation;
    }
    
    // Add conversation context
    const firstMessage = messages[0];
    const lastMessage = messages[messageCount - 1];
    conversation += `Conversation timeframe: ${firstMessage.timestamp} to ${lastMessage.timestamp}\n`;
    
    if (isExport) {
      conversation += `All messages (${messageCount} total):\n\n`;
      // For export, include ALL messages
      messages.forEach(msg => {
        conversation += `[${msg.timestamp}] ${msg.sender}: ${msg.text}\n`;
      });
    } else {
      conversation += `Recent messages (showing ${Math.min(100, messageCount)} most recent):\n\n`;
      // For AI, show most recent messages
      const messagesToShow = messages.slice(-100);
      messagesToShow.forEach(msg => {
        conversation += `[${msg.timestamp}] ${msg.sender}: ${msg.text}\n`;
      });
      
      // Add specific instructions for next message if provided
      if (instructions && instructions.trim() !== '') {
        conversation += `\n--- Instructions for next message ---\n`;
        conversation += `${instructions.trim()}\n`;
        conversation += `--- End instructions ---\n`;
      }
    }
    
    return conversation;
  }

  async exportConversation() {
    try {
      this.showNotification('Collecting conversation messages...', 'info');
      
      const messages = await this.extractMessages(true); // Pass true for full export
      const formattedConversation = this.formatConversationForAI(messages, true); // Pass true for export format
      
      // Create downloadable file
      const blob = new Blob([formattedConversation], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whatsapp-conversation-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification(`Conversation exported successfully! (${messages.length} messages)`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showNotification('Failed to export conversation', 'error');
    }
  }

  showInstructionsDialog() {
    return new Promise((resolve) => {
      // Create modal for instructions input
      const modal = document.createElement('div');
      modal.className = 'ai-modal';
      modal.id = 'instructions-modal';
      modal.innerHTML = `
        <div class="ai-modal-content">
          <h3>Instructions for Next Message</h3>
          <p>Provide specific instructions for how the AI should respond to this conversation (optional):</p>
          <textarea id="message-instructions" placeholder="Example: Be more formal, focus on technical details, be encouraging, etc." rows="4"></textarea>
          <div class="ai-modal-buttons">
            <button id="skip-instructions" class="ai-button secondary">Skip</button>
            <button id="apply-instructions" class="ai-button primary">Apply Instructions</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Focus on textarea
      const textarea = modal.querySelector('#message-instructions');
      textarea.focus();

      // Handle skip button
      modal.querySelector('#skip-instructions').addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(''); // Return empty string if skipped
      });

      // Handle apply button
      modal.querySelector('#apply-instructions').addEventListener('click', () => {
        const instructions = textarea.value.trim();
        document.body.removeChild(modal);
        resolve(instructions);
      });

      // Handle enter key in textarea (Ctrl+Enter to apply)
      textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
          const instructions = textarea.value.trim();
          document.body.removeChild(modal);
          resolve(instructions);
        } else if (e.key === 'Escape') {
          document.body.removeChild(modal);
          resolve('');
        }
      });

      // Handle backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
          resolve('');
        }
      });
    });
  }

  async generateResponse() {
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.showNotification('Please set your Gemini API key in settings', 'error');
      this.openSettings();
      return;
    }

    // Basic API key format validation
    if (!this.apiKey.startsWith('AIza')) {
      this.showNotification('Invalid API key format. Please check your Gemini API key.', 'error');
      this.openSettings();
      return;
    }

    try {
      // Show instructions dialog first
      const messageInstructions = await this.showInstructionsDialog();
      
      this.showNotification('Analyzing conversation...', 'info');
      
      const messages = await this.extractMessages();
      
      if (messages.length === 0) {
        this.showNotification('No messages found to analyze', 'warning');
        return;
      }
      
      this.showNotification('Generating AI response...', 'info');
      
      const conversationText = this.formatConversationForAI(messages, messageInstructions);
      console.log('Conversation to analyze:', conversationText);
      
      const response = await this.callGeminiAPI(conversationText);
      
      if (response) {
        this.displayAIResponse(response);
        this.showNotification('AI response generated successfully!', 'success');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      
      let errorMessage = 'Failed to generate AI response';
      
      if (error.message.includes('404')) {
        errorMessage = 'API endpoint not found. Please check your API key.';
      } else if (error.message.includes('403')) {
        errorMessage = 'API access denied. Please verify your API key permissions.';
      } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (error.message.includes('API Error')) {
        errorMessage = error.message;
      }
      
      this.showNotification(errorMessage, 'error');
    }
  }

  async callGeminiAPI(conversationText) {
    const systemPrompt = this.systemInstructions || 'You are a helpful AI assistant that generates appropriate responses for WhatsApp conversations. Keep responses natural, conversational, and contextually relevant.';
    
    const prompt = `${systemPrompt}

I'm providing you with a WhatsApp conversation. Please analyze the context and generate an appropriate response that would fit naturally as the next message in this conversation.

${conversationText}

Based on the conversation context above, generate a natural and appropriate response. Consider:
- The tone and style of the conversation
- The most recent messages and their context
- The relationship between the participants
- Any questions or topics that need addressing

Your response:`;

    try {
      // Updated API endpoint - using the correct v1 endpoint
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Details:', errorData);
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Gemini API Response:', data);
      
      // Check if response was truncated due to max tokens
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        console.warn('Response was truncated due to max tokens limit');
      }
      
      // Try different possible response structures
      let generatedText = null;
      
      // Standard Gemini response structure
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        generatedText = data.candidates[0].content.parts[0].text;
      }
      // Alternative structure - sometimes content is directly text
      else if (data.candidates?.[0]?.content && typeof data.candidates[0].content === 'string') {
        generatedText = data.candidates[0].content;
      }
      // Another possible structure
      else if (data.candidates?.[0]?.text) {
        generatedText = data.candidates[0].text;
      }
      // Check if response contains the text at root level
      else if (data.text) {
        generatedText = data.text;
      }
      
      if (!generatedText || generatedText.trim() === '') {
        console.error('No text found in response structure:', JSON.stringify(data, null, 2));
        
        // If MAX_TOKENS, show a more helpful error
        if (finishReason === 'MAX_TOKENS') {
          throw new Error('Response was truncated due to length limits. Try using fewer messages or shorter instructions.');
        }
        
        throw new Error('No text generated by AI');
      }
      
      return generatedText.trim();
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  displayAIResponse(response) {
    // Create modal to display AI response
    const modal = document.createElement('div');
    modal.id = 'ai-response-modal';
    modal.innerHTML = `
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <h3>AI Generated Response</h3>
          <button class="ai-modal-close">&times;</button>
        </div>
        <div class="ai-modal-body">
          <textarea id="ai-response-text" readonly>${response}</textarea>
          <div class="ai-modal-actions">
            <button id="copy-response">Copy to Clipboard</button>
            <button id="insert-response">Insert into Chat</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.getElementById('copy-response').addEventListener('click', () => {
      navigator.clipboard.writeText(response);
      this.showNotification('Response copied to clipboard!', 'success');
    });
    
    document.getElementById('insert-response').addEventListener('click', () => {
      this.insertResponseIntoChat(response);
      document.body.removeChild(modal);
    });
  }

  insertResponseIntoChat(response) {
    const messageInput = document.querySelector('[data-testid="message-input"]') ||
                        document.querySelector('#main footer div[contenteditable="true"]') ||
                        document.querySelector('div[data-tab="10"]');
    
    if (messageInput) {
      messageInput.focus();
      
      // Use different methods depending on the input type
      if (messageInput.contentEditable === 'true') {
        messageInput.innerHTML = response;
        
        // Trigger input event
        const event = new Event('input', { bubbles: true });
        messageInput.dispatchEvent(event);
      } else {
        messageInput.value = response;
        
        // Trigger change event
        const event = new Event('change', { bubbles: true });
        messageInput.dispatchEvent(event);
      }
      
      this.showNotification('Response inserted into chat input', 'success');
    } else {
      this.showNotification('Could not find message input field', 'error');
    }
  }

  openSettings() {
    // Create settings modal
    const modal = document.createElement('div');
    modal.id = 'ai-settings-modal';
    modal.innerHTML = `
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <h3>AI Assistant Settings</h3>
          <button class="ai-modal-close">&times;</button>
        </div>
        <div class="ai-modal-body">
          <div class="setting-group">
            <label for="gemini-api-key">Gemini API Key:</label>
            <input type="password" id="gemini-api-key" placeholder="Enter your Gemini API key (starts with AIza...)" value="${this.apiKey}">
            <small>
              1. Visit <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a><br>
              2. Click "Create API Key"<br>
              3. Copy the key (starts with "AIza")<br>
              4. Paste it above and save
            </small>
          </div>
          
          <div class="setting-group">
            <label for="system-instructions">System Instructions:</label>
            <textarea id="system-instructions" placeholder="Enter custom instructions for the AI..." rows="6">${this.systemInstructions}</textarea>
            <small>
              <strong>Instructions for the AI:</strong> Define how the AI should behave, its personality, tone, or specific guidelines.<br>
              <strong>Examples:</strong><br>
              • "Always respond in a friendly and professional manner"<br>
              • "Keep responses brief and to the point"<br>
              • "Act as a customer support agent for my business"<br>
              • "Respond in Spanish and be very enthusiastic"
            </small>
          </div>
          
          <div class="setting-group">
            <details>
              <summary style="cursor: pointer; margin-bottom: 10px; font-weight: 500;">🎯 Preset Instructions (Click to expand)</summary>
              <div class="preset-buttons">
                <button type="button" class="preset-btn" data-preset="professional">👔 Professional</button>
                <button type="button" class="preset-btn" data-preset="friendly">😊 Friendly</button>
                <button type="button" class="preset-btn" data-preset="brief">⚡ Brief</button>
                <button type="button" class="preset-btn" data-preset="creative">🎨 Creative</button>
                <button type="button" class="preset-btn" data-preset="support">🛠️ Support Agent</button>
                <button type="button" class="preset-btn" data-preset="translator">🌐 Translator</button>
              </div>
            </details>
          </div>
          
          <div class="setting-group">
            <label>Test API Connection:</label>
            <button id="test-api" type="button" style="padding: 8px 16px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">Test Connection</button>
          </div>
          <div class="ai-modal-actions">
            <button id="save-settings">Save Settings</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Preset instructions
    const presets = {
      professional: "You are a professional AI assistant. Always respond in a formal, respectful, and business-appropriate manner. Use proper grammar and avoid casual language or emojis.",
      friendly: "You are a friendly and warm AI assistant. Use a conversational tone, be approachable, and feel free to use appropriate emojis. Make responses feel personal and caring.",
      brief: "You are a concise AI assistant. Always keep responses short, direct, and to the point. Avoid lengthy explanations unless specifically asked. Maximum 1-2 sentences per response.",
      creative: "You are a creative and imaginative AI assistant. Feel free to be innovative, suggest unique ideas, and use creative language. Think outside the box and offer original perspectives.",
      support: "You are a helpful customer support agent. Be patient, understanding, and solution-focused. Always try to resolve issues and provide clear, actionable guidance. Ask clarifying questions when needed.",
      translator: "You are a helpful translation assistant. When someone writes in a language other than English, provide the translation and respond appropriately in their language. If they write in English, respond in English."
    };
    
    // Add event listeners for preset buttons
    modal.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        const textarea = document.getElementById('system-instructions');
        textarea.value = presets[preset];
        
        // Visual feedback
        btn.style.background = '#25d366';
        btn.style.color = 'white';
        setTimeout(() => {
          btn.style.background = '';
          btn.style.color = '';
        }, 500);
      });
    });
    
    // Add event listeners
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.getElementById('test-api').addEventListener('click', async () => {
      const apiKey = document.getElementById('gemini-api-key').value;
      if (!apiKey) {
        this.showNotification('Please enter an API key first', 'warning');
        return;
      }
      
      this.showNotification('Testing API connection...', 'info');
      
      try {
        const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello, this is a test.' }] }]
          })
        });
        
        if (testResponse.ok) {
          this.showNotification('API connection successful!', 'success');
        } else {
          const errorData = await testResponse.json().catch(() => ({}));
          this.showNotification(`API test failed: ${errorData.error?.message || 'Invalid API key'}`, 'error');
        }
      } catch (error) {
        this.showNotification('API test failed: Network error', 'error');
      }
    });
    
    document.getElementById('save-settings').addEventListener('click', async () => {
      const apiKey = document.getElementById('gemini-api-key').value.trim();
      const systemInstructions = document.getElementById('system-instructions').value.trim();
      
      if (apiKey && !apiKey.startsWith('AIza')) {
        this.showNotification('Invalid API key format. Should start with "AIza"', 'error');
        return;
      }
      
      this.apiKey = apiKey;
      this.systemInstructions = systemInstructions || 'You are a helpful AI assistant that generates appropriate responses for WhatsApp conversations. Keep responses natural, conversational, and contextually relevant.';
      
      await chrome.storage.sync.set({ 
        geminiApiKey: apiKey,
        systemInstructions: this.systemInstructions
      });
      
      this.showNotification('Settings saved successfully!', 'success');
      document.body.removeChild(modal);
    });
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `ai-notification ai-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openSettings' && window.whatsappAI) {
    window.whatsappAI.openSettings();
    sendResponse({ success: true });
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.whatsappAI = new WhatsAppAI();
  });
} else {
  window.whatsappAI = new WhatsAppAI();
}

} // Close the whatsappAILoaded check
