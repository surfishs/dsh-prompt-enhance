# dsh-prompt-enhance

[![CI](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@surfishs/dsh-prompt-enhance.svg)](https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

**Prompt enhancement for the DeepSeek Harness web GUI** — turn a composer draft into a structured prompt in one click: role and goal, context and constraints, executable steps, output format, acceptance criteria, edge cases. It keeps your intent unchanged, invents no requirements, and writes a placeholder instead of guessing; the composer draft is never modified.

[简体中文](./README.md) | English

![Prompt Enhance: the docked result card above the composer](./docs/images/panel-en-915.png)

---

## Why you need it

A good prompt spells out four things: who the model acts as, what it hands over, in what format, and what counts as correct — most drafts say none of this.

The plugin adds a Prompt enhancement button to the composer toolbar: one click sends the draft to DSH's model service, which rewrites it around those four things as a structured prompt.

The result appears in a card docked above the composer without covering the conversation; your draft is never replaced — apply it, copy it, regenerate it, or undo, and the original text can always be restored.

With context awareness on, the plugin passes the last few turns to the model, helping it understand references and the task background (such as what "it" or "that" means, or premises the draft leaves out), so the rewrite matches what you meant. Turn it off in the settings page or the right-click quick settings card at any time.

> **Note**: it only reads the most recent turns. If the draft depends on a topic that has dropped out of that window, add the needed background to the draft; otherwise the rewrite may drift from your intent.

## Feature overview

| Feature | What it does |
|---|---|
| 🐋 **One-click enhance** | The composer toolbar button (the DeepSeek whale mark with a sparkle in its corner); the shortcut is off by default and can be set in settings |
| 🎛️ **Right-click quick settings** | Right-click or long-press the composer button: switch the reasoning tier (pick one inside) and context awareness; the model row is read-only and shows the pinned route or "Follow session" |
| 🖼️ **Docked result card** | Shown above the composer without covering the conversation, with the model, reasoning tier, timing and `token` usage; folds to its title and footer rows; a truncated result is flagged |
| ↩️ **Apply, copy and undo** | Copy the result; applying folds the card to its title row by default and turns its footer button into Undo, which restores the draft and expands the card |
| 🔄 **Regenerate** | Request another version from the current text; an applied enhanced draft can be regenerated too |
| 💬 **`/enhance` command** | Rewrite any text from the slash menu; the result never enters model history |
| 🧭 **Model routing** | A pinned `provider` + `model` pair wins; otherwise it follows the session model, then the global default |
| 🧩 **Context aware** | With `contextAware` on, recent turns resolve references such as "it" or "that"; turn it off at any time |
| 🔑 **Zero credentials** | Calls use DSH's model service and credential store; the plugin never reads or stores keys |
| 🛡️ **Draft safety** | Empty, attachment-only, over-length and command-or-reference drafts are blocked locally; upstream failures get a readable message and never touch the draft |
| ⚙️ **Live settings** | Fields save automatically, common rows first and the rest under Advanced; changes apply on the next call |

## Requirements

| Item | Requirement |
|---|---|
| DSH | `>= 0.1.1-rc.2 < 0.3.0`, verified on `0.2.2-rc.3` |
| Node (needed only for source builds) | `^22.19.0 \|\| >=24.0.0` |

## Install

Before installing, confirm the package name. `dsh-prompt-enhance` on npm (no scope) is the upstream project; this plugin is a rewrite of it, and its package name is `@surfishs/dsh-prompt-enhance`. Install from this repository (`surfishs/dsh-prompt-enhance`). **Do not** run `dsh plugin add dsh-prompt-enhance`.

The DSH desktop app and the web build use the same package and the same install steps; only the profile name differs — usually `desktop` for the app and `web` for the web build. Replace `<profile>` in the commands below with your profile name.

### Let an agent install it

No command line needed. Send the block below to an agent that can run commands on your machine (DSH desktop or web build):

```text
Install the DeepSeek Harness plugin @surfishs/dsh-prompt-enhance.

1. First confirm my DSH profile name: usually desktop for the desktop app and web for the web build; ask me if unsure.
2. Run: dsh plugin --profile <profile> add @surfishs/dsh-prompt-enhance
3. If the npm install fails, use: dsh plugin --profile <profile> add github:surfishs/dsh-prompt-enhance
4. After installing, ask me to restart DSH and confirm the plugin appears in the plugin list.
5. Do not change my other plugins or DSH configuration.
```

From npm:

```bash
dsh plugin --profile <profile> add @surfishs/dsh-prompt-enhance
# restart dsh
```

From GitHub (the built `lib/` is committed, so no local build is needed):

```bash
dsh plugin --profile <profile> add github:surfishs/dsh-prompt-enhance
```

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

1. **Start**: leave a draft in the composer and click the enhance button in the toolbar (or your configured shortcut).
2. **Review**: the result appears in a card docked above the composer. You can:
   - **Apply**: write it back; the card folds to its title row by default and its footer button becomes Undo;
   - **Copy**: copy the result;
   - **Regenerate**: run the current draft again.
3. **Undo**: click Undo in the card footer to restore the original draft; the card expands again.
4. **Close**: sending the draft closes the card automatically; Escape also closes it.

Right-click or long-press the enhance button in the toolbar to open the quick settings card: choose a reasoning tier inside its list, toggle context awareness directly, and read the pinned provider/model (or "Follow session"). Full settings stay on the settings page.

An empty or attachment-only draft dims the button and makes it unclickable; over-length drafts, or drafts containing commands or file references, are rejected locally. A result that hits the token cap is marked as possibly incomplete.

`/enhance <text>`: rewrite any text from the slash menu; the result is copyable and never enters model history.

## Configuration

Edit in **Settings → dsh-prompt-enhance** (or Plugins → `dsh-prompt-enhance` → **Configure**). All fields:

| Field | Default | Notes |
|---|---|---|
| `enabled` | `true` | Master switch; off hides the composer button and disables the command and shortcut |
| `provider` + `model` | empty | Pick from the DSH-registered LLM providers and their models; the model can switch to “Custom…” to type an id; unconfigured providers are greyed out until set up in DSH model services; empty follows the session model (no pinned route). With only one filled, the save falls back to follow-session; switching the provider clears the chosen model so a stale pair cannot remain |
| `temperature` | `0.3` | Sampling temperature `0~1` (step 0.05); lower stays closer to the original |
| `reasoningEffort` | `off` | Tiers come from what the configured provider/model declares (DeepSeek: `off` / `low` / `high` / `max`). "Not specified" sends no field; switching to a model that does not declare the stored tier rewrites it to "Not specified" |
| `maxOutputTokens` | `8192` | Output token cap per call |
| `maxInputChars` | `12000` | Input character cap; over-limit is rejected, never truncated |
| `timeoutMs` | `60000` | End-to-end timeout per call (ms) |
| `systemPrompt` | empty | Custom system prompt; empty uses the built-in strategy |
| `strategyMode` | `replace-default` | `replace-default` replaces the built-in strategy (the minimal output contract still applies); `extend-default` appends the custom strategy after the built-in one |
| `shortcut` | empty (disabled) | Shortcut that triggers the enhancement; e.g. `ctrl+alt+shift+e`. Needs at least one of ctrl/alt/meta; shift is optional; the settings page has a Record button that captures the combination |
| `streaming` | `true` | Show the result as it is written; display only, the final result is unchanged |
| `foldAnimation` | `true` | Whether the card animates when it folds or expands; never animates when the system asks for reduced motion |
| `autoFold` | `true` | Fold the card after applying and expand it again after undoing |
| `contextAware` | `true` | Read recent conversation to resolve references; turn it off for sensitive sessions |
| `contextMaxMessages` | `8` | Number of recent messages considered; `0` disables |
| `contextMaxChars` | `4000` | Character budget of the history snippet; `0` disables |
| `maxConcurrent` | `2` | Concurrent enhancement limit; a new request past the limit is told to retry later |
| `rateLimitPerMinute` | `10` | Successful enhancements per minute, counted over any rolling 60 seconds; past the limit the request is told to retry later |

An empty or attachment-only draft dims the button and starts no request; raise `maxOutputTokens` when a result is truncated.

## Security

- **Local access only**: the enhance route is served by the local DSH host; it accepts only requests from this machine (a loopback connection whose `Host` / `Origin` name the local host) and rejects external origins.
- **No model keys stored**: the plugin does not read or store model API keys; calls reuse the model configuration and credentials already in DSH.
- **Context sent only when enabled**: with `contextAware` on, the most recent user/assistant text and the current draft are sent to the configured model provider (default: up to 8 messages and 4,000 characters); system messages, model reasoning, tool results and attachments are excluded. With it off, only the draft is sent.
- **Sensitive conversations**: if the content must not leave the machine, turn off `contextAware` or use a local/private model route you trust.
- **Local tier cache**: the plugin caches "which reasoning tiers does this route declare" per provider/model under `$DSH_HOME/dsh-prompt-enhance/reasoning-efforts/` (`~/.dsh/…` when `DSH_HOME` is unset), and each entry expires and is re-probed after 30 days. The cached files hold only the provider, the model and the tier metadata — no API key, draft or conversation text. Use the Refresh control in the settings page to re-probe immediately, or delete the directory.

## Troubleshooting

| Symptom | Check / fix |
|---|---|
| No enhance button in the toolbar | Confirm `enabled` is `true`; restart DSH (desktop app or `dsh web`) after installing the plugin; confirm the active profile. |
| Button is greyed out | The composer is empty or has attachments only; type text to enable it. |
| Truncated result | Check the truncation warning and raise `maxOutputTokens` in settings. |
| "No model is configured for the enhancement" | Set both `provider` and `model` in settings, or send a message in the current session so the plugin can follow the session route. |
| Authentication failure | Check that the provider's credentials/API key in DSH are valid. |
| `/enhance` shows only the first line and cannot be expanded | A rendering limit of the DSH chat UI, not this plugin: as of `@deepseek-ai/dsh-client-ui-chat` 0.2.2-rc.3, only results containing a newline get an expand control, so a single-line result is ellipsized with no way to open it. To read the whole result, put the same text in the composer and use the enhance button — the button's card wraps and scrolls. |

## Development

```bash
npm install
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Licensed under Apache-2.0; see [LICENSE](./LICENSE).

## Credits

Thanks to [rongxingda/dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance): this project's code and design are based on that project (Apache-2.0).
