import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  // Regra de arquitetura: o domínio não conhece Chrome nem UI.
  files: ['src/core/**/*.ts'],
  rules: {
    'no-restricted-globals': ['error', 'chrome', 'document', 'window'],
    'no-restricted-imports': [
      'error',
      { patterns: ['preact*', '**/platform/**', '**/ui/**', '**/background/**', '**/content/**'] },
    ],
  },
});
