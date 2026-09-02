// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const unusedImports = require('eslint-plugin-unused-imports');
const importPlugin = require('eslint-plugin-import-x');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    plugins: {
      'unused-imports': unusedImports,
      import: importPlugin,
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: ['app', 'horde'],
          style: 'kebab-case',
        },
      ],
      // Unused imports and variables
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      // Import organization
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'no-duplicate-imports': 'off', // Handled by import/no-duplicates
      // Steer generated record-type imports through the seam (src/app/models/api.models) so a
      // future regeneration that renames these types is absorbed in one module rather than
      // rippling across the app. Service classes and enums from api-client are unaffected.
      // The seam file and the schema-validation specs are exempted below.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/api-client', '**/api-client/**'],
              importNames: [
                'ImageGenerationModelRecord',
                'TextGenerationModelRecord',
                'ControlNetModelRecord',
                'GenericModelRecord',
                'NewModelRecord',
                'ResponseReadV2ReferenceValue',
              ],
              message:
                'Import generated record types from the seam (src/app/models/api.models), not directly from api-client.',
            },
          ],
        },
      ],
    },
  },
  {
    // The seam itself and the schema-validation specs legitimately reference generated types directly.
    files: [
      'src/app/models/api.models.ts',
      'src/app/models/api.models.spec.ts',
      'src/app/models/api.models.drift.spec.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/public/**', '**/src/app/api-client/**'],
  },
);
