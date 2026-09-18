// Content script that runs on WhatsApp Web
// Prevent multiple injections
if (window.whatsappAILoaded) {
  console.log('WhatsApp AI already loaded');
} else {
  window.whatsappAILoaded = true;

/** Shorthand for the interface strings - see lib/i18n.js. */
const t = (key, params) => I18n.t(key, params);

/**
 * True while this content script still belongs to a live extension. Reloading
 * or updating the extension orphans the copy already injected into an open
 * tab: `chrome.runtime.id` goes undefined and every call throws "Extension
 * context invalidated". The tab has to be reloaded to get a fresh script.
 *
 * Shared with lib/settings.js so storage and messaging report it identically.
 */
const extensionAlive = () => AISettings.extensionAlive();

/**
 * Talks to the background worker, turning the orphaned-script failure into
 * something the user can act on rather than a raw Chrome error.
 */
async function sendToBackground(message) {
  if (!extensionAlive()) throw new Error(t('notify.contextInvalidated'));

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (AISettings.isContextLost(error)) {
      throw new Error(t('notify.contextInvalidated'));
    }
    throw error;
  }
}

class WhatsAppAI {
  constructor() {
    this.messages = [];
    this.settings = AISettings.fromStored({});
    this.messageCache = new Map(); // Local cache for messages
    this.chatId = null; // Current chat identifier
    this.lastScrollPosition = 0;
    this.init();
  }

  async init() {
    try {
      // Which provider, which key, which model - see lib/settings.js
      this.settings = await AISettings.load();

      // A 1.2.x install stored a bare `geminiApiKey`; write it back in the new
      // per-provider layout so the old key is only read once.
      if (this.settings.migrated) await AISettings.save(this.settings);
    } catch (error) {
      // Unreachable storage is no reason to leave the tab without a menu: keep
      // the defaults set in the constructor and let the first action say why.
      console.error('WhatsApp AI: could not read settings -', error.message);
    }

    // Before any string is built: setupUI() below renders the menu.
    I18n.setLocale(this.settings.uiLanguage);

    // Initialize chat tracking
    this.initializeChatTracking();
    
    // Wait for WhatsApp to load
    this.waitForWhatsApp();
  }

  /** The provider, key, model and base URL currently selected. */
  get activeConfig() {
    return AISettings.activeConfig(this.settings);
  }

  get systemInstructions() {
    return this.settings.systemInstructions;
  }

