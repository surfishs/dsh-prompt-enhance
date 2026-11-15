# Changelog

All notable changes are documented here. This repository starts its own release line at 0.0.1.

## 0.0.3 (2026-11-15)

**Docked result card.** The result is now a non-modal card in the composer dock above the input instead of a body-portal overlay. It shows only the enhanced body, measures the composer's outer rounded card to match its width and left edge, and carries an outlined model/time/token badge with transient Copied / Regenerated / Replaced / Undone chips. Applying keeps the card open with an undo action; sending the draft auto-closes it; Escape closes it.

**Composer and actions.** The composer button uses the fish-plus-sparkle mark, dims with an explanatory title when the draft is empty (click and shortcut become no-ops), and uses `not-allowed` there while busy states use `progress`. Regenerate and the error retry re-run the current draft; the three action buttons carry icons at a shared 28px height, the copy width stays stable while it reports success, and the footer no longer duplicates the header close. Max-token results are kept with a truncation warning instead of failing the call. The stale-result warning now leads with the changed draft.

Suite: **29 files / 312 cases green**; typecheck clean; `lib/` rebuilt.

## 0.0.2 (2026-11-15)

**Settings header and docs.** The settings header now links both GitHub and the npm package page, and both READMEs gained an npm version badge. The configuration tables were rewritten against the current settings page: `reasoningEffort` defaults to `off` (not "provider default"), the shortcut example is `ctrl+alt+shift+e`, `systemPrompt` and `strategyMode` are documented separately, and the context-window, concurrency and rate-limit rows are included.

**Publishing.** The package identity is `@surfishs/dsh-prompt-enhance` (the unscoped name belongs to the upstream project). The publish workflow targets the scoped package, uses npm Trusted Publishing (OIDC) with `--access public`, and skips the publish step when the version already exists (the bootstrap 0.0.1 was published manually).

Suite: **29 files / 309 cases green**; typecheck clean; `lib/` rebuilt.

## 0.0.1 (2026-11-13)

**First release of this line.** The `surfishs/dsh-prompt-enhance` line starts at `0.0.1` under the scoped npm package name `@surfishs/dsh-prompt-enhance`. The plugin row id, settings namespace, client locale namespace, settings-section cell id and HTTP route prefix keep the plain `dsh-prompt-enhance` name, so a log line, a settings key or a request path still names the same plugin regardless of the npm identity. The old `prompt-enhance` entry ids stay in the settings-mirror probe list as fallbacks for a profile still running a previous build.

The configuration page has two entry points over one staged form: a section in the Settings dialog and a per-row configuration entry on the Plugins page. The composer shortcut now ships **empty (disabled)** instead of `ctrl+alt+e`: a shipped combination collides with chat apps, screenshot tools and IMEs, so the ✨ button is the primary entry point and an operator who wants a key sets one in the settings. The initial release includes the rewrite engine, context awareness, streaming display and the reasoning budget. No stored configuration needed migration on this profile (`cordis.patch.yml` carried no overrides for this plugin).

**Dynamic reasoning tiers.** The tier choices now come from the configured route instead of a hardcoded list. The settings page asks the read-only `GET /dsh-prompt-enhance/reasoning-efforts` endpoint, which answers from `ctx.llm.resolveModelInfo`; a pinned provider/model is cached in a JSON file under the Harness home (`DSH_HOME` or `~/.dsh`) with no TTL and is replaced only when the pair changes or the operator presses refresh, while the default-model path answers from the static DeepSeek catalog only when the followed default really is DeepSeek. DeepSeek's `max` tier is now offered, `inherit` reads "follow provider default", and a rejected non-default effort surfaces as `effort-unsupported` instead of being silently replaced by the provider default; the shipped `off` default keeps the historical one-shot downgrade for routes that declare no reasoning.

**Routing selects instead of free text.** `provider`/`model` are now dropdowns fed by the harness LLM registry (`GET /dsh-prompt-enhance/llm-providers`, `.../llm-models`, `.../llm-route-check`): registered providers first, declared-but-unconfigured ones in a disabled group, a free-text “custom model” fallback, and the empty option keeps the follow-the-session semantics. A warning-only route check marks a pair the registry cannot resolve — the save is still allowed, matching the plugin's advisory catalog policy. The old placeholders are gone with the text inputs. A route that declares no reasoning tiers is presented as follow-provider-default and the enhancement call omits the field (the negative capability answer is cached), while an unsupported explicit tier on a tiered route still surfaces as an error.

Suite: **29 files / 309 cases green**; typecheck clean; `lib/` rebuilt.

