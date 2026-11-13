/**
 * Vitest configuration.
 *
 * Only one thing needs redirecting: `@deepseek-ai/dsh-client-ui-primitives` is
 * compiled into the dsh web shell and never installed as a package here, so
 * esbuild keeps it external in the browser bundle (`packages: 'external'`).
 * Vite, which Vitest uses to transform test imports, resolves bare specifiers
 * at transform time instead — so a component test that reaches the settings
 * page (through `src/client/index`) fails before running unless the specifier
 * points at the behavioural double in `tests/support/ui-primitives.tsx`.
 *
 * Everything else keeps the defaults: suites opt into jsdom themselves with a
 * `@vitest-environment` pragma.
 * @module @surfishs/dsh-prompt-enhance/vitest.config
 */

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(new URL('./tests/support/ui-primitives.tsx', import.meta.url)),
    },
  },
})
