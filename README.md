# dsh-prompt-enhance

[![CI](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@surfishs/dsh-prompt-enhance.svg)](https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

**DeepSeek Harness Web GUI 的「提示词增强」插件** —— 一键把输入框草稿改写为结构化提示词：角色与目标、上下文与约束、可执行步骤、输出格式、验收标准、边界条件。以原文为准，不改变原意、不凭空编造需求；信息不足时留占位，草稿不会被改动。

简体中文 | [English](./README.en.md)

![提示词增强：输入框上方的停靠结果卡](./docs/images/panel.png)

---

## 为什么需要它

好的提示词会讲清四件事：让模型扮演谁、交付什么、以什么格式、怎样算合格——多数草稿没写这些。

插件在输入框工具栏加了一个「提示词增强」按钮：点一下，草稿就会交给 DSH 的模型服务，按上面那四件事改写成结构化提示词。

结果出现在输入框上方的停靠卡里，不遮挡对话；草稿不会被直接替换——你可以回填、复制、重新生成或撤销，原文随时可恢复。

开启上下文感知后，插件会参考最近几轮对话补全指代（比如「它」「这个」），让改写更贴近你原本的意思；可在设置页或右键快捷卡里随时关闭。

## 功能一览

| 功能 | 说明 |
|---|---|
| 🐋 **一键增强** | 输入框工具栏按钮（带星芒的 DeepSeek 鲸鱼标识）；快捷键默认关闭，可在设置中指定 |
| 🎛️ **右键快捷设置** | 右键或长按输入框按钮打开小卡片：切换推理等级（点进去选档位）与上下文感知；模型行只读，显示固定路由或「跟随会话」 |
| 🖼️ **停靠结果卡** | 结果显示在输入框上方，不遮挡对话；附模型、推理档位、耗时与 `token` 用量；可折叠为标题与底部按钮；超限时提示结果可能不完整 |
| ↩️ **回填、复制与撤销** | 结果可直接复制；回填后卡片默认自动折叠为标题行，底部按钮变为「撤销」，点击即可恢复原文并展开结果卡 |
| 🔄 **重新生成** | 按当前输入框内容再请求一版；回填后的增强稿也可继续生成 |
| 💬 **`/enhance` 命令** | 斜杠面板直接改写任意文本；结果不进入模型历史 |
| 🧭 **模型路由** | 设置中同时指定 `provider` 与 `model` 时优先；否则依次跟随当前会话模型、全局默认模型 |
| 🧩 **上下文感知** | `contextAware` 开启时参考最近几轮对话补全「它 / 这个」这类指代，可随时关闭 |
| 🔑 **零凭据配置** | 调用走 DSH 的模型服务，密钥来自 DSH 凭据存储；插件不读取也不保存 |
| 🛡️ **草稿安全** | 空输入、仅附件、超长、含命令或文件引用都在本地拦截；上游失败给出可读提示，且不改动草稿 |
| ⚙️ **配置热生效** | 字段改完自动保存，常用项在前、其余收进「高级设置」；下一次调用立即生效 |

## 环境要求

| 项目 | 要求 |
|---|---|
| DSH | `>= 0.1.1-rc.2 < 0.3.0`，已在 `0.2.2-rc.3` 验证 |
| Node（仅从源码构建时需要） | `^22.19.0 \|\| >=24.0.0` |

## 安装

安装前请先确认包名：npm 上的 `dsh-prompt-enhance`（无 scope）是上游原项目，本插件是它的重写版，包名是 `@surfishs/dsh-prompt-enhance`。安装时请使用本仓库 `surfishs/dsh-prompt-enhance`。**不要**执行 `dsh plugin add dsh-prompt-enhance`。

DSH 桌面版与 Web 版使用同一个插件包，安装方式相同，只是 profile 名不同：桌面版通常是 `desktop`，Web 版通常是 `web`。把下方命令里的 `<profile>` 换成你的 profile 名。

### 让 Agent 帮你安装

不用自己敲命令。把下面整段发给能操作本机终端的 Agent（DSH 桌面版或 Web 版均可）：

```text
帮我安装 DeepSeek Harness 插件 @surfishs/dsh-prompt-enhance。

1. 先确认我的 DSH profile 名：桌面版通常是 desktop，Web 版通常是 web；不确定就问我。
2. 执行：dsh plugin --profile <profile> add @surfishs/dsh-prompt-enhance
3. 如果 npm 安装失败，改用：dsh plugin --profile <profile> add github:surfishs/dsh-prompt-enhance
4. 安装完成后提示我重启 DSH，并让我确认插件出现在插件列表中。
5. 不要修改我的其他插件或 DSH 配置。
```

从 npm 安装：

```bash
dsh plugin --profile <profile> add @surfishs/dsh-prompt-enhance
# 重启 dsh
```

从 GitHub 安装（`lib/` 已提交到仓库，无需在本地构建）：

```bash
dsh plugin --profile <profile> add github:surfishs/dsh-prompt-enhance
```

从本地检出（开发用）：

```bash
git clone https://github.com/surfishs/dsh-prompt-enhance.git
cd dsh-prompt-enhance && npm install && npm run build
dsh plugin --profile <profile> add link:C:\path\to\dsh-prompt-enhance
```

卸载：

```bash
dsh plugin --profile <profile> remove @surfishs/dsh-prompt-enhance
```

## 使用

1. **开始**：在输入框写下草稿，点工具栏的增强按钮（或你设置的快捷键）。
2. **查看结果**：结果出现在输入框上方的停靠卡里，可以：
   - **回填**：写回输入框，卡片默认自动折叠为标题行，底部按钮变为「撤销」；
   - **复制**：复制结果；
   - **重新生成**：按当前输入再生成一版。
3. **撤销**：点卡片底部的「撤销」恢复原文，同时展开结果卡。
4. **关闭**：发送消息时卡片自动收起，按 `Esc` 也可以关闭。

右键或长按工具栏的增强按钮，可打开快捷设置卡：推理等级点进去选档位，上下文感知可直接开关；模型行只读，显示固定的 provider/model 或「跟随会话」。完整设置仍在设置页。

输入为空或只有附件时，按钮会变灰、不可点；超长、含命令或文件引用的草稿会被本地拒绝。输出达到 token 上限时，会提示结果可能不完整。

`/enhance <文本>`：从斜杠面板改写任意文本，结果可复制，不进入模型历史。

## 配置

在 **设置 → 提示词增强**（或 插件面板 → `dsh-prompt-enhance` → **配置**）编辑。全部字段：

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关；关闭后隐藏输入框按钮，并停用命令与快捷键 |
| `provider` + `model` | 空 | 从 DSH 已注册的 LLM provider 及模型中选择；模型可选「自定义…」手填 ID；未配置的 provider 置灰、需先在 DSH 模型服务中配置；留空表示跟随当前会话模型（不固定路由）。只填一个时保存后按跟随会话处理；切换 provider 会清空已选 model，避免留下不匹配的旧值 |
| `temperature` | `0.3` | 采样温度 `0~1`（步进 0.05），越低越忠实原文 |
| `reasoningEffort` | `off` | 档位由当前 provider/model 的声明决定；DeepSeek 为 `off` / `low` / `high` / `max`。选「不指定」时不发送该字段；切换到不声明当前档位的模型时，插件会自动改回「不指定」 |
| `maxOutputTokens` | `8192` | 单次调用的输出 token 上限 |
| `maxInputChars` | `12000` | 输入字符上限；超限拒绝，不截断 |
| `timeoutMs` | `60000` | 单次调用端到端超时（毫秒） |
| `systemPrompt` | 空 | 自定义系统提示词；留空使用内置增强策略 |
| `strategyMode` | `replace-default` | `replace-default` 整体替换内置策略（仍保留最小输出契约）；`extend-default` 把自定义策略追加在内置策略之后 |
| `shortcut` | 空（禁用） | 触发增强的快捷键；例如 `ctrl+alt+shift+e`。须包含 ctrl/alt/meta 中至少一个修饰键，shift 可选；设置页可点「录制」直接按键录入 |
| `streaming` | `true` | 边写边显示；仅影响显示节奏，最终结果不变 |
| `foldAnimation` | `true` | 结果卡折叠/展开时是否播放动画；系统开启「减少动态效果」时始终不播放 |
| `autoFold` | `true` | 回填后自动折叠结果卡，撤销后自动展开 |
| `contextAware` | `true` | 读取最近对话以消解指代；含敏感内容的会话建议关闭 |
| `contextMaxMessages` | `8` | 参考的最近消息条数；`0` 表示不参考 |
| `contextMaxChars` | `4000` | 历史片段的字符预算；`0` 表示不参考 |
| `maxConcurrent` | `2` | 同时进行的增强上限；达到上限时新请求会提示稍后再试 |
| `rateLimitPerMinute` | `10` | 每分钟成功增强次数上限，按任意连续 60 秒计算；超限时提示稍后再试 |

输入为空或只有附件时按钮变灰、不可点，不发起请求；结果被截断时调高 `maxOutputTokens`。

## 安全

- **仅本机可访问**：增强路由由本机 DSH 宿主提供，只接受回环地址和本地 `Host` / `Origin`，不接受外部来源。
- **不保存模型密钥**：插件不读取或存储模型 API key，调用走宿主已有的 LLM 配置。
- **上下文按需发送**：`contextAware` 开启时，最近几轮 user/assistant 文本和当前草稿会发给当前配置的模型服务商（默认最多 8 条消息、4000 字符）；system、reasoning、工具结果和附件不会进入上下文。关闭后只发送草稿。
- **敏感会话**：如果内容不能外发，请关闭 `contextAware`，或改用你信任的本地/私有模型服务。
- **本机档位缓存**：插件会把「当前路由声明了哪些推理档位」的查询结果按 provider/model 分别缓存到 `$DSH_HOME/dsh-prompt-enhance/reasoning-efforts/` 目录（未设置 `DSH_HOME` 时为 `~/.dsh/…`），每条缓存 30 天后自动失效并重新探测。文件内容只有 provider、model 与档位信息，不含 API key、草稿或对话内容；也可在设置页点「刷新」立即重新探测，或直接删除该目录。

## 故障排查

| 现象 | 检查与处理 |
|---|---|
| 工具栏没有增强按钮 | 确认 `enabled` 为 `true`；安装后重启 DSH（桌面版或 `dsh web`）；确认当前 profile 正确。 |
| 按钮是灰的 | 输入框为空或只有附件；输入文字后恢复。 |
| 结果不完整 | 查看截断提示，并在设置中调高 `maxOutputTokens`。 |
| 提示「还没确定用哪个模型」 | 在设置中成对填写 `provider` / `model`；或先在当前会话发一条消息，让插件跟随会话模型。 |
| 鉴权失败 | 检查对应 provider 在 DSH 中的凭据/API Key 是否有效。 |
| `/enhance` 的结果只显示第一行、点不开 | 这是 DSH 聊天界面的渲染限制，与本插件无关：截至 `@deepseek-ai/dsh-client-ui-chat` 0.2.2-rc.3，只有含换行的结果才提供展开，单行结果会被省略号截断且没有入口。要看全文，把同样的文本放进输入框、用增强按钮——按钮的结果卡会自动折行并可滚动。 |

## 开发

```bash
npm install
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

本项目采用 Apache-2.0，见 [LICENSE](./LICENSE)。

## 致敬

感谢 [rongxingda/dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance)：本项目的代码与设计建立在该项目（Apache-2.0）的基础之上。
