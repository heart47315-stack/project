const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'dist/**',
      '.expo/**',
      '.expo-export/**',
      'node_modules/**',
      'supabase/functions/**',
      'build/**',
      'android/**',
      'ios/**',
      '**/*.bundle.js',
      '**/*.served.js',
      'src-lib-map-web-safe.js',
      'map-web-safe.served.js',
      'AppEntry.bundle.js',
    ],
  },
  {
    files: ['**/__tests__/**/*.[jt]s?(x)', '**/*.test.[jt]s?(x)'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
];
