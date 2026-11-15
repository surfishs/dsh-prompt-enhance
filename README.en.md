# dsh-prompt-enhance

[![CI](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@surfishs/dsh-prompt-enhance.svg)](https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

**Prompt enhancement for the DeepSeek Harness web GUI** — turn a composer draft into a structured prompt (role and goal, executable steps, output format, acceptance criteria, edge cases) in one click. The original draft is preserved, and a failure never touches it.

[简体中文](./README.md) | English

---

## Features

- **One-click enhance**: the ✨ button beside send; the shortcut is off by default and can be set in the settings.
- **Side-by-side preview**: original and result together, with model and timing; apply, copy, or cancel.
- **One-click undo**: an undo bar appears under the composer after applying.
- **`/enhance <text>`**: rewrite any text from the slash menu; the result never enters model history.
- **Model routing**: pinned settings pair → current session model → harness default, in that order.
- **Context aware**: uses recent conversation to resolve references; can be turned off.
- **Live settings**: changes apply to the next call, no restart.

## Requirements

| | |
|---|---|
| dsh | `>= 0.1.1-rc.2 < 0.3.0` |
| Node (source builds only) | `^22.19.0 \|\| >=24.0.0` |
| Plugin | `0.0.x` |

## Install

From npm:

```bash
dsh plugin --profile <profile> add @surfishs/dsh-prompt-enhance
# restart dsh
```

From GitHub (the built `lib/` is committed, so no local build happens):

```bash
dsh plugin --profile <profile> add github:surfishs/dsh-prompt-enhance
```

Replace `<profile>` with your profile name: usually `desktop` for the desktop app and `web` for the web build.

From a local checkout (development):

```bash
git clone https://github.com/surfishs/dsh-prompt-enhance.git
cd dsh-prompt-enhance && npm install && npm run build
dsh plugin --profile <profile> add link:C:\path\to\dsh-prompt-enhance
```

Uninstall:

```bash
dsh plugin --profile <profile> remove @surfishs/dsh-prompt-enhance
```

## Usage

Leave a draft in the composer, then click ✨ (or your configured shortcut). Empty, over-length, images-only, and command/reference drafts are rejected locally (over-length is never truncated). A valid draft opens the preview; Apply writes it back and raises the undo bar, Copy puts it on the clipboard, `Esc` cancels, and a poor result can be retried.

`/enhance <text>` rewrites any text from the slash menu; the result is copyable and never enters model history.

## Configuration

Edit in **Settings → dsh-prompt-enhance** (or Plugins → `dsh-prompt-enhance` → **Configure**). All fields:

| Field | Default | Notes |
|---|---|---|
| `enabled` | `true` | Master switch; off hides the composer button and disables the command and shortcut |
| `provider` + `model` | empty | Pick from the DSH-registered LLM providers and their models; the model can switch to “Custom…” to type an id; unconfigured providers are greyed out until set up in DSH model services; empty follows the session model (none). With only one filled, the save falls back to follow-session |
| `temperature` | `0.3` | Sampling temperature `0~1` (step 0.05); lower stays closer to the original |
| `reasoningEffort` | `off` | Tiers come from what the configured provider/model declares (DeepSeek: `off` / `low` / `high` / `max`). A route that declares no tiers omits the field (follows the provider default); `inherit` means the field is not sent |
| `maxOutputTokens` | `8192` | Output token cap per call |
| `maxInputChars` | `12000` | Input character cap; over-limit is rejected, never truncated |
| `timeoutMs` | `60000` | End-to-end timeout per call (ms) |
| `systemPrompt` | empty | Custom system prompt; empty uses the built-in strategy |
| `strategyMode` | `replace-default` | `replace-default` replaces the built-in strategy (the minimal output contract still applies); `extend-default` appends the custom strategy after the built-in one |
| `shortcut` | empty (disabled) | Trigger shortcut; e.g. `ctrl+alt+shift+e`. Needs at least one of ctrl/alt/meta; shift is optional |
| `streaming` | `true` | Show the result as it is written; display only, the final result is unchanged |
| `contextAware` | `true` | Read recent conversation to resolve references; turn it off for sensitive sessions |
| `contextMaxMessages` | `8` | Number of recent messages considered; `0` disables |
| `contextMaxChars` | `4000` | Character budget of the history snippet; `0` disables |
| `maxConcurrent` | `2` | Concurrent enhancement limit; a new request past the limit is told to retry later |
| `rateLimitPerMinute` | `10` | Successful enhancements per minute (sliding window); past the limit the request is told to retry later |

## Security

The enhance route is served by your own local dsh host and accepts loopback addresses with a local `Host` / `Origin` only. With `contextAware` on, recent conversation history is sent with the draft to the configured model provider — do not send context from sensitive sessions.

## Troubleshooting

- No button: make sure `enabled` is `true` and `dsh web` was restarted after installing.
- "No model resolved for the enhancement": set `provider` / `model` as a pair, or send a message in the current session first.
- Authentication failed: check the provider's API key in the harness.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache-2.0 (see [LICENSE](./LICENSE)). The code and design build on [rongxingda/dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance) (Apache-2.0).
