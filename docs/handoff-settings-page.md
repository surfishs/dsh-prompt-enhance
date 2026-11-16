# 交接：dsh-prompt-enhance 配置页（feat/settings-section）

> **历史文档**：写于本仓库仍沿用上游 `dsh-prompt-enhance@0.3.4` 版本号的时期，文中出现的版本号、字段数与用例数都是当时的口径，不代表当前 `0.0.x` 版本线的状态。当前版本与用例数请以 `package.json` 和 `CHANGELOG.md` 为准。

给下一个会话（创造模式）的交接说明。读这份就够开工，不需要重新调查宿主。

**状态（2026-11-13）**：插件有**两个**配置入口，共用同一套 staged 表单：
① 设置对话框左侧「提示词增强」（`settings.section`，这是本插件一直自己画的那页）；
② 插件页（`plugins.row.config`，宿主文档规定的插件自带配置入口）。
17 个字段全部接通，临时探针已删；`npm run typecheck` / `npm test`（25 文件 / 265 用例）/
`npm run build` 全绿，`lib/client.js` 已重建并复制到运行目录。

## 目标

在 DSH `0.2.2-rc.1` 桌面版里，为 `dsh-prompt-enhance@0.3.4` 提供配置页。

插件作者**没有写过任何设置 UI**：插件只声明 schemastery `Config`，页面过去靠宿主
`SettingsForms.describe()` 按 schema 自动生成；`0.2.2-rc.1` 不再为普通 profile 条目生成。

## 两个入口各自是什么

### ① 设置对话框页（`settings.section`）

插槽契约：`settings.section`，list 槽，注册 `{ id, order, label, locale, inject }`。
本插件：`id: dsh-prompt-enhance`、`order: 70`、`label: 提示词增强`。

这一页的呈现是**刻意保留的诊断形态**：标题 `英文键（中文名）`（如 `enabled（总开关）`），
提示中英双语用 `｜` 连接，页首有一句「这些设置写入宿主侧 dsh-prompt-enhance 配置节」。
用户明确要求保留这一版 UI，别把它当成「应该统一成人话标题」而改掉。

### ② 插件页行配置（`plugins.row.config`）

宿主文档（`@deepseek-ai/dsh-client-ui-plugin-manager/README.zh.md`「配置页」）规定：
自带配置的插件在插件页提供配置，三个 slot 分别是
`plugins.item`（官方插件）、`plugins.bundle.config`（组合包）、
**`plugins.row.config`（`<包名>#<行 id>`）**。行上会多一个「配置」控件，打开该行自己的页面；
管理器画标题/图标/面包屑，传 `view: 'page' | 'summary'` 和该行的 `form`；离开页面丢弃暂存。

本插件：包名 `dsh-prompt-enhance`，行 id `dsh-prompt-enhance`（见 `cordis.patch.yml`），
注册 key **`dsh-prompt-enhance#dsh-prompt-enhance`**。这一页用 locale 文案（人话标题、单语提示），
`view === 'summary'` 返回「模型、上下文与资源限制」。

**管理器怎么决定要不要画「配置」控件**（`plugin-manager/lib/client.js`）：

```js
const configure = (pkg) => ({
  has: (row) => ledger.rows.has(rowConfigKey(pkg.name, row.rowId)),   // `${pkg}#${rowId}`
  open: (row) => setView({ kind: 'row', name: pkg.name, rowId: row.rowId }),
})
```

运行时验证：`cordis_inspect_query`（client `Slots.listSubTree`, root `plugins.row.config`）显示
occupants 里已有 `dsh-prompt-enhance#dsh-prompt-enhance`，同槽还有 `dsh-free-search#web-search-free`、
`@michengai/dsh-btw#michengai-btw`——说明注册是活的，第三方插件也用同一套。
**注意入口位置**：是**侧边栏「插件」面板**（带安装/启停、组合包列表的那个），
不是 **设置 → 插件**（那是 `settings.plugins.tab` 的标签页宿主，只有「全部 / dsh-market」两个清单页，
不承载行配置）。

