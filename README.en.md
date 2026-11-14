# dsh-prompt-enhance

[![CI](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml)
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

From GitHub (the built `lib/` is committed, so no local build happens):

```bash
dsh plugin --profile web add github:surfishs/dsh-prompt-enhance
# restart dsh web
```

From a local checkout (development):

```bash
git clone https://github.com/surfishs/dsh-prompt-enhance.git
cd dsh-prompt-enhance && npm install && npm run build
dsh plugin --profile web add link:C:\path\to\dsh-prompt-enhance
```

Not available on npm: the name `dsh-prompt-enhance` belongs to the upstream project. Uninstall:

```bash
dsh plugin --profile web remove dsh-prompt-enhance
```

## Usage

Leave a draft in the composer, then click ✨ (or your configured shortcut). Empty, over-length, images-only, and command/reference drafts are rejected locally (over-length is never truncated). A valid draft opens the preview; Apply writes it back and raises the undo bar, Copy puts it on the clipboard, `Esc` cancels, and a poor result can be retried.

`/enhance <text>` rewrites any text from the slash menu; the result is copyable and never enters model history.

## Configuration

Edit in **Settings → dsh-prompt-enhance** (or Plugins → `dsh-prompt-enhance` → **Configure**). Common fields:

| Field | Default | Notes |
|---|---|---|
| `enabled` | `true` | Master switch |
| `provider` + `model` | empty | Pinned route override, set as a pair; empty follows the session model |
| `temperature` | `0.3` | Lower stays closer to the original |
| `reasoningEffort` | Provider default | Tiers come from what the configured provider/model declares (DeepSeek: `off` / `low` / `high` / `max`); a custom model is read on demand and cached locally. `inherit` means "follow provider default" |
| `maxOutputTokens` | `8192` | Output token budget per call |
| `maxInputChars` | `12000` | Input character cap; over-limit is rejected, never truncated |
| `timeoutMs` | `60000` | End-to-end timeout per call (ms) |
| `systemPrompt` / `strategyMode` | empty / `replace-default` | Custom strategy; `extend-default` appends it after the built-in one |
| `shortcut` | empty (disabled) | Trigger shortcut; set it to enable, e.g. `ctrl+alt+e` |
| `streaming` | `true` | Show the result as it is written (display only) |
| `contextAware` | `true` | Use recent conversation; turn it off for sensitive sessions |

The remaining fields (context window, concurrency, rate limit) are documented on the settings page.

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
