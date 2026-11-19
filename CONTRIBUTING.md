# Contributing

Thanks for helping improve dsh-prompt-enhance! This is a [DeepSeek Harness](https://github.com/deepseek-ai) web plugin: one npm package with a Node (host) half and a browser half.

## Setup

Prerequisites: DSH `>= 0.1.1-rc.2 < 0.3.0` and Node `^22.19.0 || >=24.0.0` (the same table as the README). DSH itself is only needed for the local debug loop and the optional host-primitives check; the unit suites and the build run without it.

Fork this repository on GitHub if you plan to send changes, then clone your fork — a clone of the upstream repository is read-only for you:

```bash
git clone https://github.com/<your-account>/dsh-prompt-enhance.git
cd dsh-prompt-enhance
npm install
npm test          # unit + real-http + component suites
npm run typecheck
npm run build     # tsc + esbuild → lib/index.js (host ESM) + lib/client.js (browser ModuleLoader bundle)
npm run check:host-primitives
                  # optional: assert the INSTALLED dsh shell still exports the UI
                  # primitives the settings pages import (auto-skips when no shell
                  # is present). The unit tests use a hand-written double, so this
                  # is the only local signal that the real shell has not drifted.
                  # Point DSH_ASAR at the shell's app.asar when auto-detection misses.
```

## Local debug loop

```bash
dsh plugin --profile <your-profile> add link:<path-to-your-checkout>   # once
npm run watch                                                          # keep rebuilding both halves
# restart `dsh web` after changing host-half code; browser-half changes
# need a page reload (and a rebuild first)
```

`<your-profile>` is the profile you actually boot (for example `web` or `desktop`). When you are done debugging, point that profile back at whatever you normally run — your own build, or the published package if you do not keep a local one.

## Ground rules

- **`lib/` is committed** so GitHub installs need no build step. Always run `npm run build` before pushing — CI fails if `lib/` drifts from `src/`.
- Keep the two convergence invariants intact: client guards and the host route must agree through `src/shared/`; the HTTP route and `/enhance` command must both go through `src/orchestrate.ts`.
- The host route is loopback-only by design (see the “安全” (Security) section of the README). Don't add auth-bypass or network-listening changes without discussion.
- New user-visible strings go into **both** dictionaries in `src/client/locales.ts` (zh is the key-set source of truth).
- Tests: `npx vitest run` — prefer a regression test alongside any bug fix. Component tests use jsdom + React Testing Library with a fake input store; host-route tests use a real `node:http` server with a stubbed `ctx.llm`.

## Submitting

1. Branch from `main`, make your change with tests.
2. `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build` — all green.
3. Open a PR describing what changed and why (the repository's pull-request template lists the checks); CI must pass.

`main` is not protected: the maintainer commits to it directly, while changes from anyone else are expected to arrive as pull requests.

## Releasing (maintainers)

Only the repository owner does this; a fork needs none of it — publishing requires the `@surfishs` scope on npm, which lives on the maintainer's account.

1. Bump `version` in `package.json` and add the matching `CHANGELOG.md` entry. This project follows Semantic Versioning, so the major/minor/patch choice describes what actually changed.
2. Run `npm run build`. `lib/client.js` inlines the version, so the committed artifacts must be regenerated; commit them together with the manifest.
3. Push the branch, then tag the release commit `v<version>` and push the tag. The publish workflow rejects a tag that does not match `package.json`, and a matching tag publishes the npm package (with provenance) on its own.
4. Once the tag's publish workflow has passed, create the GitHub Release from your own machine with the notes you confirmed before tagging: `gh release create <tag> --verify-tag --notes-file <notes>`. Registry propagation can lag and is checked separately; do not wait for it before creating the Release.