## 共用层（两个入口都走它）

- 一个 `SettingsPageController`：`createSettingsForm(scope)` → `SettingsFormModel(scope, 描述符)`
  → `bind(projection)` 出 store → `inject()` 返回 `{ hooks: { promptEnhance: store }, ...form.actions() }`。
  两个槽的 `inject` 都指向同一个 controller，因此两页共享同一份暂存状态。
- `SettingsRows` 渲染 17 行；两种 `RowCopy` 只决定文案：`SECTION_COPY`（键名+中文名、双语提示）
  与 `pageCopy(t)`（单语、跟随 locale）。
- 三种行形态：3 个布尔（`enabled` / `contextAware` / `streaming`）用 `Switch`；
  2 个枚举（`strategyMode` / `reasoningEffort`）用 `SegmentedControl`；
  其余 12 个用 `SettingsValueField`（文本/数字）。

## primitives 契约（从壳 bundle 实测，省得重新挖）

primitives 编译进了 Web 壳前端包，就在 app.asar 里：

```
dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js   （约 970 KB）
```

asar 可以直接用 node 读（pwsh 的 `Get-ChildItem` 只把它当文件）：

```js
// 本机 app.asar 的 header 有 12 字节 pickle 前缀，JSON 从 offset 16 开始
const b = fs.readFileSync('D:\\DeepseekHarness\\resources\\app.asar')
const len = b.readUInt32LE(12)
const header = JSON.parse(b.subarray(16, 16 + len).toString('utf8'))
// base = 16 + len；条目 offset 相对 base，按 header.files 找到目标路径后切片
```

官方设置页源码同在同一份 asar：`dsh-client-ui-settings-agent-loop/lib/client.js`（最小例子）、
`...-web-search/lib/client.js`（`Switch` + 多 namespace + 自定义保存顺序）。

**导出**（相关部分）：`SettingsForm`、`SettingsFormModel`、`SettingsValueField`、
`SettingsSecretField`、`settingsTextField`、`settingsNumberField`、`Switch`、
`SegmentedControl`、`Tag`、`Menu`、`Modal` 等。

**字段描述符是普通对象**，布尔/枚举可以自写，不必绕过表单模型：

```ts
settingsTextField(k)   → { field:k, format:v => typeof v==='string' ? v : '',
                           parse:t => t.trim()==='' ? {kind:'clear'} : {kind:'set', value:t.trim()} }
settingsNumberField(k) → { field:k, format:v => typeof v==='number' ? String(v) : '', parse: … }

class SettingsFormModel {
  constructor(scope, specs, secretSpecs = [])
  bind(project)   // → { getSnapshot, subscribe }，宿主再包装成 selector hook
  shell()         // { available, writable, dirty, invalid, saving, failed }
  field(key)      // { text, overridden, invalid }
  actions()       // { edit(key,text), resetField(key), save(), discard() }
  plan()          // clear → unset；text === format(现值) → 跳过；parse → set
  dispose()
}
```

**自写描述符的机关**：`parse` 返回什么就写什么 JSON 值，所以：

```ts
settingsBooleanField(k) → parse: t==='true' ? {kind:'set', value:true}
                               : t==='false' ? {kind:'set', value:false}
                               : t==='' ? {kind:'clear'} : undefined
settingsEnumField(k, opts) → parse: t => opts.includes(t) ? {kind:'set', value:t} : undefined
```

**不要**改成绕过表单模型直接 `remote.settings.mutate`——会丢掉 staged/保存/丢弃/覆盖标记/恢复默认。

**原语 props**：`Switch({checked,onChange(next:boolean),label?,disabled?})`、
`SegmentedControl({id,value,options:[{value,label}],onChange(next),label?,disabled?})`、
`Tag({tone, children})`。

