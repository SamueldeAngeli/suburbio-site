import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['.next/**','out/**','node_modules/**','coverage/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.ts','**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
);
