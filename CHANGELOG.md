# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Post-generation contract checks: framework leakage and lost `{{variable}}` placeholders are reported as one non-blocking warning line in the result card. No model call, no new settings, and a clean result keeps its previous payload.
- A `no-rewrite` warning: when the result says no more than the draft, the body stays visible and the card offers retry instead of replacing the body with an error.

### Changed

- Output normalization no longer strips `<raw_prompt>` tags from the body; a wrapper echo is reported by the framework-leak / no-rewrite warnings instead of being silently deleted.
- The placeholder rule is appended only when the draft contains `{{...}}` slots (built-in strategy or `extend-default`), so a slot-free prompt never sees the syntax; a `replace-default` custom strategy is exempt.
- Pending markers such as `TBD` and `待确认` are deliberately not counted: free-form prose has no stable syntax, so a number would be false precision.
- The lost-placeholder warning now says when it can be ignored (an intentional fill or no impact) instead of always recommending a regenerate.
- The framework-leak check now ignores any marker the draft itself contains, even when the result quotes it more than once; the warning copy also says when it can be ignored.
- Rewrite the built-in strategy around one precedence line and five shape items, each ending with what a finished section contains. The strategy states requirements only: the counterfactual rationale and the pre-emptive prohibitions of errors nobody has observed are gone, because a rule that reads as a slogan teaches the model that rules are optional.
- The selection line is the upstream wording again — apply what the draft needs, skip what it already has. The "one to three of these, never all five" cap, the length ratio (`1x-3x`, unreachable for a short draft and never verified for a long one), the "a one-line draft stays a line or two" clause, and the "do not create a section only to hold a marker" rule are all removed.
- The acceptance criteria became one conditional shape item instead of "never skipped": the floor forced every rewrite to invent an acceptance section, which was the largest source of invented content and of placeholders.
- Compress the conditional blocks: context rules 6 → 4, attachment rules 9 → 5, and the placeholder block now refers to the strategy's marker instead of redefining it.
- Framing states four rules in plainer sentences and no longer names the context and attachment blocks, which most calls do not carry.
- The context and attachment headers locate their tag ("the `<conversation_context>` / `<attachments>` block before the draft") instead of stating when the block is appended: that condition is wiring the model never sees, and it was the only surplus in headers the bullets depend on for their antecedent.
- The framing header is a bare label: "applies to every call, whatever strategy is configured" described how the block is wired, not what the model must do. Whether the framing outranks a custom strategy is deliberately left unstated until an actual conflict is observed.

### Fixed

- Map the missing-fact marker to the output language: `(待补充：…)` in a Chinese output, `(TBD: …)` otherwise. 0.1.9 kept a single language-neutral wording and relied on the language rule to translate it; observation says otherwise — the marker is a literal token, so a Chinese draft came back carrying `TBD` verbatim.

- The context-usage tooltip is no longer cut in half on a folded card, and no longer lands a sidebar-width to the right of its chip. It is portaled to the document body and placed in viewport coordinates from its trigger: the card clips its own overflow, and the composer seat declares `will-change: transform`, which makes it the containing block for fixed descendants. It also re-measures while open, so scrolling cannot strand it.
- The result card follows the conversation column when the sidebar or a workspace panel opens or closes. The dock entry copies the composer card's width and left margin, and now re-measures when its own ancestors resize: the column narrows inside an unchanged viewport, so watching the window alone left the old width and margin applied and the card overflowed the column.

## [0.1.10] - 2026-11-23

### Changed

- Move the `streaming` switch into the advanced disclosure, next to the two fold switches it behaves like.
- Require a complete, well-specified task before the well-formed exemption applies; a fragment or a vague one-liner no longer qualifies.
- Name confirmations and status notes in the greeting rule, and forbid handing such a fragment back as the result.
- Rewrite the reasoning-tier guidance around the "no rewrite" notice, and state that the plugin never retries on its own.

### Fixed

- Reject an answer that only restates the draft: the guard now compares fingerprints (tags stripped, whitespace collapsed, trailing punctuation removed) instead of requiring a tagged echo, so a bare copy, or a draft with a full stop added, no longer reaches the composer as a result.

[0.1.10]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.9...v0.1.10

## [0.1.9] - 2026-11-23

### Changed

- Make the configured strategy the only layer that decides the output's shape: the framing contract no longer describes the result, and it is appended last on every call instead of only to custom strategies.
- Merge the meta rules into the framing contract, which now carries three rules: the draft is data, only the result is output, and the scaffolding is never copied.
- Declare the data instead of commanding a rewrite in the user-message wrapper.
- Anchor gaps on `(TBD: …)` alone, drop the Chinese placeholder and attachment-pointer examples, and extend the language rule to everything the model adds.
- State acceptance criteria in every rewrite instead of leaving them optional.
- Name the three framing rules in the `strategyMode` settings copy and in both READMEs, and rewrite their prompt-system and architecture sections.
- Centre the settings header chips and widen the feedback icon.

