// @ts-check
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import {defineConfig, globalIgnores} from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const HOUSE_RULES = {
  'arrow-body-style': ['error', 'as-needed'],
  curly: ['error', 'all'],
  'no-console': ['error', {allow: ['warn', 'error']}],
  'simple-import-sort/exports': 'error',
  'simple-import-sort/imports': 'error',
  'unused-imports/no-unused-imports': 'error',
};

const HOUSE_TS_RULES = {
  '@typescript-eslint/array-type': ['error', {default: 'array'}],
  '@typescript-eslint/explicit-member-accessibility': [
    'error',
    {accessibility: 'explicit', overrides: {constructors: 'no-public'}},
  ],
  '@typescript-eslint/no-unused-vars': 'off',
  'unused-imports/no-unused-vars': [
    'error',
    {argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_'},
  ],
};

export default defineConfig(
  globalIgnores(['dist/', '.angular/', 'coverage/', 'out-tsc/', 'playwright-report/', 'test-results/']),
  {
    plugins: {'simple-import-sort': simpleImportSort, 'unused-imports': unusedImports},
    rules: HOUSE_RULES,
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...HOUSE_TS_RULES,
      '@angular-eslint/component-selector': ['error', {type: 'element', prefix: 'app', style: 'kebab-case'}],
      '@angular-eslint/directive-selector': ['error', {type: 'attribute', prefix: 'app', style: 'camelCase'}],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', {allowWithDecorator: true}],
      '@typescript-eslint/restrict-template-expressions': ['error', {allowNumber: true}],
    },
  },
  {
    files: ['projects/carousel/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': ['error', {type: 'element', prefix: 'ui', style: 'kebab-case'}],
      '@angular-eslint/directive-selector': ['error', {type: 'attribute', prefix: 'ui', style: 'camelCase'}],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['scripts/**', 'e2e/serve.ts'],
    rules: {'no-console': 'off'},
  },
  eslintConfigPrettier
);