**行样式**：宿主设置行用 CSS module `181ew`，自绘行照抄其度量
（`display:flex;flex-direction:column;gap:6px;padding:12px 0`；标签 13px/500；
提示 12px/1.5 `var(--dsw-alias-label-tertiary)`；行间 `0.5px solid var(--dsw-alias-border-l2)`）。
分隔线放外层包裹 div，因为原生 `.field + .field` 不会跨到自绘行。

**jsx 陷阱**：`react/jsx-runtime` 的 `jsx(type, props, key)` 第三参是 **key**，
children 必须放 `props.children`。手写 `jsx()` 时传错会渲染成空白页。

**测试侧**：primitives 没装也不该装，Vite 在 transform 阶段解析不到它 → 任何 import 到
`src/client/index` 的测试都会在收集阶段挂。`vitest.config.ts` 把它 alias 到
`tests/support/ui-primitives.tsx`（行为替身，含 `SettingsFormModel` 的忠实移植）。

## 已完成

| 项 | 位置 |
|---|---|
| 两个入口 + 共用表单（17 字段） | `src/client/settings-page.tsx` |
| 页面文案（`settings.*`，zh/en） | `src/client/locales.ts` |
| 宿主 primitives 的环境声明 | `src/client/primitives.d.ts` |
| 注册调用 | `src/client/index.tsx` 的 `apply()`：`installSettingsPages(ctx)` |
| 两个入口的回归测试（9 例） | `tests/settings-page.test.tsx` |
| primitives 行为替身（只给测试用） | `tests/support/ui-primitives.tsx` |
| Vitest 别名 | `vitest.config.ts` |
| 构建产物 | `lib/client.js`（提交在分支上；已部署到运行 profile） |
| 远端分支 | `surfishs/dsh-prompt-enhance` → `feat/settings-section` |

## 剩余待办

1. **确认真机入口**：Ctrl+R 后
   - 设置对话框左侧应出现「提示词增强」，17 行、标题 `键名（中文名）`、双语提示；
   - 侧边栏「插件」面板 → `dsh-prompt-enhance` → 行 `dsh-prompt-enhance` 应有「配置」控件
     （注册已证实是活的；若没有，先确认打开的是插件面板而不是 设置→插件）。
2. 发版时补 `CHANGELOG.md`。
3. `README` / `README.zh-CN.md` 仍写「设置 → 插件配置」（宿主自动生成页时代的说法），
   可补一句：0.2.2 起配置在插件页行配置，另有设置对话框页。

## 本机构建与验证

```powershell
cd D:\DeepSeekHarnessWorkspace\dsh-prompt-enhance
npm ci
npm run typecheck
npm test                                  # CI 必过项：25 文件 / 265 用例
npm run build
```

运行目录是 `C:\Users\surfish\.dsh\profiles\desktop\node_modules\dsh-prompt-enhance`：

```powershell
Copy-Item .\lib\client.js "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-prompt-enhance\lib\client.js" -Force
```

回滚文件（保留在运行目录）：

- `lib/client.js.bak-pe-settings` —— 插件原始的 0.3.4 产物（没有任何配置页）
- `lib/client.js.bak-handpatch` —— 更早的手改版

## 依赖镜像

```powershell
npm config set registry https://registry.npmmirror.com
```

## 注意

- 不要改 `lib/client.js` 当源码用；`lib/` 是构建产物，CI 会校验 `git diff --quiet lib/`。
- 页面依赖 `@deepseek-ai/dsh-client-ui-primitives` 运行时存在；它是 dsh web 壳的一部分。
- 自写描述符的 `format` 必须确定性：staged 表单用它做「这一行没改过」的判等基准。
- 插件页注册 key 与行 id 强绑定：`SETTINGS_ROW_ID` 改了必须同步 `cordis.patch.yml` 的 `id`。
- 设置对话框页的 `英文键（中文名）` + 双语提示是用户要求保留的形态，不要「顺手统一」。
