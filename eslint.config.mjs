import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'data/**',
      'drizzle/**',
      'evals/**',
      'scripts/**',
      '*.config.*',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        warnOnUnsupportedTypeScriptVersion: false,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
];
