/**
 * ESLint flat config.
 *
 * Scope: `src/` and `tests/` only. `lib/` is generated, `docs/` is prose, and
 * `scripts/build.mjs` is already covered by `tsc --checkJs` (it is in the
 * tsconfig program), so linting it a second time would only add node globals
 * to this file.
 *
 * The ruleset is deliberately the two `recommended` sets plus a small number of
 * local adjustments — the goal of the first pass is a green baseline, not a
 * style opinion. `no-explicit-any` stays a warning because the cross-generation
 * structural faces in `src/client/` legitimately narrow `unknown`, and a hard
 * error there would push authors toward `as never` casts instead.
 *
 * @module dsh-prompt-enhance/eslint
 */

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['lib/**', 'node_modules/**', 'docs/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // An unused parameter is often part of a signature the host supplies;
      // the `_` prefix is the existing convention for "required but unused".
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // `catch {}` is a load-bearing pattern here: every optional service
      // failure degrades instead of throwing, and the empty block IS the
      // decision (the comment above it explains why).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Hooks correctness is a real correctness question in this half: every slot
    // component talks to host-provided hooks (`useInput`, `useSession`) whose
    // dependencies the plugin cannot see. `exhaustive-deps` therefore stays a
    // warning — it points at a dependency the author should consciously accept,
    // never at something the build refuses.
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Hand-written `.d.ts` files mirror host surfaces the plugin cannot import
    // (see src/client/primitives.d.ts). `any` there is the deliberate
    // "unknown host shape" spelling, not a shortcut, so the rule is off.
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
)
