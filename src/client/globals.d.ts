/**
 * Build-time globals for the browser half.
 *
 * `scripts/build.mjs` defines {@link __PLUGIN_VERSION__} from `package.json`
 * while bundling, so the settings page can show the shipped version without
 * pulling the whole manifest into the browser bundle. The identifier is
 * guarded with `typeof` at its use site, which keeps the source runnable in
 * environments that do not define it (tests, plain `tsc`).
 * @module dsh-prompt-enhance/client/globals
 */

/** Plugin version injected by the client build; `typeof`-guarded at use. */
declare const __PLUGIN_VERSION__: string

/** Package name injected by the client build; `typeof`-guarded at use. */
declare const __PLUGIN_NAME__: string