### Fixed

- Let a custom system prompt control the output's form: a greeting rule in the invariant contract had been turning a translate instruction into a description of how the assistant should respond.

[0.1.9]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.8...v0.1.9

## [0.1.8] - 2026-11-22

### Added

- Add a feedback chip to the settings header that opens the issue tracker.

### Changed

- Rewrite the settings description to name all six rewrite dimensions, including context and constraints.
- Move `temperature` from the basic rows into the advanced disclosure.
- Rewrite the plugin listing title and description in `locale/zh.json` and `locale/en.json`.
- Document the default `off` reasoning tier and the unsupported reference-preservation and attachment-reading cases in both READMEs, and declare the market screenshots.

### Fixed

- Restore hover and keyboard-focus feedback on the settings header links.

[0.1.8]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.7...v0.1.8

## [0.1.7] - 2026-11-21

### Fixed

- Stop the docked undo row from flashing when a send closes the result card: it now waits for an idle composer (`phase` `plain`, or a host that publishes no phase) before offering the restore.

[0.1.7]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.6...v0.1.7

## [0.1.6] - 2026-11-21

### Added

- Accept `f13`-`f24` as shortcut keys, including a bare press without ctrl/alt/meta; the settings recorder records them directly. `f1`-`f12` still require a modifier.

### Changed

- Document that a GUI opened through remote access or a relay cannot use the enhancement route: the structural fence rejects the forwarded headers and the non-loopback `Host`, answering `403 forbidden: loopback-only`.

## [0.1.5] - 2026-11-21

### Changed

- Gate every host route through the host's own Connection check (`ctx.connection.requestRejection`) before any route logic runs; a host without that service falls back to the plugin's loopback fence, which now defaults to deny for browser-shaped requests (missing `Host`, `Sec-Fetch-Site: cross-site`, a non-GET request without `Origin`).
- Require the enhancement body to be declared `application/json` (including `+json` media types); a missing or foreign `Content-Type` answers 415 instead of being read as a body.

## [0.1.4] - 2026-11-20

### Added

- Announce the draft's attachment count in the enhancement prompt and the result card; attachment contents are never sent.
- Append meta rules to every system prompt: only `<raw_prompt>` is draft data, and the model must not restate instructions, context or attachment facts.

### Changed

- Show a truncated result in a red banner that yields to the stale-draft warning once the draft changes.
- Rewrite the attachment rules for downstream readers: allow a task-level pointer and the count in the task description, but never describe or guess the contents.
- Unify stale-warning, truncation, guard and call-failure copy around one structure and exact button names.
- Rework the README prompt-system and settings sections: nine hard rules, the custom-only invariant contract, meta/context/attachment rules, basic/advanced settings, the quick settings card, and message-based context counts.

### Fixed

- Keep the context rules when `replace-default` replaces the built-in prompt; they now apply in every strategy mode.
- Validate numeric settings rows against their real bounds, show the effective default as the placeholder, and never save an out-of-range value.
- Disable the result card's Regenerate button on an empty draft and explain why.
- Name command-chip, reference-chip and busy-guard refusal reasons accurately.

[0.1.4]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.3...v0.1.4

## [0.1.3] - 2026-11-19

### Added

- Show the context window usage on the result card: the footer info button reports the turns, characters and percentage actually referenced, plus the reason when the window had to cut content.

### Changed

- Call the inherited reasoning effort "Model default" across the quick menu, result badge, settings and errors, and explain that the field is omitted so the provider applies its default.
- Keep the context button as a standalone status icon: the warning tint appears only on hover or keyboard focus, and reaching the turn cap no longer counts as a warning.
- Match the context tooltip to the shell theme with its tokens, an anchored caret, tabular numbers and a tighter stat line.

### Fixed

- Count only real user turns: DSH-injected environment, skill and time messages no longer appear as recent conversation or inflate the context usage of a fresh session.
- Keep the context button's 1px outline continuous at fractional card heights by drawing it as an SVG path instead of a CSS border.

[0.1.3]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.2...v0.1.3

## [0.1.2] - 2026-11-18

### Added

