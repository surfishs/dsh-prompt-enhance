# dsh-prompt-enhance

[![CI](https://img.shields.io/github/actions/workflow/status/surfishs/dsh-prompt-enhance/ci.yml?branch=main&style=flat&label=CI&logo=github)](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@surfishs/dsh-prompt-enhance.svg)](https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance)
[![npm 月下载量](https://img.shields.io/npm/dm/@surfishs/dsh-prompt-enhance.svg?label=npm)](https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance)
[![npm 总下载量](https://img.shields.io/npm/d18m/@surfishs/dsh-prompt-enhance.svg?label=npm%20total)](https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/surfishs/dsh-prompt-enhance/blob/main/LICENSE)
[![平台：DSH 桌面版 + Web 版](https://img.shields.io/badge/Platform-DSH%20Desktop%20%2B%20Web-2F81F7?style=flat)](https://github.com/surfishs/dsh-prompt-enhance/blob/main/README.md#安装)
[![支持的 DSH 版本：0.1.1–0.2.x](https://img.shields.io/badge/DSH-0.1.1%E2%80%930.2.x-8A2BE2?style=flat)](https://github.com/surfishs/dsh-prompt-enhance/blob/main/README.md#环境要求)
[![awesome · DSH plugin](https://img.shields.io/badge/awesome%20%C2%B7%20DSH%20plugin-%E2%9C%93-c0392b?labelColor=f6f2ea&style=flat)](https://awesome-dsh-plugin.com/)
[![GitHub stars](https://img.shields.io/github/stars/surfishs/dsh-prompt-enhance.svg?style=flat)](https://github.com/surfishs/dsh-prompt-enhance/stargazers)

简体中文 | [English](./README.en.md)

**DeepSeek Harness Web GUI 的「提示词增强」插件** —— 一键把输入框草稿改写为结构化提示词：角色与目标、上下文与约束、可执行步骤、输出格式、验收标准、边界条件。

以原文为准：不改变原意、不凭空编造需求；信息不足时留占位。改写不改动你的草稿（出错时也不会）：结果先出现在结果卡里，点「回填」才写回，回填后可一键撤销。

![提示词增强：输入框上方的停靠结果卡](./docs/images/panel.png)

---

## 为什么需要它

用户往往带着祈求的语气发问「那你能帮帮我吗？」——像病人只说一句「我不舒服」，就等着大夫开药。可模型拿到的只有这句求助，它只能自己猜；猜出来的部分看着合理，却常常不是你的原意。

![配文「那你能帮帮我吗？」的照片，右上角是插件图标](./docs/images/promo-enhance.png)

*「那你能帮帮我吗？」——这样一句祈求式提问，正是本插件要改写的对象*

一段好的提示词会讲清六件事——让模型扮演什么角色、交付什么结果，在什么上下文和约束下做，分哪几步，以什么格式输出，怎样算合格，边界在哪。

插件做的，就是把这几件事替你补齐。

## 按钮与结果卡

插件在输入框工具栏加了一个「提示词增强」按钮。点一下，插件就会把你的草稿交给 DSH 的模型服务，把它改写成结构化提示词。

改写后的提示词会出现在输入框上方的结果卡里，不遮挡对话。草稿不会被直接替换：你可以回填、复制、重新生成或撤销，改写前的草稿随时可恢复。

## 功能一览

| 功能 | 说明 |
|---|---|
| 🐋 **一键增强** | 输入框工具栏按钮（带星芒的 DeepSeek 鲸鱼标识）；快捷键默认关闭，可在设置中指定 |
| 🎛️ **右键快捷设置** | 右键或长按输入框按钮打开小卡片：切换推理等级（点进去选档位）与上下文感知；模型行只读，显示固定路由或「跟随会话」；不用打开设置页即可调整 |
| 🖼️ **停靠结果卡** | 结果显示在输入框上方，不遮挡对话；附模型、推理档位、耗时与 `token` 用量；可折叠为标题与底部按钮，长结果不占满屏幕；超限时提示结果可能不完整 |
| ↩️ **回填、复制与撤销** | 结果可直接复制；回填后卡片默认自动折叠为标题行，底部按钮变为「撤销」，点击即可恢复原文并展开结果卡 |
| 🔄 **重新生成** | 按当前输入框内容再请求一版；回填后的增强稿也可继续生成 |
| 💬 **`/enhance` 命令** | 从斜杠面板改写任意文本；结果可复制，不进入模型历史 |
| 🧭 **模型路由** | 设置中同时指定 `provider` 与 `model` 时优先；否则依次跟随当前会话模型、全局默认模型 |
| 🧩 **上下文感知** | `contextAware` 开启时参考最近几条你与助手的消息，补全「它 / 这个」这类指代和草稿省略的任务背景；可随时关闭。<br>*注意：上下文窗口有限，草稿依赖更早消息时请把必要背景补进草稿，否则改写可能偏离你的原意* |
| 🔑 **零凭据配置** | 调用走 DSH 的模型服务，密钥来自 DSH 凭据存储；插件不读取也不保存 |
| 🛡️ **草稿安全** | 空输入、仅附件、超长、含命令或文件引用都在本地拦截；上游失败给出可读提示，且不改动草稿 |
| ⚙️ **配置热生效** | 字段改完自动保存，常用项在前、其余收进「高级设置」；下一次调用立即生效 |

## 环境要求

| 项目 | 要求 |
|---|---|
| DSH | `>= 0.1.1-rc.2 < 0.3.0`，已在 `0.2.2-rc.3` 与 `0.2.2-rc.5` 验证 |
| Node（仅从源码构建时需要） | `^22.19.0 \|\| >=24.0.0` |

超出该范围的 DSH 版本未经验证，可能无法加载或工作异常。

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
2. **查看结果**：结果出现在输入框上方的结果卡里，可以：
   - **回填**：写回输入框，卡片默认自动折叠为标题行，底部按钮变为「撤销」；
   - **复制**：复制结果；
   - **重新生成**：按当前输入再生成一版。
3. **撤销**：点卡片底部的「撤销」恢复原文，同时展开结果卡。
4. **关闭**：发送消息时卡片自动收起，按 `Esc` 也可以关闭。

### 按钮外观

![增强按钮的三种状态：空输入、默认、悬停](./docs/images/enhance-button.png)

按钮位于输入框工具栏右侧。从左到右：空输入（灰）、默认颜色、悬停颜色。

输入为空或只有附件时，按钮会变灰、不可点；「重新生成」在空草稿时同样置灰并提示先输入文字；超长、含命令或文件引用的草稿会被本地拒绝。输出达到 token 上限时，结果卡显示红色截断警告；草稿改动后该警告隐藏，只保留草稿变更提示。

### 快捷设置卡

右键或长按工具栏的增强按钮，会打开一个快捷设置卡：推理等级点进去选档位，上下文感知可直接开关；模型行只读，显示固定的 provider/model 或「跟随会话」。这个卡片只修改设置，不会触发增强；完整设置仍在设置页。

![右键或长按按钮打开的快捷设置卡](./docs/images/quick-settings.png)

### `/enhance` 命令

从斜杠面板改写任意文本，结果可复制，不进入模型历史。

结果卡页脚的 ⓘ 显示本次增强实际引用的对话消息条数与字符数，例如 `3/8 条 · 3,140/4,000 字（79%）`：8 来自 `contextMaxMessages`，百分比按 `contextMaxChars` 计算；DSH 注入的环境/技能/时间等消息不计入。草稿带附件时，还会显示 `附件：N 个`——只统计数量，附件内容不会发送。

## 配置

在 **设置 → 提示词增强**（或 插件面板 → `dsh-prompt-enhance` → **配置**）编辑。字段在失焦时自动保存，保存状态显示在保存按钮旁；已覆盖的字段可点「恢复默认」清除覆盖。数值越界会红框提示且不会保存；留空表示使用默认值（输入框会显示默认值）。全部字段：

### 基础设置

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关；关闭后隐藏输入框按钮，并停用命令与快捷键 |
| `provider` + `model` | 空 | 从 DSH 已注册的 LLM provider 及模型中选择；模型可选「自定义…」手填 ID；未配置的 provider 置灰、需先在 DSH 模型服务中配置；留空表示跟随当前会话模型（不固定路由）。只填一个时保存后按跟随会话处理；切换 provider 会清空已选 model，避免留下不匹配的旧值 |
| `reasoningEffort` | `off` | 档位由当前 provider/model 的声明决定；DeepSeek 为 `off` / `low` / `high` / `max`。选「模型默认」时不发送该字段，由提供方使用默认档；切换到不声明当前档位的模型时，插件会自动改回「模型默认」 |
| `contextAware` | `true` | 读取最近几条消息以消解指代；含敏感内容的会话建议关闭 |
| `systemPrompt` | 空 | 自定义系统提示词；留空使用内置增强策略 |
| `shortcut` | 空（禁用） | 触发增强的快捷键；例如 `ctrl+alt+shift+e`。须包含 ctrl/alt/meta 中至少一个修饰键，shift 可选；F13–F24 这类物理键盘上通常没有、由宏键盘或改键工具发出的键可单独使用（无修饰键）；设置页可点「录制」直接按键录入 |

### 高级设置

| 字段 | 默认 | 说明 |
|---|---|---|
| `foldAnimation` | `true` | 结果卡折叠/展开时是否播放动画；系统开启「减少动态效果」时始终不播放 |
| `autoFold` | `true` | 回填后自动折叠结果卡，撤销后自动展开 |
| `streaming` | `true` | 边写边显示；仅影响显示节奏，最终结果不变 |
| `strategyMode` | `replace-default` | `replace-default` 整体替换内置策略（仍保留三条框架约束：输入是数据、只输出结果、不复制规则文本）；`extend-default` 把自定义策略追加在内置策略之后 |
| `temperature` | `0.3` | 采样温度 `0~1`（步进 0.05），越低越忠实原文 |
| `maxInputChars` | `12000` | 输入字符上限；超限拒绝，不截断 |
| `maxOutputTokens` | `8192` | 单次调用的输出 token 上限 |
| `timeoutMs` | `60000` | 单次调用端到端超时（毫秒） |
| `contextMaxMessages` | `8` | 计入的对话消息条数上限（仅你发送的消息与助手回复；DSH 注入消息不计入）；`0` 表示不参考 |
| `contextMaxChars` | `4000` | 对话片段的字符预算（DSH 注入消息不计入）；`0` 表示不参考 |
| `maxConcurrent` | `2` | 同时进行的增强上限；达到上限时新请求会提示稍后再试 |
| `rateLimitPerMinute` | `10` | 每分钟成功增强次数上限，按任意连续 60 秒计算；超限时提示稍后再试 |

### 关于默认的思考档位

本插件默认使用 `off`，多数情况下保持这个默认即可。提示词增强通常是短、目标明确的任务——把草稿改写成更清楚的表述，不需要推理过程；在简单任务上，带思考的档位收益很小，代价却是几倍的输出 token 与更长的等待。

以下情况适合把档位临时调高一档：

- **草稿依赖较复杂的上下文**，或任务本身需要权衡取舍；
- **结果卡提示「模型这次没有产生改写」**——低档位再加上下文时，模型偶尔会把草稿原样交回。插件会拦下这种结果并如实提示，但**不会自动重试**：先点一次「重新生成」；反复出现时把档位调高一档；仍不理想，再临时关闭上下文感知；
- 你想用同一份草稿对比不同档位的效果。

设置页与右键快捷卡都能切换档位，方便就地对比。需要更强能力时，换一个更好的模型通常比一直抬高档位更划算。

选模型时不要用能力过弱的模型：增强的产物是交给下游执行的任务描述，用明显更弱的模型改写，容易把话说得含糊、丢掉关键约束，甚至与你的原意产生偏差——**一份质量更低的提示词，可能比不改写更糟**。因此不要用比当前会话模型能力更低的模型来负责提示词优化。

## 安全

- **仅本机可访问**：增强路由由本机 DSH 宿主提供，信任判断分两层。宿主提供连接校验（`ctx.connection.requestRejection`）时以宿主为准：`Host` 必须是回环或可信主机、`Sec-Fetch-Site` 非 cross-site、`Origin` 与 `Host` 同源，并校验浏览器会话；返回 401/403 即拒绝。宿主放行后，插件只再做结构性检查（socket 回环、`Host` 允许列表、拒绝 `X-Forwarded-For` / `Forwarded`），不再自行判断 `Origin` / `Sec-Fetch-*`——桌面版（Electron 桥接）的请求不带这些头，判断由宿主完成。宿主不提供该服务时退回插件栅栏并记录一次警告，此时按完整规则默认拒绝：缺 `Host`、`Sec-Fetch-Site: cross-site`、非 GET 请求缺 `Origin` 均被拒。宿主提供连接校验时，本机脚本直接调用需要 DSH 会话，否则会收到 401；调试请用 DSH 界面里发起的请求。
- **只接受 JSON 请求体**：缺 `Content-Type` 或不是 `application/json`（含 `+json` 后缀）的请求返回 415，挡掉表单式的简单跨站请求。
- **不要经反向代理暴露**：代理会改写 `Host`、可能丢弃 `Origin`，插件看到的就不再是访客的真实来源；带 `X-Forwarded-For` / `Forwarded` 的请求会被直接拒绝，但这不足以让反代场景变安全。请只在本机直连使用，不要把本插件的路由放在反向代理后面。
- **远程访问下不可用**：当 GUI 不是从本机地址（`127.0.0.1` / `localhost`）打开，而是经由远程访问或中继地址打开时，点增强会失败并返回 `403 forbidden: loopback-only`。这类请求会带上 `X-Forwarded-For`，`Host` 也是非回环域名，而插件的结构性检查不区分转发来源，一律拒绝。这是有意的安全边界，不是故障；请在本机浏览器中使用增强。
- **提示注入边界**：草稿被包在 `<raw_prompt>` 标签里，草稿内出现的闭合标签会被中和；这能降低标签逃逸风险，但提示词层面的边界是**最佳努力，不是硬保证**。
- **不保存模型密钥**：插件不读取或存储模型 API key，调用复用 DSH 已有的模型配置与凭据。
- **上下文仅在开启时发送**：`contextAware` 开启时，最近几条 user/assistant 消息和当前草稿会发给当前配置的模型服务商（默认最多 8 条消息、4000 字符）；系统消息、模型推理内容、工具结果和附件不会进入上下文；增强器只会知道草稿附带的附件数量（用于避免误称“没有附件”），不会收到附件内容；它可以在任务描述里写「见附件」这类指代，但不会据此描述或推断其内容；只统计你本人发送的消息与助手回复，DSH 注入的环境/技能/时间等上下文不会计入，也不会消耗这段预算。关闭后只发送草稿。
- **敏感会话**：如果内容不能外发，请关闭 `contextAware`，或改用你信任的本地/私有模型服务。
- **本机档位缓存**：插件把「当前路由声明了哪些推理档位」按 provider/model 缓存在 `$DSH_HOME/dsh-prompt-enhance/reasoning-efforts/`（未设置 `DSH_HOME` 时为 `~/.dsh/…`），30 天后自动失效并重新探测。缓存文件只含 provider、model 与档位信息，不含 API key、草稿或对话内容；可在设置页点「刷新」立即重新探测，或直接删除该目录。
- **上限按进程计**：`maxConcurrent` 与 `rateLimitPerMinute` 由每个 DSH 进程各自维护，多开进程或多次挂载时配额分别计算，不是全局限流。

## 工作原理

```mermaid
flowchart LR
    A[输入框草稿] --> B{本地校验<br/>空 / 仅附件 / 超长 / 含命令或文件引用}
    B -- 拒绝 --> R[结果卡：可读错误<br/>草稿不被改动]
    B -- 通过 --> C["POST /dsh-prompt-enhance/enhance<br/>流式为 /dsh-prompt-enhance/enhance-stream"]
    C --> D["ctx.llm.stream<br/>按设置解析出的路由调用模型"]
    D --> E[归一化：去代码围栏、裁剪空白<br/>空结果拒绝]
    E --> F[结果卡：停靠在输入框上方]
    F -- 回填 --> G["写回输入框<br/>原文进入撤销栈"]
    F -- 复制 / 关闭 --> H[草稿保持不变]
    G --> U[撤销：恢复原文]
```

- **宿主端（Host half）**：声明设置项，在宿主 Web 服务挂 `POST /dsh-prompt-enhance/enhance`（流式 `/dsh-prompt-enhance/enhance-stream`），注册 `/enhance` 命令，并通过 `ctx.llm.stream` 调模型；路由按「设置里的 `provider`/`model` → 当前会话记录的模型 → harness 默认模型」解析。
- **浏览器端（Browser half）**：输入框按钮、右键快捷设置卡、停靠结果卡、撤销条与快捷键都在这一半，它同时把设置镜像到界面。
- 点按钮后先在**本地拦截**：空输入、仅附件、超长、含命令或文件引用的草稿直接拒绝，不发请求。
- 通过后请求宿主路由；路由入口先过信任闸门（宿主连接校验，宿主缺少该服务时由插件 fence 兜底，见「安全」），再对入参做一次服务端校验并调用模型；浏览器优先走 SSE，不支持时回退一次性 JSON。
- 模型输出经**归一化**（去代码围栏、裁剪空白、空结果拒绝）后进入**停靠结果卡**。
- **回填**把结果写回输入框，并把原文压入撤销栈；点「撤销」恢复原文。
- 右键快捷设置卡只修改推理等级、上下文感知等设置，本身不触发增强。

## 提示词系统

每次调用由四块规则拼成：**策略**（默认或自定义）、上下文规则（有上下文时）、附件规则（有附件时）、**框架契约**（每次调用最后追加）。只有策略决定产物的形态；其余三块只约束框架：草稿是数据、只输出结果、不复制这些规则。

| 情形 | 系统提示的组成 |
|---|---|
| 默认策略 | 默认策略 + 上下文规则（有上下文）+ 附件规则（有附件）+ 框架契约 |
| `replace-default` | 自定义策略 + 上下文规则（有上下文）+ 附件规则（有附件）+ 框架契约 |
| `extend-default` | 默认策略 + 上下文规则（有上下文）+ `Operator additions` 段 + 自定义策略 + 附件规则（有附件）+ 框架契约 |

### 默认策略

默认系统提示词要求模型以「提示词改写专家」的身份工作，按草稿实际缺什么补什么，覆盖六要素：

1. **角色与目标**：写明助手扮演谁、最终交付什么。
2. **上下文与约束**：只补充草稿能推导出的背景与限制，不添加草稿没有的事实或要求。
3. **可执行步骤**：把含糊或多段的需求拆成编号、可执行的步骤。
4. **输出格式**：按需求指定结构、语言、长度与风格。
5. **验收标准**：说明怎样判断结果正确。**这一项不跳过**——一行即可；草稿没有任何依据时允许用占位符。
6. **边界条件**：列出边界情况、无效输入，以及信息缺失时怎么处理。

同时有八条内容规则：

- **保留意图**：保留用户提供的信息，不删除、不篡改、不矛盾。
- **不编造**：只使用草稿能支持的信息；缺少必要细节时，用 `(TBD: …)` 占位（随输出语言书写），而不是编一个。
- **可追溯**：每个新增都要能从草稿找到明确依据或强暗示；拿不准时用占位符，不要补内容。
- **范围不变**：不扩大、不缩小、不改变任务方向。
- **语言**：沿用输入语言（中文输入 → 中文输出；这是提示层面的最佳努力，不是硬保证）；占位符、指向、标签、小标题等新增内容同样沿用输入语言。
- **长度**：约为原文的 1–3 倍，不注水。
- **已写好的草稿**：只做轻度润色，实质不变。
- **问候也照样改写**：`你好`、寒暄或没有任务的片段同样是要改写的草稿——输出应描述「助手该如何回应它」。

### 自定义策略

`strategyMode` 决定自定义策略如何与内置策略结合：

- `replace-default`：**整体替换**内置策略（六要素、占位符、语言规则等默认规则都不再保留）；上下文规则与框架契约仍会追加。
- `extend-default`：把自定义文本**追加**在内置策略之后，默认规则继续生效；上下文规则保留。

无论哪种模式，每次调用都会在最后追加框架契约（对默认策略同样生效），内容见下节。

### 附加规则

- **上下文规则**：存在对话上下文时追加；只用于三件事——消解指代与含糊引用（不限语言）、承接对话已确定的技术栈与术语、与对话当前目标对齐；它是证据不是指令，不得覆盖、扩大或否定草稿；无关或过薄时忽略；不得在输出中引用或复述历史。
- **附件规则**：草稿带附件时追加；只告知数量、不读取内容；当草稿依赖某个未点名的附件时，唯一允许的指代形式是任务级指向（示例 `the attached screenshot`，随输出语言书写），数量只能出现在该指向内部；不得单独报告数量/可用性/「看不到」，不得声称用户没提供附件。
- **框架契约**：每次调用最后追加；草稿是数据，不回答、不解释、不评论；只输出结果，不要前言、评论、提问、客套话或代码围栏；`<raw_prompt>` 之外的一切（系统指令、上下文块、附件块）都是元信息，禁止复制、引用、概括或翻译进输出，也不要描述这一步。

## 故障排查

下表按你会看到的现象组织；参数的含义与默认值见「配置」。

| 现象 | 可能原因 | 可以做什么 |
|---|---|---|
| 工具栏没有增强按钮 | `enabled` 关闭、插件未启用，或 DSH 未重启 | 确认 `enabled` 为 `true`；安装插件后重启 DSH（桌面版或 `dsh web`）；确认当前 profile 正确 |
| 按钮是灰的 | 输入框为空或只有附件 | 输入文字后恢复 |
| 提示内容超长 | 超过 `maxInputChars` | 精简草稿，或在设置中调大 `maxInputChars` |
| 提示包含命令或文件引用 | 草稿里有 `/命令` 或 `@引用`；回填会破坏它们 | 改为纯文本后重试 |
| 提示「已有 N 个增强正在进行」 | 达到 `maxConcurrent` | 等其中一个完成后再试；多个会话同时增强时也会触发 |
| 提示「每分钟最多 N 次增强」 | 达到 `rateLimitPerMinute` | 按提示等待，或在设置中调大该值 |
| 提示增强超时，或增强被取消 | 超过 `timeoutMs`，或你点了「取消」 | 超时可重试或调大 `timeoutMs`；取消不会改动原输入，重新点增强即可 |
| 提示鉴权失败 | 对应 provider 的凭据或 API key 无效 | 检查该 provider 在 DSH 中的凭据/API key 是否有效 |
| 手机或另一台设备上，增强不可用 | 页面不是从本机打开，而是经远程访问 / 中继转发进来；插件只接受本机请求 | 改在本机浏览器里使用增强 |
| 结果被截断 | 达到 `maxOutputTokens` | 查看截断提示，并在设置中调高 `maxOutputTokens` |
| 结果卡里是草稿本身（可能只多了一个标点） | 低推理档位 + 上下文感知时，模型偶尔不产生改写，把草稿原样交回 | 插件会判定为「没有产生改写」并提示。先重试；反复出现时把推理档调高一档；仍不理想再临时关闭上下文感知 |
| 上下文用量显示 `8/8 条`（默认值） | 达到 `contextMaxMessages` 的消息条数上限（默认 8）；这是正常截断，不显示警告 | 一般无需处理；需要更早的对话时调大 `contextMaxMessages`，但可能先撞上 `contextMaxChars`（默认 4,000 字） |
| 上下文用量显示 `4,000/4,000 字`（默认值，琥珀色） | 达到 `contextMaxChars` 的字数上限（默认 4,000），较早内容未发送；最新一条被截头时原因行会写「最新一条仅发送了开头」 | 调大 `contextMaxChars`，或精简对话/减少引用；上下文越多，输入 token 和费用越高 |
| 提示「还没确定用哪个模型」（缺模型路由） | 未固定 `provider`/`model`，且当前会话没有模型路由 | 在设置中成对填写 `provider` / `model`；或先在当前会话发一条消息，让插件跟随会话模型 |
| `/enhance` 的结果只显示第一行、点不开 | DSH 聊天界面的渲染限制，与本插件无关 | 把同样的文本放进输入框，用增强按钮；结果卡会自动折行并可滚动 |

## 已知问题

下面列出目前已知的问题，按编号排列。标注「暂无支持计划」的条目，是当前不提供的能力，不是等待修复的缺陷。

### 1. 引用保留类功能（暂无支持计划）

本插件**不做引用保留**，也不提供「芯片保留式回填」这类把 `@文件` 引用、链接或命令原样写回输入框的能力。含这类引用的草稿会在本地被拒绝，不会发出请求。本插件只增强你敲下的文字：把草稿改写成更完整、更明确的提示词，不负责搬运或重建引用结构。

#### 为什么不做

改写必然要重新组织正文。一旦允许引用标记参与这段正文，它们就会限制作改能动的范围，也会让模型把注意力分给标记本身，正文的完整性与可读性都要为此让步。**引用标记破坏正文，是我们不能接受的错误**，所以宁可拒绝，也不做这类保留。

#### 实测到的破坏类型

参考同类插件的「芯片保留式回填」方案并实测，复现出三类问题：

- **引用失效**：引用芯片消失，或退化成一串看起来像引用的普通文字；
- **引用错误**：引用还在，但位置或指向变了，与正文对不上；
- **正文被并入引用**：本该属于正文的文字被吸附进了引用范围。

这三类问题在结果里直接可见：拿到增强后的提示词时，就能看出格式已经被破坏——引用没了、变成了普通文字，或者位置与正文对不上。

#### 遇到这类草稿怎么办

- 含 `@文件` 引用、链接或命令的草稿会被本地拦截，不发请求（见「工作原理」）；
- 草稿带附件时，只告诉模型附件的数量，不读取、不发送附件内容，也不在结果里插入附件标记；
- 需要增强这类草稿时，先把引用去掉、把必要信息写成纯文字，增强完成后再手动把引用插回去。

### 2. 读取图片与附件内容（暂无支持计划）

本插件**不读取图片，也不读取附件内容**。草稿带附件时，它只知道附件的数量，并被明确告知看不到附件：可以写「见附件」这类指代，但不能描述、猜测或转述附件里有什么。附件原件会随你的消息一起发送给下游模型，由下游自己查看。

#### 为什么不做

增强要交付的是一段更好的**文字**。一旦让增强模型去读图或读附件，它读到的内容就会变成这段文字里的一段转写：转写可能出错，而原件同时也到达下游，两者对不上时以谁为准并没有保证。图片尤其如此——小字、图表数值这类细节误读代价高，而它们恰恰是下游对着原件看最可靠、增强模型最容易读错的部分。

成本上也不划算：同一份内容会被读两次，一次在增强时、一次在执行时，图片在 token 上的体现尤其明显。二进制附件（PDF、DOCX 等）还有另一层限制：宿主侧不会把它的内容交给模型，只给出文件句柄，真要读正文得由插件自己解析，那是另一个量级的工作。

#### 替代做法

把真正需要的信息直接写进草稿：确切的报错、数值、字段名、步骤。这些正是增强能改好的东西；附件里的其余部分，交给下游带着原件去看。

## 开发

**常用命令**

```bash
npm install
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run watch
```

测试覆盖输入校验、输出归一化、宿主路由（真实 HTTP）、设置与快捷设置状态机，以及 React 组件行为。

**架构**

插件由宿主半与浏览器半组成，二者只通过 HTTP 路由与 `src/shared/` 中的纯函数、常量交互，源码中没有跨半 import。宿主半决定「能不能调用、怎么调用」，浏览器半决定「何时调用、结果如何回到输入框」。

宿主半 `src/`：

```text
src/
├── index.ts               装配：设置源、HTTP 路由、/enhance 命令
├── config.ts              设置 schema、逐请求解析、策略组装
├── prompts.ts             内置策略、上下文/附件规则、框架契约与 <raw_prompt> 框定
├── orchestrate.ts         两条增强入口共用的编排：路由解析、上下文装配、调用与日志
├── enhancer.ts            单次模型调用：流式拼装、超时与取消、输出归一化
├── enhance-routes.ts      POST /dsh-prompt-enhance/enhance 与 /enhance-stream
├── enhance-command.ts     /enhance 斜杠命令
├── admission.ts           准入控制：滑动窗口限流、并发上限、连续失败熔断
├── context.ts             会话上下文窗口的选取与字符预算
├── trust.ts / loopback.ts 信任闸门：宿主连接校验，缺失时退回仅回环 fence
├── http.ts / sse.ts       有界 JSON 读写、带回压的 SSE 写出
├── settings-source.ts     跨 DSH 代际的设置读取
├── catalog-route.ts       设置页的 provider/model 目录与路由检查端点
├── provider-catalog.ts    provider/model 目录的只读投影
├── reasoning-route.ts     推理档位查询端点
├── reasoning-efforts.ts   档位解析：按 provider/model 询问适配器
├── reasoning-cache.ts     档位答案的持久缓存（DSH home，一对文件）
└── shared/                两端共用：协议、字段边界、默认值、校验、归一化、流式文本
```

浏览器半 `src/client/`：

```text
client/
├── index.tsx              装配：按钮、撤销条、词典、设置镜像、全局快捷键
├── EnhanceButton.tsx      输入框按钮：本地拦截与请求编排
├── enhance-client.ts      宿主端点客户端（SSE 优先、JSON 回退、结构化错误）
├── ui-state.ts            结果卡状态机与外订阅（每会话一份）
├── ResultDock.tsx         停靠与折叠编排
├── ResultPanel.tsx        结果卡渲染（回填、复制、重新生成、取消）
├── UndoBar.tsx            撤销条
├── QuickSettingsMenu.tsx  右键快捷设置卡
├── quick-settings.ts      快捷设置的档位与写回
├── settings*.ts           设置镜像、读写与跨代际适配
├── settings-page*         插件设置页（行规格、控件、样式、文案）
├── llm-catalog.ts         目录查询的浏览器缓存
├── reasoning-options.ts   档位选项
├── shortcut.ts            快捷键解析与匹配（纯函数）
├── undo-stack.ts          每会话撤销栈（纯工厂）
├── session-key.ts         每会话 UI 状态键（含跨代际 shim）
├── locales.ts / styles.ts / ActionIcons.tsx / SparkleFishIcon.tsx
└── useDockAlignment.ts    停靠项与输入框的宽度对齐
```

结构约束（均可在代码中验证）：

- **单一编排路径**：按钮路由与 `/enhance` 命令都调用 `orchestrate.runEnhance`，共用同一个准入闸门与同一套提示词装配，两个入口的行为不会漂移。
- **单一信任闸门**：每个路由都先经 `trust.ts`；宿主没有连接服务时退回 `loopback.ts` 的仅回环校验。
- **逐请求配置**：`settings-source.ts` 每次调用重新读取设置，改设置无需重启。
- **单一提示词装配点**：`system` 只在 `orchestrate.ts` 组装，常量由 `prompts.ts` 持有；产物形态只由策略层决定。

```text
scripts/
└── build.mjs              用 esbuild 把两半构建到 lib/
```

构建产物：

- `lib/index.js`：宿主半（ESM，包导入保持 external，由 DSH 插件加载器解析 `@deepseek-ai/*`）；
- `lib/client.js`：浏览器半（CJS，包在 `window.__ModuleLoader__.load({ id, factory })` 外壳里）。

`lib/` **随仓库提交**，从 GitHub 安装时无需本地构建。CI 会在推送到 `main` 或开 PR 时从 `src/` 重新构建并比对 `lib/`，不一致就失败——所以改完源码要跑 `npm run build`，把 `lib/` 和源码一起提交。

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

本项目采用 Apache-2.0，见 [LICENSE](./LICENSE)。

## 致敬

感谢 [rongxingda/dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance)：本项目的代码与设计建立在该项目（Apache-2.0）的基础之上。
