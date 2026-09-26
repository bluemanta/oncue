import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';
export default ts.config(
  { ignores: ['dist/**', '.next/**', 'next-env.d.ts', 'scripts/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
  { files: ['**/*.{ts,tsx}'], plugins: { '@next/next': next }, rules: { ...next.configs.recommended.rules, ...next.configs['core-web-vitals'].rules } },
);