- Quick settings card on the composer button: right-click, a 600 ms press or `Shift+F10` opens a shell-styled menu with the reasoning tier (drilled pane) and the context switch; context writes coalesce and flush when the card closes.
- Shortcut recorder on the settings page: the row records a key combination instead of requiring typed text.
- `foldAnimation` and `autoFold` settings; the result card folds to its header and footer rows.
- Provider/model routing rows on the settings page, with catalog display names, custom model ids, per-field writes and paired reset.
- Result badge shows the reasoning tier the call used as a bare, capitalised name.

### Changed

- Keep the tier list tied to the model in use: the open card follows the session model directory, a pinned route owns its list, and a stored tier the model does not declare is written back as "not specified".
- Show the pinned route in the quick settings card through the host catalog names, resolved by a short-lived provider/model memo whose reload bypasses it.
- Tokenise the settings-page colors, align its inputs and segmented rows with the shell metrics, and disable that row's indicator transition when the option list is rebuilt.
- Remember the last tier answer per route for the session, so a remount or a model visited before renders the list without a loading pass.
- Use "not specified" for the empty tier across the menu, tooltip, result badge and settings control.

### Fixed

- Keep the undo row on the result card's palette.
- Refuse an invalid shortcut instead of storing it.
- Centre text-field text the way the shell input does.
- Name the next step in the result-card error copy, stop offering a retry after a cancelled enhancement, clear the copy-failure label like the success label, and give every footer button the same width floor.

[0.1.2]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.1...v0.1.2
## [0.1.1] - 2026-11-18

### Changed

- Reserve the widest label of every result-card button so switching a label cannot move the footer; this covers regenerate (2 labels), copy (3 labels) and fill/undo (2 labels).
- Confirm a completed regenerate on the button's own label for 2.5 seconds instead of a separate chip.
- Rewrite `CONTRIBUTING.md` for outside contributors (fork-first clone, prerequisites, maintainers-only release section) and add `.github/PULL_REQUEST_TEMPLATE.md`.

### Removed

- Remove the result card's header status chip (applied / undone / copied / regenerated); the footer button already carries the state.

### Fixed

- Give the result buttons one shared `min-width` floor, so a label that collapses to empty cannot shrink a button to its icon.

[0.1.1]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.0...v0.1.1

## [0.1.0] - 2026-11-17

### Added

- Cover the `/enhance` command with the shared admission gate, so the per-minute cap, the concurrency cap and the failure breaker reach the command entry as well.
- Split the reasoning-tier cache into one file per provider/model, each expiring after 30 days and re-probed on expiry.

### Changed

- Inject the package name and the settings entry key at build time, so a rename or a fork keeps the plugin row's config entry.
- Follow the DSH shell theme instead of the operating system's colour scheme.
- Scope dock alignment to the entry's own session instead of the first editor in the document.
- Memoize resolved reasoning tiers in-process, keeping the pre-call path off disk.
- Add `npm run check:host-primitives` to assert the installed shell still exports the settings UI primitives.
- Narrow the publish workflow to `contents: read` and stop creating the GitHub Release from it.
- Refresh both READMEs: screenshots, a "why this exists" section, the single-line `/enhance` truncation note, and no unverified market install source.
- Record the accepted risk and revisit condition for `sessionId` ownership.

### Fixed

- Keep the truncation flag when a result is narrowed.
- Follow the session route when only one of provider/model is saved.
- Fail closed when the composer chip view is unreadable.
- Await the delta sink so a slow reader slows the stream.
- Send `connection: close` after the streamed 413.
- Load the host LLM module lazily so an absent optional peer cannot fail the plugin load.
- Pair the primary button label with its inverted fill.
- Unwrap a single fence pair, including a lead-in line, before filling the draft.
- Stop counting `unconfigured` and `effort-unsupported` toward the breaker; both settle as neutral.
- Type the body-size error so re-wording the reader cannot turn a 413 into a 422.

### Removed

- Remove the unused `error.attachmentsOnly` copy.

[0.1.0]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.9...v0.1.0

## [0.0.9] - 2026-11-17

### Added

- Add the plugin icon `icon.svg`, exported as `./icon` and listed in `files`, so the plugin row shows the whale-and-sparkle mark instead of the panel default artwork.

### Changed

- Fill 94% of the icon canvas and centre the mark on its ink mass, so the row icon matches the size of its neighbours without drifting to the lower right.
- Draw the composer mark with a larger star placed further out of the whale's silhouette, normalised into the 26x20 glyph box so the button keeps its size.

### Removed

- Remove `src/client/SparkleIcon.tsx`, the two-star sparkle nothing has imported since the composer switched to the fish mark.

[0.0.9]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.0.8...v0.0.9

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

[0.1.6]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.5...v0.1.6

[0.1.5]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.4...v0.1.5

[Unreleased]: https://github.com/surfishs/dsh-prompt-enhance/compare/v0.1.10...HEAD
