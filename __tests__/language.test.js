const { DEFAULT_LANGUAGE, getLanguageText, normalizeLanguage } = require('../src/utils/i18n');

describe('language helpers', () => {
  it('falls back to Thai when an unsupported locale is passed', () => {
    expect(normalizeLanguage('fr')).toBe(DEFAULT_LANGUAGE);
  });

  it('returns English copy for a known translation key', () => {
    expect(getLanguageText('en', 'loginWelcome')).toBe('Welcome back');
  });
});
