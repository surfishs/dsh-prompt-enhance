# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [0.0.8] - 2026-11-16

### Added

- ESLint (js, typescript-eslint and react-hooks recommended sets) and Prettier, with `npm run lint` / `npm run format:check` gates in CI.
- `src/shared/limits.ts` as the single source of the field bounds shared by the schema and the request path.
- A one-line host warning when the settings probe throws, instead of a silent fall back to the composition config.

### Changed

- Browser transport failures are localized from a stable reason instead of hardcoded Chinese copy, so an English UI no longer shows Chinese detail lines.
- `settings-page` split into five modules: spec, copy, styles, controls and the page itself.
- The browser defaults are taken from the shared default table instead of being re-typed.
- The published package carries only `docs/images/**`, and the development docs list the new lint and format commands.

### Removed

- The eleven documentation files inherited from the upstream 0.2.3–0.3.4 line (release notes and the 0.2.2-era code review); this fork's history starts at 0.0.1.
- Dead code the new linter surfaced: an unused `previousMargin` local, an unused `SettingsFace` interface, and an unused `stripTrailingFence` helper.

### Security

- Development dependencies were moved off two advisory classes: `vitest` 4 no longer pulls `tinypool`, and the dev SDK now pins `zod@4.6.6`. The published runtime dependency set is unchanged.

[0.0.8]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.7...v0.0.8

## [0.0.7] - 2026-11-16

### Added

- Group tuning and deployment limits behind a collapsible Advanced settings section, with common rows first and the custom system prompt kept visible.

### Changed

- Refine the Advanced settings row with a custom chevron, centered layout and hover state; rename the Chinese label to 高级设置.
- Add hover and keyboard-focus feedback to the reset-default and refresh-tier chips.

### Fixed

- Save immediately when a setting is reset to its default.

[0.0.7]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.6...v0.0.7

## [0.0.6] - 2026-11-16

### Added

- Auto-save settings per field: text and number rows save 800 ms after typing or immediately on blur/Enter; switches, selects and segmented choices save immediately.

### Changed

- Move the save status next to the manual Save button; show Saving/Saved/Save failed, with success clearing after 2 seconds.
- Put `reasoningEffort` above `temperature`; ellipsize long segmented labels with a full tooltip; shorten the Chinese provider-default label.
- Refresh the README security, troubleshooting, English screenshot, license and credits sections.

### Fixed

- Skip writes when a focused field is blurred without changing its value.
- Show status feedback when the manual Save button is pressed.

[0.0.6]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.5...v0.0.6

## [0.0.5] - 2026-11-16

### Fixed

- Align the standalone undo row with the composer after the result card closes.
- Keep the result close button pinned to the header corner while the result is still streaming.

### Changed

- Right-align the undo row, shorten its copy, strengthen the success check, and give it a bordered pill with a clearer 28px Undo button.
- Refresh the README install and usage guidance and the panel screenshot.

[0.0.5]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.4...v0.0.5

## [0.0.4] - 2026-11-16

### Changed

- Use English for all model-facing prompt framing; align the context truncation marker with the system prompt.
- Refresh the README with the docked result card, current-draft regenerate and empty-draft behavior, and add a panel screenshot.

[0.0.4]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.3...v0.0.4

## [0.0.3] - 2026-11-15

### Added

- Dock the result as a non-modal card above the composer, with model, elapsed and token badges plus transient Copied, Regenerated, Replaced and Undone confirmations.
- Add Regenerate and retry-from-error actions that use the current composer draft.
- Keep partial max-token results and show a truncation warning instead of failing the call.

### Changed

- Keep the applied card open with an undo action; close it on send or Escape.
- Dim the composer button on an empty or attachment-only draft, show an explanatory title, and make click and shortcut no-ops; use `not-allowed` for empty and `progress` for busy states.
- Draw the composer mark with the fish-plus-sparkle icon and give the action row icons at a shared 28px height.
- Keep the copy button width stable while it reports success.
- Lead the stale-result warning with the changed draft.

### Fixed

- Fix the copy button shrinking after a successful copy.
- Fix Regenerate using the old text instead of the current composer content.
- Fix empty and attachment-only drafts still raising the attachment error.

### Removed

- Remove the duplicate footer close button; the header close remains.

[0.0.3]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.2...v0.0.3

## [0.0.2] - 2026-11-15

### Added

- Add an npm package entry to the settings header.

### Changed

- Add npm version badges and npm/GitHub install instructions with a profile placeholder to both READMEs.
- Align the configuration tables with the current settings page: `reasoningEffort` defaults to `off`, the shortcut example is `ctrl+alt+shift+e`, `systemPrompt` and `strategyMode` are separate rows, and the context-window, concurrency and rate-limit fields are included.
- Move the package identity to `@surfishs/dsh-prompt-enhance`; the plugin row id, settings namespace and route prefix stay `dsh-prompt-enhance`.
- Publish through npm Trusted Publisher (OIDC) and GitHub Actions; an existing version is skipped, and 0.0.1 was the manually published bootstrap.

[0.0.2]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.1...v0.0.2

## [0.0.1] - 2026-11-13

### Added

- Start the public release line at 0.0.1 under the scoped npm name `@surfishs/dsh-prompt-enhance`.
- Add two settings entry points over one staged form: the Settings dialog section and the per-row configuration page.
- Add the one-click composer enhance button and a configurable global shortcut (empty by default).
- Add the structured rewrite engine for role and goal, executable steps, output format, acceptance criteria and edge cases, preserving the original intent and inventing nothing.
- Treat greetings, small talk and fragments as content to rewrite rather than questions to answer.
- Add context awareness from recent conversation, with configurable message and character budgets and an off switch.
- Add streaming display, fill-back, copy and undo; a failed call never changes the draft.
- Show token usage with input, output and cache-read/write details.
- Add a custom strategy through `systemPrompt` with `replace-default` or `extend-default`.
- Replace the free-text route with provider/model dropdowns from the DSH LLM registry, a custom-model fallback and a warning-only route check.
- Read reasoning tiers from the configured route, include DeepSeek `max`, support `inherit`, and surface an unsupported explicit tier as `effort-unsupported`.
- Add bilingual Chinese/English settings and localized errors.
- Bound the enhance route to loopback hosts and local `Host`/`Origin`, with input, body, concurrency, rate and timeout limits; store no model API keys.

### Changed

- Keep the legacy `prompt-enhance` entry ids as fallbacks in the settings-mirror probe list.
- Ship the composer shortcut empty (disabled) instead of `ctrl+alt+e` to avoid collisions with chat apps, screenshot tools and IMEs.
- Keep the plugin row id, settings namespace, locale namespace, settings-section cell id and HTTP route prefix on the plain `dsh-prompt-enhance` name.
- No stored configuration needed migration on the profile; `cordis.patch.yml` carried no overrides for this plugin.

[0.0.1]: https://github.com/surfishs/dsh-prompt-enhance/commits/v0.0.1

[Unreleased]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.7...HEAD
