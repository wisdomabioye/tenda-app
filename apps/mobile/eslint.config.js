// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `.expo/` is generated (expo-router's route types among it) and carries
    // directives for code nobody here wrote; `dist/` is build output.
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // The jest harness runs under jest's globals like any suite does — it is
    // just not matched by the test-file patterns eslint-config-expo applies
    // them to, which is why `jest.fn` read as undefined here alone.
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
