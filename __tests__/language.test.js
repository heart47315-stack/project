const { DEFAULT_LANGUAGE, getLanguageText, normalizeLanguage } = require('../src/utils/i18n');

describe('language helpers', () => {
  it('falls back to Thai when an unsupported locale is passed', () => {
    expect(normalizeLanguage('fr')).toBe(DEFAULT_LANGUAGE);
  });

  it('returns English copy for a known translation key', () => {
    expect(getLanguageText('en', 'loginWelcome')).toBe('Welcome back');
  });

  it('labels a non-repeating health task as one time in both languages', () => {
    expect(getLanguageText('th', 'task_none')).toBe('หนึ่งครั้ง');
    expect(getLanguageText('en', 'task_none')).toBe('Once');
  });
});
