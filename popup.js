// Popup script for WhatsApp AI Assistant
/* global LLMProviders, AISettings, I18n */
document.addEventListener('DOMContentLoaded', async function() {
  const openWhatsAppBtn = document.getElementById('openWhatsApp');
  const openSettingsBtn = document.getElementById('openSettings');
  const viewHelpBtn = document.getElementById('viewHelp');
  const statusDiv = document.getElementById('status');

  const t = (key, params) => I18n.t(key, params);

  // The markup ships in English; whichever language the user picked in the
  // settings dialog replaces it before anything else runs.
  const settings = await AISettings.load();
  I18n.setLocale(settings.uiLanguage);
  I18n.applyToDom(document);

  // Check if we're already on WhatsApp Web
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('web.whatsapp.com')) {
      openWhatsAppBtn.textContent = t('popup.whatsappActive');
      openWhatsAppBtn.style.background = '#28a745';
      showStatus(t('popup.extensionActive'), 'success');
    }
  });

  openWhatsAppBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      
      if (currentTab.url && currentTab.url.includes('web.whatsapp.com')) {
        // Already on WhatsApp Web, just refresh the content script
        chrome.tabs.reload(currentTab.id);
        showStatus(t('popup.refreshing'), 'success');
      } else {
        // Open WhatsApp Web
        chrome.tabs.create({ url: 'https://web.whatsapp.com' });
        showStatus(t('popup.opening'), 'success');
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
            showStatus(t('popup.refreshFirst'), 'error');
          } else {
            showStatus(t('popup.openingSettings'), 'success');
            window.close();
          }
        });
      } else {
        showStatus(t('popup.openFirst'), 'warning');
      }
    });
  });

  viewHelpBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
  });

  showConfiguredProvider(settings);

  /**
   * Shows which provider is selected and, when it sits on a host the manifest
   * does not cover - a custom gateway, a local Ollama - offers to grant access.
   *
   * The grant has to happen here: chrome.permissions.request needs both a user
   * gesture and an extension page, neither of which the settings modal on
   * WhatsApp Web can provide.
   */
  async function showConfiguredProvider(settings) {
    const config = AISettings.activeConfig(settings);
    const provider = LLMProviders.get(config.provider);

    const providerLine = document.getElementById('providerLine');
    providerLine.innerHTML =
      `${t('popup.using', { provider: `<strong>${provider.label}</strong>` })} &middot; ` +
      `${config.model || t('popup.defaultModel')}`;

    if (!config.baseUrl) return;

    let origin;
    try {
      origin = `${new URL(config.baseUrl).origin}/*`;
    } catch (error) {
      providerLine.innerHTML += `<br>${t('popup.badBaseUrl')}`;
      return;
    }

    if (await chrome.permissions.contains({ origins: [origin] })) return;

    const notice = document.getElementById('permissionNotice');
    document.getElementById('permissionText').textContent =
      t('popup.permissionNeeded', { host: new URL(config.baseUrl).host });
    notice.style.display = 'block';

    document.getElementById('grantPermission').addEventListener('click', async () => {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (granted) {
        notice.style.display = 'none';
        showStatus(t('popup.accessGranted'), 'success');
      } else {
        showStatus(t('popup.accessDenied'), 'error');
      }
    });
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status status-${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});
