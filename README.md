# dsh-prompt-enhance

[![CI](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml/badge.svg)](https://github.com/surfishs/dsh-prompt-enhance/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

**DeepSeek Harness Web GUI 的「提示词增强」插件** —— 一键把输入框草稿改写为结构化提示词（角色与目标、可执行步骤、输出格式、验收标准、边界条件）。原文保留，失败不改草稿。

简体中文 | [English](./README.en.md)

---

## 功能

- **一键增强**：发送键旁的 ✨ 按钮，或 `Ctrl+Alt+E`（可配置）。
- **对比预览**：原文与结果并排，附模型与耗时；可回填、复制或取消。
- **一键撤销**：回填后输入框上方出现撤销条。
- **`/enhance <文本>`**：从斜杠面板改写任意文本，结果不进入模型历史。
- **模型路由**：设置成对覆盖 → 当前会话模型 → 全局默认模型，逐级回退。
- **上下文感知**：参考当前会话近况消解指代；可关闭。
- **配置热生效**：改完即用于下一次调用，无需重启。

## 环境要求

| | |
|---|---|
| dsh | `>= 0.1.1-rc.2 < 0.3.0` |
| Node（仅源码构建） | `^22.19.0 \|\| >=24.0.0` |
| 插件 | `0.0.x` |

## 安装

从 GitHub（`lib/` 已随仓库提交，无需本地构建）：

```bash
dsh plugin --profile web add github:surfishs/dsh-prompt-enhance
# 重启 dsh web
```

从本地检出（开发用）：

```bash
git clone https://github.com/surfishs/dsh-prompt-enhance.git
cd dsh-prompt-enhance && npm install && npm run build
dsh plugin --profile web add link:C:\path\to\dsh-prompt-enhance
```

npm 上不可用：`dsh-prompt-enhance` 这个名字归上游项目所有。卸载：

```bash
dsh plugin --profile web remove dsh-prompt-enhance
```

## 使用

在输入框留下草稿，点 ✨ 或按 `Ctrl+Alt+E`。空草稿、超长草稿、仅图片、含命令或引用块的草稿会被本地拒绝（超长不截断）；通过后打开预览，回填写回输入框并升起撤销条，复制进剪贴板，`Esc` 取消。结果不满意可重试。

`/enhance <文本>` 从斜杠面板改写任意文本，结果可复制，不进入模型历史。

## 配置

在 **设置 → 提示词增强**（或 插件面板 → `dsh-prompt-enhance` → **配置**）编辑。常用项：

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `provider` + `model` | 空 | 成对覆盖模型路由；都留空则跟随当前会话 |
| `temperature` | `0.3` | 越低越忠实原文 |
| `reasoningEffort` | `off` | `off` / `low` / `high` / `inherit`，改写的推理预算 |
| `maxOutputTokens` | `8192` | 单次调用的输出 token 预算 |
| `maxInputChars` | `12000` | 输入字符上限，超限拒绝、不截断 |
| `timeoutMs` | `60000` | 单次调用超时（毫秒） |
| `systemPrompt` / `strategyMode` | 空 / `replace-default` | 自定义策略；`extend-default` 追加在内置策略之后 |
| `shortcut` | `ctrl+alt+e` | 触发快捷键，留空禁用 |
| `streaming` | `true` | 边写边显示，仅影响显示节奏 |
| `contextAware` | `true` | 参考会话历史；含敏感内容的会话建议关闭 |

其余字段（上下文窗口、并发与限流）见设置页说明。

## 安全

增强路由只由本机 dsh 宿主提供，仅接受回环地址与本地 `Host` / `Origin`。`contextAware` 开启时，会话历史会随草稿发给当前配置的模型服务商——不要把敏感会话的上下文外发。

## 故障排查

- 按钮不出现：确认 `enabled` 为 `true`，且安装后重启了 `dsh web`。
- 「尚未确定增强用的模型」：成对填写 `provider` / `model`，或先在当前会话发一条消息。
- 鉴权失败：检查对应 provider 在 harness 中的 API Key。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
```

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

Apache-2.0（见 [LICENSE](./LICENSE)）。代码与设计建立在 [rongxingda/dsh-prompt-enhance](https://github.com/rongxingda/dsh-prompt-enhance)（Apache-2.0）之上。