  /**
   * The system prompt actually sent to the provider: the user's own
   * instructions, plus a line pinning the output language when they have
   * chosen one. Appended last so it outranks anything in the custom
   * instructions that contradicts it.
   */
  get effectiveSystemPrompt() {
    const base = this.systemInstructions || AISettings.DEFAULT_SYSTEM_INSTRUCTIONS;
    const directive = I18n.replyLanguageDirective(this.settings.replyLanguage);

    return directive ? `${base}\n\n${directive}` : base;
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
    // Orphaned by an extension reload: the cache is a convenience, and the
    // user has already been told to refresh, so drop it rather than log.
    if (!extensionAlive()) return;

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
      if (AISettings.isContextLost(error)) return;
      console.error('Error loading cached messages:', error);
    }
  }

  async saveCachedMessages() {
    if (!extensionAlive()) return;

    try {
      const cacheKey = `whatsapp_messages_${this.chatId}`;
      const dataToStore = Array.from(this.messageCache.entries());
      
      await chrome.storage.local.set({
        [cacheKey]: JSON.stringify(dataToStore)
      });
      
      console.log(`Saved ${this.messageCache.size} messages to cache`);
    } catch (error) {
      if (AISettings.isContextLost(error)) return;
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
      const fabTitle = cacheSize > 0
        ? t('fab.titleCached', { count: cacheSize })
        : t('fab.title');

      const fab = document.createElement('div');
      fab.id = 'whatsapp-ai-fab';
      fab.innerHTML = `
        <div class="ai-fab-button" title="${fabTitle}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          ${cacheSize > 0 ? `<div class="cache-indicator">${cacheSize}</div>` : ''}
        </div>
        <div class="ai-menu" id="ai-menu" style="display: none;">
          <button id="export-conversation">${t('menu.export')}</button>
          <button id="generate-response">${t('menu.generate')}</button>
          <button id="load-full-history">${t('menu.history')}</button>
          <button id="clear-cache">${t('menu.clearCache')}</button>
          <button id="settings">${t('menu.settings')}</button>
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
      this.showNotification(t('notify.activated'), 'success');
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
    
    // Sort messages chronologically (oldest first)
    const sortedMessages = this.sortMessagesChronologically(allCachedMessages);
    
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

  sortMessagesChronologically(messages) {
    // Implemented in lib/timestamps.js, which is loaded ahead of this script
    return WhatsAppTimestamps.sortMessagesChronologically(messages);
  }

  parseTimestamp(timestampStr, dateOrder) {
    return WhatsAppTimestamps.parseTimestamp(timestampStr, dateOrder);
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
          domOrder: index,
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
      const cached = this.messageCache.get(messageId);
      if (cached) {
        // Keep the tie-breaker in step with the current view
        cached.domOrder = message.domOrder;
      } else {
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
    this.showNotification(t('notify.loadingHistory'), 'info');

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
        this.showNotification(t('notify.loadingProgress', { count: currentCacheSize }), 'info');
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
    this.showNotification(t('notify.loadedMessages', { count: finalCount }), 'success');
    
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
      this.showNotification(t('notify.loadingHistory'), 'info');
      await this.loadAllMessages();
      
      const totalMessages = this.messageCache.size;
      this.showNotification(t('notify.historyLoaded', { count: totalMessages }), 'success');
    } catch (error) {
      console.error('Error loading full history:', error);
      this.showNotification(t('notify.historyFailed'), 'error');
    }
  }

  async clearMessageCache() {
    try {
      this.messageCache.clear();
      const cacheKey = `whatsapp_messages_${this.chatId}`;
      await chrome.storage.local.remove([cacheKey]);
      this.updateCacheIndicator(); // Update UI
      this.showNotification(t('notify.cacheCleared'), 'success');
    } catch (error) {
      console.error('Error clearing cache:', error);
      this.showNotification(t('notify.cacheClearFailed'), 'error');
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
      this.showNotification(t('notify.collecting'), 'info');
      
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
      
      this.showNotification(t('notify.exported', { count: messages.length }), 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showNotification(t('notify.exportFailed'), 'error');
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
          <h3>${t('instructions.title')}</h3>
          <p>${t('instructions.body')}</p>
          <textarea id="message-instructions" placeholder="${t('instructions.placeholder')}" rows="4"></textarea>
          <div class="ai-modal-buttons">
            <button id="skip-instructions" class="ai-button secondary">${t('instructions.skip')}</button>
            <button id="apply-instructions" class="ai-button primary">${t('instructions.apply')}</button>
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
    const config = this.activeConfig;
    const provider = LLMProviders.get(config.provider);

    const keyCheck = LLMProviders.validateKey(config.provider, config.apiKey);
    if (!keyCheck.valid) {
      this.showNotification(t('notify.openingSettings', { message: keyCheck.message }), 'error');
      this.openSettings();
      return;
    }

    if (!config.baseUrl) {
      this.showNotification(t('notify.needsBaseUrl', { provider: provider.label }), 'error');
      this.openSettings();
      return;
    }

    // Endpoints outside the manifest (a custom gateway, a local Ollama) need a
    // permission the user grants from the extension popup.
    if (!(await this.hasHostPermission(config))) {
      this.showNotification(
        t('notify.blockedHost', { host: this.hostLabel(config.baseUrl) }),
        'error'
      );
      return;
    }

    try {
      // Show instructions dialog first
      const messageInstructions = await this.showInstructionsDialog();

      this.showNotification(t('notify.analyzing'), 'info');

      const messages = await this.extractMessages();

      if (messages.length === 0) {
        this.showNotification(t('notify.noMessages'), 'warning');
        return;
      }

      this.showNotification(t('notify.generatingWith', { provider: provider.label }), 'info');

      const conversationText = this.formatConversationForAI(messages, messageInstructions);
      console.log('Conversation to analyze:', conversationText);

      const response = await this.callProvider(conversationText);

      if (response) {
        this.displayAIResponse(response);
        this.showNotification(t('notify.generated'), 'success');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      this.showNotification(error.message || t('notify.generateFailed'), 'error');
    }
  }

  /** The host of a base URL, for a message - never throws on a typo'd URL. */
  hostLabel(url) {
    try {
      return new URL(url).host;
    } catch (error) {
      return url || 'the provider';
    }
  }

  /** Custom endpoints are not in the manifest, so their access is granted at runtime. */
  async hasHostPermission(config) {
    const provider = LLMProviders.get(config.provider);

    // A built-in provider left on its own host is already covered by the manifest.
    const isDefaultHost = provider.defaultBaseUrl &&
      config.baseUrl.startsWith(provider.defaultBaseUrl) &&
      (provider.origins || []).some((origin) => origin.startsWith('https://'));
    if (isDefaultHost) return true;

    const reply = await sendToBackground({
      action: 'checkHostPermission',
      data: { baseUrl: config.baseUrl }
    });

    return Boolean(reply && reply.granted);
  }

  /**
   * Hands the prompt to the background worker, which owns every provider call.
   * A content script's own fetch would be a cross-origin request from
   * web.whatsapp.com and would be blocked by most providers.
   */
  async callProvider(conversationText) {
    const config = this.activeConfig;

    const userPrompt = `I'm providing you with a WhatsApp conversation. Please analyze the context and generate an appropriate response that would fit naturally as the next message in this conversation.

${conversationText}

Based on the conversation context above, generate a natural and appropriate response. Consider:
- The tone and style of the conversation
- The most recent messages and their context
- The relationship between the participants
- Any questions or topics that need addressing

Your response:`;

    const reply = await sendToBackground({
      action: 'generateResponse',
      data: {
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        systemPrompt: this.effectiveSystemPrompt,
        userPrompt
      }
    });

    if (!reply) throw new Error(t('notify.noBackgroundReply'));
    if (!reply.ok) throw new Error(reply.error);

    return reply.text;
  }

  displayAIResponse(response) {
    // Create modal to display AI response
    const modal = document.createElement('div');
    modal.id = 'ai-response-modal';
    modal.innerHTML = `
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <h3>${t('response.title')}</h3>
          <button class="ai-modal-close">&times;</button>
        </div>
        <div class="ai-modal-body">
          <textarea id="ai-response-text" readonly></textarea>
          <div class="ai-modal-actions">
            <button id="copy-response">${t('response.copy')}</button>
            <button id="insert-response">${t('response.insert')}</button>
          </div>
        </div>
      </div>
    `;
    
    // Assigned rather than interpolated into the template: the text comes from
    // whichever endpoint the user configured, and markup in it would otherwise
    // run here, in the isolated world, with the chrome.* APIs in reach.
    modal.querySelector('#ai-response-text').value = response;

    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.getElementById('copy-response').addEventListener('click', () => {
      navigator.clipboard.writeText(response);
      this.showNotification(t('notify.copied'), 'success');
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
      
      this.showNotification(t('notify.inserted'), 'success');
    } else {
      this.showNotification(t('notify.noInput'), 'error');
    }
  }

  openSettings() {
    const modal = document.createElement('div');
    modal.id = 'ai-settings-modal';

    const providerOptions = LLMProviders.list()
      .map((provider) => `<option value="${provider.id}">${provider.label}</option>`)
      .join('');

    // Each interface language names itself, so someone who cannot read the
    // language currently on screen can still find their own in the list.
    const uiLanguageOptions = I18n.LOCALES
      .map((locale) => `<option value="${locale.code}">${locale.native}</option>`)
      .join('');

    const replyLanguageOptions = I18n.REPLY_LANGUAGES
      .map((lang) => {
        const label = lang.code === 'auto' ? t('settings.replyLanguageAuto') : lang.native;
        return `<option value="${lang.code}">${label}</option>`;
      })
      .join('');

    modal.innerHTML = `
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <h3>${t('settings.title')}</h3>
          <button class="ai-modal-close">&times;</button>
        </div>
        <div class="ai-modal-body">
          <div class="setting-group">
            <label for="ui-language">${t('settings.uiLanguage')}</label>
            <select id="ui-language">${uiLanguageOptions}</select>
            <small>${t('settings.uiLanguageHint')}</small>
          </div>

          <div class="setting-group">
            <label for="reply-language">${t('settings.replyLanguage')}</label>
            <select id="reply-language">${replyLanguageOptions}</select>
            <small>${t('settings.replyLanguageHint')}</small>
          </div>

          <div class="setting-group">
            <label for="ai-provider">${t('settings.provider')}</label>
            <select id="ai-provider">${providerOptions}</select>
            <small id="provider-hint"></small>
          </div>

          <div class="setting-group">
            <label for="ai-api-key">${t('settings.apiKey')}</label>
            <input type="password" id="ai-api-key" autocomplete="off">
            <small id="api-key-hint"></small>
          </div>

          <div class="setting-group">
            <label for="ai-model">${t('settings.model')}</label>
            <input type="text" id="ai-model" list="ai-model-options" autocomplete="off">
            <datalist id="ai-model-options"></datalist>
            <small>
              ${t('settings.modelHint')}
              <button type="button" id="refresh-models" class="ai-inline-btn">${t('settings.loadModels')}</button>
            </small>
          </div>

          <div class="setting-group" id="base-url-group">
            <label for="ai-base-url">${t('settings.baseUrl')}</label>
            <input type="text" id="ai-base-url" autocomplete="off">
            <small id="base-url-hint"></small>
          </div>

          <div class="setting-group">
            <label for="system-instructions">${t('settings.systemInstructions')}</label>
            <textarea id="system-instructions" placeholder="${t('settings.systemInstructionsPlaceholder')}" rows="6"></textarea>
            <small>
              <strong>${t('settings.instructionsLead')}</strong> ${t('settings.instructionsBody')}<br>
              <strong>${t('settings.examplesLead')}</strong><br>
              • "${t('settings.example1')}"<br>
              • "${t('settings.example2')}"<br>
              • "${t('settings.example3')}"<br>
              • "${t('settings.example4')}"
            </small>
          </div>

          <div class="setting-group">
            <details>
              <summary style="cursor: pointer; margin-bottom: 10px; font-weight: 500;">${t('settings.presetsSummary')}</summary>
              <div class="preset-buttons">
                <button type="button" class="preset-btn" data-preset="professional">${t('settings.preset.professional')}</button>
                <button type="button" class="preset-btn" data-preset="friendly">${t('settings.preset.friendly')}</button>
                <button type="button" class="preset-btn" data-preset="brief">${t('settings.preset.brief')}</button>
                <button type="button" class="preset-btn" data-preset="creative">${t('settings.preset.creative')}</button>
                <button type="button" class="preset-btn" data-preset="support">${t('settings.preset.support')}</button>
                <button type="button" class="preset-btn" data-preset="translator">${t('settings.preset.translator')}</button>
              </div>
            </details>
          </div>

          <div class="setting-group">
            <label>${t('settings.testLabel')}</label>
            <button id="test-api" type="button" style="padding: 8px 16px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">${t('settings.test')}</button>
          </div>
          <div class="ai-modal-actions">
            <button id="save-settings">${t('settings.save')}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Preset instructions. Deliberately left in English whatever the interface
    // language: these are model instructions, not interface text, and every
    // provider follows an English system prompt more reliably. What language
    // the *reply* comes back in is the Reply Language setting's job.
    const presets = {
      professional: "You are a professional AI assistant. Always respond in a formal, respectful, and business-appropriate manner. Use proper grammar and avoid casual language or emojis.",
      friendly: "You are a friendly and warm AI assistant. Use a conversational tone, be approachable, and feel free to use appropriate emojis. Make responses feel personal and caring.",
      brief: "You are a concise AI assistant. Always keep responses short, direct, and to the point. Avoid lengthy explanations unless specifically asked. Maximum 1-2 sentences per response.",
      creative: "You are a creative and imaginative AI assistant. Feel free to be innovative, suggest unique ideas, and use creative language. Think outside the box and offer original perspectives.",
      support: "You are a helpful customer support agent. Be patient, understanding, and solution-focused. Always try to resolve issues and provide clear, actionable guidance. Ask clarifying questions when needed.",
      translator: "You are a helpful translation assistant. When someone writes in a language other than English, provide the translation and respond appropriately in their language. If they write in English, respond in English."
    };

    const providerSelect = modal.querySelector('#ai-provider');
    const apiKeyInput = modal.querySelector('#ai-api-key');
    const modelInput = modal.querySelector('#ai-model');
    const modelOptions = modal.querySelector('#ai-model-options');
    const baseUrlInput = modal.querySelector('#ai-base-url');
    const baseUrlGroup = modal.querySelector('#base-url-group');
    const instructionsInput = modal.querySelector('#system-instructions');
    const uiLanguageSelect = modal.querySelector('#ui-language');
    const replyLanguageSelect = modal.querySelector('#reply-language');

    // Edits live in a working copy so closing the modal discards them.
    const draft = {
      provider: this.settings.provider,
      apiKeys: Object.assign({}, this.settings.apiKeys),
      models: Object.assign({}, this.settings.models),
      baseUrls: Object.assign({}, this.settings.baseUrls),
      systemInstructions: this.settings.systemInstructions,
      uiLanguage: this.settings.uiLanguage,
      replyLanguage: this.settings.replyLanguage
    };

    /** Remembers what is on screen for the provider being switched away from. */
    const captureCurrentProvider = () => {
      draft.apiKeys[draft.provider] = apiKeyInput.value.trim();
      draft.models[draft.provider] = modelInput.value.trim();
      draft.baseUrls[draft.provider] = baseUrlInput.value.trim();
    };

    const renderProvider = (providerId) => {
      const provider = LLMProviders.get(providerId);

      providerSelect.value = provider.id;
      apiKeyInput.value = draft.apiKeys[provider.id] || '';
      apiKeyInput.placeholder = provider.keyPlaceholder || t('settings.apiKeyPlaceholder');
      modelInput.value = draft.models[provider.id] || '';
      modelInput.placeholder = provider.defaultModel || t('settings.modelPlaceholder');
      baseUrlInput.value = draft.baseUrls[provider.id] || '';
      baseUrlInput.placeholder = provider.defaultBaseUrl || 'https://your-endpoint.example/v1';

      modelOptions.innerHTML = (provider.models || [])
        .map((model) => `<option value="${model}"></option>`)
        .join('');

      // Gemini's endpoint is not swappable; everyone else may point elsewhere.
      baseUrlGroup.style.display = provider.allowCustomBaseUrl ? '' : 'none';

      const hints = [];
      if (provider.hint) hints.push(provider.hint);
      if (!provider.requiresKey) hints.push(t('settings.noKeyNeeded'));
      modal.querySelector('#provider-hint').textContent = hints.join(' ');

      const keyHint = modal.querySelector('#api-key-hint');
      if (provider.docsUrl) {
        keyHint.innerHTML =
          t('settings.keyDocs', { url: provider.docsUrl, label: provider.docsLabel }) +
          (provider.keyPrefix ? t('settings.keyPrefix', { prefix: provider.keyPrefix }) : '.') +
          `<br>${t('settings.keyStorage')}`;
      } else {
        keyHint.textContent = t('settings.keyStorage');
      }

      modal.querySelector('#base-url-hint').textContent = provider.defaultBaseUrl
        ? t('settings.baseUrlHint', { url: provider.defaultBaseUrl })
        : t('settings.baseUrlHintCustom');
    };

    renderProvider(draft.provider);
    instructionsInput.value = draft.systemInstructions;
    uiLanguageSelect.value = draft.uiLanguage;
    replyLanguageSelect.value = draft.replyLanguage;

    /**
     * Switching the interface language redraws the dialog straight away: an
     * "apply on save" language picker is the one setting where you cannot read
     * the confirmation you are being asked to trust.
     */
    uiLanguageSelect.addEventListener('change', this.guarded(async () => {
      captureCurrentProvider();
      draft.uiLanguage = uiLanguageSelect.value;
      draft.replyLanguage = replyLanguageSelect.value;
      draft.systemInstructions = instructionsInput.value.trim() || AISettings.DEFAULT_SYSTEM_INSTRUCTIONS;

      this.settings = draft;
      await AISettings.save(draft);
      I18n.setLocale(draft.uiLanguage);

      // The floating menu was built in the old language too.
      document.body.removeChild(modal);
      const fab = document.getElementById('whatsapp-ai-fab');
      if (fab) fab.remove();
      this.setupUI();
      this.openSettings();
    }));

    replyLanguageSelect.addEventListener('change', () => {
      draft.replyLanguage = replyLanguageSelect.value;
    });

    providerSelect.addEventListener('change', () => {
      const next = providerSelect.value;
      captureCurrentProvider();
      draft.provider = next;
      renderProvider(next);
    });

    modal.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        instructionsInput.value = presets[preset];

        // Visual feedback
        btn.style.background = '#25d366';
        btn.style.color = 'white';
        setTimeout(() => {
          btn.style.background = '';
          btn.style.color = '';
        }, 500);
      });
    });

    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    /** What the form currently describes, in the shape the worker expects. */
    const draftConfig = () => ({
      provider: draft.provider,
      apiKey: apiKeyInput.value.trim(),
      model: LLMProviders.resolveModel(draft.provider, modelInput.value),
      baseUrl: LLMProviders.resolveBaseUrl(draft.provider, baseUrlInput.value)
    });

    modal.querySelector('#refresh-models').addEventListener('click', this.guarded(async () => {
      const config = draftConfig();

      if (!config.baseUrl) {
        this.showNotification(t('notify.needBaseUrlFirst'), 'warning');
        return;
      }

      this.showNotification(t('notify.loadingModels'), 'info');

      const reply = await sendToBackground({
        action: 'listModels',
        data: { provider: config.provider, apiKey: config.apiKey, baseUrl: config.baseUrl }
      });

      if (!reply || !reply.ok) {
        this.showNotification(t('notify.modelsFailed', { error: (reply && reply.error) || t('notify.noResponse') }), 'error');
        return;
      }

      const models = (reply.models || []).sort();
      if (models.length === 0) {
        this.showNotification(t('notify.noModels'), 'warning');
        return;
      }

      modelOptions.innerHTML = models.map((model) => `<option value="${model}"></option>`).join('');
      this.showNotification(t('notify.modelsLoaded', { count: models.length }), 'success');
    }));

    modal.querySelector('#test-api').addEventListener('click', this.guarded(async () => {
      const config = draftConfig();
      const provider = LLMProviders.get(config.provider);

      const keyCheck = LLMProviders.validateKey(config.provider, config.apiKey);
      if (!keyCheck.valid) {
        this.showNotification(keyCheck.message, 'warning');
        return;
      }

      if (!config.baseUrl) {
        this.showNotification(t('notify.needBaseUrlFirst'), 'warning');
        return;
      }

      if (!(await this.hasHostPermission(config))) {
        this.showNotification(
          t('notify.blockedHostShort', { host: this.hostLabel(config.baseUrl) }),
          'error'
        );
        return;
      }

      this.showNotification(t('notify.testing', { provider: provider.label }), 'info');

      const reply = await sendToBackground({
        action: 'generateResponse',
        data: {
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          systemPrompt: 'You are a connection test. Reply with the single word OK.',
          userPrompt: 'Reply with the single word OK.',
          maxTokens: 16
        }
      });

      if (reply && reply.ok) {
        this.showNotification(t('notify.testOk', { provider: provider.label }), 'success');
      } else {
        this.showNotification((reply && reply.error) || t('notify.testFailed'), 'error');
      }
    }));

    modal.querySelector('#save-settings').addEventListener('click', this.guarded(async () => {
      captureCurrentProvider();

      const keyCheck = LLMProviders.validateKey(draft.provider, draft.apiKeys[draft.provider]);
      if (!keyCheck.valid && draft.apiKeys[draft.provider]) {
        this.showNotification(keyCheck.message, 'error');
        return;
      }

      draft.systemInstructions = instructionsInput.value.trim() || AISettings.DEFAULT_SYSTEM_INSTRUCTIONS;
      draft.uiLanguage = uiLanguageSelect.value;
      draft.replyLanguage = replyLanguageSelect.value;

      this.settings = draft;
      await AISettings.save(draft);
      I18n.setLocale(draft.uiLanguage);

      const config = this.activeConfig;
      if (!(await this.hasHostPermission(config))) {
        this.showNotification(
          t('notify.savedNeedsPermission', { host: this.hostLabel(config.baseUrl) }),
          'warning'
        );
      } else {
        this.showNotification(t('notify.saved'), 'success');
      }

      document.body.removeChild(modal);
    }));
  }

  /**
   * Wraps an async event handler so a failure surfaces as a notification
   * instead of an unhandled rejection in the page console. Chiefly for the
   * orphaned-script error: reloading the extension leaves the dialog on screen
   * with every button dead, and silence there looks like the extension broke.
   */
  guarded(handler) {
    return async (...args) => {
      try {
        await handler(...args);
      } catch (error) {
        console.error('WhatsApp AI:', error);
        this.showNotification(error.message || t('notify.generateFailed'), 'error');
      }
    };
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
