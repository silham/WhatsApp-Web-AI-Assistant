// Help page script: renders the documentation in the chosen language.
/* global AISettings, I18n */
document.addEventListener('DOMContentLoaded', async function () {
  const settings = await AISettings.load();

  const select = document.getElementById('page-language');
  select.innerHTML = I18n.LOCALES
    .map((locale) => `<option value="${locale.code}">${locale.native}</option>`)
    .join('');

  function render(locale) {
    I18n.setLocale(locale);
    I18n.applyToDom(document);
    document.title = I18n.t('help.pageTitle');
    select.value = I18n.getLocale();
  }

  render(settings.uiLanguage);

  /**
   * Switching here writes the choice back to storage, so the picker doubles as
   * a settings control: someone who landed on this page from the popup can fix
   * the language without first finding the settings dialog inside WhatsApp Web.
   */
  select.addEventListener('change', async () => {
    settings.uiLanguage = select.value;
    await AISettings.save(settings);
    render(settings.uiLanguage);
  });
});
