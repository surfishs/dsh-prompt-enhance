# Dependency risk register

Accepted, tracked dependency findings that are **not** fixed deliberately. Everything here is a
`devDependencies` issue: `npm audit --omit=dev` reports **0** findings, because the published
package's only runtime dependency is `@deepseek-ai/schemastery`.

Last reviewed: 2026-11-16, against `npm audit --registry=https://registry.npmjs.org`.

## DR-1 — minimatch denial of service behind typescript-eslint (7 moderate)

| | |
|---|---|
| Advisory | CVE-2026-118764 / GHSA-g3hv-75wg-m249 (CWE-405, asymmetric resource consumption) |
| Vulnerable range | `>= 7.0.0, < 11.0.1` |
| Affected here | `@typescript-eslint/typescript-estree/node_modules/minimatch@10.2.6` |
| Propagates to | `@typescript-eslint/{parser,type-utils,utils,eslint-plugin}` and `typescript-eslint` |
| Status | **Accepted. No upstream fix on a stable release.** |

### Why it is not fixed

`@typescript-eslint/typescript-estree@8.72.2` (the current `latest`) declares `minimatch: ^10.2.2`.
That whole range is below the patched `11.0.1`, so no resolvable version satisfies both. The fix
exists only as a prerelease: `@typescript-eslint/typescript-estree@8.72.3-alpha.8` declares
`minimatch: ^11.0.1`.

The root `minimatch@11.0.8` in this tree is **not** affected — only the nested copy is.

### Why the suggested "fix" is wrong

`npm audit` proposes `typescript-eslint@8.36.0` with `isSemVerMajor: true`. That is a **downgrade
that fixes nothing**: `8.36.0` pins `minimatch: ^9.0.4`, which is also inside
`>= 7.0.0, < 11.0.1`. It would roll back 36 minor versions and leave the finding in place.

**Do not run `npm audit fix` or `npm audit fix --force` on this repository.**

### Why overriding is not worth it

An `overrides: { "minimatch": "^11.0.1" }` entry would clear the 7 findings, but it forces a
transitive dependency across a major boundary into code that is written against minimatch 10,
and it cannot be verified by this suite (lint only exercises the globs this repository happens to
use, not the ones future rules will).

Severity of the exposure is low: the advisory is a denial of service reachable only by feeding a
crafted glob. Every glob this project matches against comes from its own `eslint.config.mjs`,
`package.json` scripts and `vitest.config.ts` — there is no externally controlled input path.

### When to revisit

Watch for `typescript-eslint@8.73.0` (the stable line that adopts `minimatch: ^11.0.1`). Once it
lands:

```bash
npm install -D typescript-eslint@^8.73.0 --registry=https://registry.npmjs.org
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
npm audit --registry=https://registry.npmjs.org   # expect 0
```

Committing new dependency versions also means committing a rebuilt `lib/` if `src/` changed.

## Resolved previously

| Date | Chain | Resolution |
|---|---|---|
| 2026-11-16 | tinypool / `@vitest/mocker` (2 critical, 1 moderate) | `vitest` 3.2.7 → 4.1.12; the v4 worker pool no longer depends on `tinypool` |
| 2026-11-16 | zod (1 high, 7 propagated) | dev SDK `@deepseek-ai/dsh-*` 0.2.1-rc.5 → 0.2.2-rc.3, which pins `zod@4.6.6`; `@deepseek-ai/cordis` moved to `~4.1.0` to satisfy the new peers |
