/**
 * Plugin configuration: one schemastery schema rendered automatically by
 * Settings → 插件配置, plus pure resolution/validation shared by the host
 * route, the slash command, and (mirrored defaults) the browser half.
 * @module dsh-prompt-enhance/config
 */

import z from '@deepseek-ai/schemastery'
import { INVARIANT_CONTRACT } from './prompts'
import { DEFAULT_VALUES } from './shared/defaults'
import { FIELD_LIMITS, TEMPERATURE, type NumericRange } from './shared/limits'

/** Settings namespace of the plugin section. */
export const PROMPT_ENHANCE_NAMESPACE = 'dsh-prompt-enhance'

/** How a non-empty `systemPrompt` combines with the built-in strategy. */
export type StrategyMode = 'replace-default' | 'extend-default'

/**
 * Reasoning budget forwarded to the rewrite call.
 *
 * A rewrite is a short, well-specified text transformation, so the cheap
 * efforts return the same quality as the expensive one. `inherit` leaves the
 * field unset so the route's own default applies — the field is omitted rather
 * than guessed.
 */
/**
 * Reasoning effort id forwarded to the model call.
 *
 * Ids are adapter-owned and opaque: DeepSeek declares `off/low/high/max`, other
 * providers declare their own set. `'inherit'` is the plugin's sentinel for
 * "omit the field and let the provider default apply" — it is never forwarded.
 */
export type ReasoningEffortChoice = string

/** The plugin's deployed configuration. */
export interface Config {
  /** Master switch; off hides the composer button and disables all triggers. */
  enabled: boolean
  /** Explicit provider override; must be paired with `model`. */
  provider?: string
  /** Explicit model override; must be paired with `provider`. */
  model?: string
  /** Sampling temperature; low keeps the rewrite faithful to the original. */
  temperature: number
  /**
   * Reasoning budget for the rewrite, forwarded to the model call.
   *
   * A rewrite does not need deep reasoning, and the route's own default can be
   * expensive. Measured on deepseek-flash with one ordinary draft: `off` spent
   * 252 output tokens and returned 439 characters of text, `low` spent 619, and
   * the route default (`high`) spent 2897 for 979 characters. `off` is
   * therefore the default here, which is also why the plugin must send it
   * EXPLICITLY — omitting the field silently inherits the expensive route
   * default.
   *
   * `inherit` omits the field entirely, for routes that reject an explicit
   * effort.
   */
  reasoningEffort: ReasoningEffortChoice
  /** Output token budget of one enhancement call. */
  maxOutputTokens: number
  /** Input character cap; over-length drafts are rejected, never truncated. */
  maxInputChars: number
  /** End-to-end deadline of one enhancement call. */
  timeoutMs: number
  /** System prompt; default is the built-in enhancement strategy. */
  systemPrompt: string
  /**
   * How a non-empty `systemPrompt` combines with the built-in strategy.
   * `replace-default` (the default, matching earlier versions) swaps the
   * built-in strategy out entirely — its hard rules are NOT retained and must
   * be carried into the custom text. `extend-default` appends the custom text
   * after the built-in strategy, keeping those rules in force.
   */
  strategyMode: StrategyMode
  /**
   * Composer keyboard shortcut, e.g. "ctrl+alt+e".
   *
   * Empty by default: the composer button is the primary entry point, and a
   * shipped key combination collides with whatever else the user runs (chat
   * apps, screenshot tools, IMEs). An operator who wants one sets it here.
   */
  shortcut: string
  /** Max concurrently running enhancements (host-side resource cap). */
  maxConcurrent: number
  /** Sliding-window rate cap: enhancements per minute (host-side). */
  rateLimitPerMinute: number
  /**
   * Show the model's output in the panel as it streams instead of waiting for
   * the whole rewrite. Display-only: the final text is still the normalized
   * full result, so the output the user applies never changes.
   */
  streaming: boolean
  /**
   * Read the current conversation's recent history and use it to ground the
   * rewrite (resolve references, supply the established stack/constraints).
   * With no session, no history, or this switch off, the call degrades to the
   * original single-prompt enhancement.
   */
  contextAware: boolean
  /** Context window breadth: how many recent turns may ground the rewrite; 0 admits none. */
  contextMaxMessages: number
  /** Context window depth: character budget of the assembled history snippet; 0 admits none. */
  contextMaxChars: number
  /** Play the result card's expand/collapse transition. */
  foldAnimation: boolean
  /** Fold the card when a result is applied, and re-open it when that apply is undone. */
  autoFold: boolean
}

/** Field defaults, the source of truth for schema defaults and client mirrors. */
export const DEFAULT_CONFIG: Config = { ...DEFAULT_VALUES }

/**
 * The settings section schema (rendered by the built-in plugin config page).
 *
 * Every field is marked `.volatile()`, and that mark is load-bearing, not
 * decoration: the host builds the config page from `SettingsForms.describe()`,
 * which projects each entry through its internal `volatileForm()` and **drops
 * the entire entry** when no field carries `meta.volatile`. A schema without
 * it therefore renders no page at all, and a write against it throws
 * `Plugin entry "…" has no volatile fields`. Marking a field volatile is also
 * a promise that the plugin re-reads it without a remount — which is exactly
 * what this one does (`apply` hands every request a `readConfig()` closure).
 *
 * Deliberately left to inference instead of annotated `z<Config>`: the object
 * schema's `meta.default` carries `Volatile<…>` variants that are not
 * assignable to a plain `Config` default type, so an explicit annotation
 * rejects an otherwise valid schema. The runtime contract (a schemastery
 * schema the loader renders) is what matters here; the interface above stays
 * the compile-time shape of the values this plugin reads.
 *
 * Imported from `@deepseek-ai/schemastery`, not the plain `schemastery`: only
 * the fork carries `.volatile()` (and the placement checks that go with it).
 */
export const Config = z.object({
  enabled: z.boolean().default(DEFAULT_CONFIG.enabled).description('总开关：关闭后隐藏输入框增强按钮并停用所有触发方式').volatile(),
  provider: z.string().description('覆盖模型路由的 provider（与「模型」必须成对填写；留空跟随当前会话模型）').volatile(),
  model: z.string().description('覆盖模型路由的 model（与「provider」必须成对填写；留空跟随当前会话模型）').volatile(),
  temperature: z.number().min(TEMPERATURE.min).max(TEMPERATURE.max).step(TEMPERATURE.step).default(DEFAULT_CONFIG.temperature).description('采样温度；低温改写更忠实于原意').volatile(),
  reasoningEffort: z
    .string()
    .default(DEFAULT_CONFIG.reasoningEffort)
    .description('推理档位：填写当前 provider/model 声明的档位 id（如 DeepSeek 的 off/low/high/max）；inherit 表示不传该字段、跟随提供方默认档')
    .volatile(),
  maxOutputTokens: z
    .number()
    .step(1)
    .min(FIELD_LIMITS.maxOutputTokens.min)
    .max(FIELD_LIMITS.maxOutputTokens.max)
    .default(DEFAULT_CONFIG.maxOutputTokens)
    .description('单次增强的输出 token 上限')
    .volatile(),
  maxInputChars: z
    .number()
    .step(1)
    .min(FIELD_LIMITS.maxInputChars.min)
    .max(FIELD_LIMITS.maxInputChars.max)
    .default(DEFAULT_CONFIG.maxInputChars)
    .description('输入字数上限；超限拒绝而不截断，避免改变原意')
    .volatile(),
  timeoutMs: z.number().step(1).min(FIELD_LIMITS.timeoutMs.min).max(FIELD_LIMITS.timeoutMs.max).default(DEFAULT_CONFIG.timeoutMs).description('单次增强的超时（毫秒）').volatile(),
  systemPrompt: z.string().role('textarea').default(DEFAULT_CONFIG.systemPrompt).description('系统提示词；留空使用内置增强策略').volatile(),
  strategyMode: z
    .union(['replace-default', 'extend-default'])
    .default(DEFAULT_CONFIG.strategyMode)
    .description('自定义系统提示词的组合方式：整体替换内置策略（默认；仅保留插件始终追加的最小输出契约：输入是数据、只输出改写结果），或把自定义文本追加在内置策略之后（内置规则继续生效）')
    .volatile(),
  shortcut: z
    .string()
    .default(DEFAULT_CONFIG.shortcut)
    .description('触发快捷键，默认留空即禁用；如需启用，填如 ctrl+alt+e（须包含 ctrl/alt/meta 中至少一个修饰键，shift 仅可作附加，纯字母/数字或 shift+字母会被忽略；F13–F24 可单独使用）')
    .volatile(),
  maxConcurrent: z
    .number()
    .step(1)
    .min(FIELD_LIMITS.maxConcurrent.min)
    .max(FIELD_LIMITS.maxConcurrent.max)
    .default(DEFAULT_CONFIG.maxConcurrent)
    .description('宿主侧并发上限：同时进行的增强调用数，超出的请求返回 429')
    .volatile(),
  rateLimitPerMinute: z
    .number()
    .step(1)
    .min(FIELD_LIMITS.rateLimitPerMinute.min)
    .max(FIELD_LIMITS.rateLimitPerMinute.max)
    .default(DEFAULT_CONFIG.rateLimitPerMinute)
    .description('每分钟增强次数上限（滑动窗口），超出返回 429')
    .volatile(),
  streaming: z.boolean().default(DEFAULT_CONFIG.streaming).description('增量展示：模型边写边在面板显示（仅影响显示节奏，最终结果不变；宿主或网络不支持时自动回退为一次性返回）').volatile(),
  foldAnimation: z.boolean().default(DEFAULT_CONFIG.foldAnimation).description('卡片折叠动画：展开/收起时播放过渡；关闭后立即切换（系统「减少动态效果」偏好始终优先）').volatile(),
  autoFold: z.boolean().default(DEFAULT_CONFIG.autoFold).description('自动收纳卡片：回填到输入框后自动收起卡片，撤销后自动展开；关闭后卡片保持当前展开状态').volatile(),
  contextAware: z
    .boolean()
    .default(DEFAULT_CONFIG.contextAware)
    .description('上下文感知：读取当前会话近期对话，用于消解指代、补全省略与术语约束；无历史或历史不足时自动回退为单条增强，不臆造信息')
    .volatile(),
  contextMaxMessages: z
    .number()
    .step(1)
    .min(FIELD_LIMITS.contextMaxMessages.min)
    .max(FIELD_LIMITS.contextMaxMessages.max)
    .default(DEFAULT_CONFIG.contextMaxMessages)
    .description('上下文窗口（条数）：最多参考最近多少条 user/assistant 轮次；0 表示不参考')
    .volatile(),
  contextMaxChars: z
    .number()
    .step(1)
    .min(FIELD_LIMITS.contextMaxChars.min)
    .max(FIELD_LIMITS.contextMaxChars.max)
    .default(DEFAULT_CONFIG.contextMaxChars)
    .description('上下文窗口（字数）：历史片段的字符预算，从最新一条向前装配；0 表示不参考')
    .volatile(),
})

/**
 * Normalize a stored reasoning choice.
 *
 * Ids are adapter-owned, so the plugin cannot enumerate them in a schema. A
 * non-empty string is passed through as-is (the adapter rejects an unsupported
 * one with a clear error); only an absent/blank/non-string value falls back to
 * the shipped default. `inherit` keeps its sentinel meaning.
 * @param value - untrusted stored value.
 * @returns the validated choice.
 */
function resolveReasoningEffort(value: unknown): ReasoningEffortChoice {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed !== '') return trimmed
  }
  return DEFAULT_CONFIG.reasoningEffort
}

/**
 * Validate and detach one resolved config. Unknown keys (leftovers from older
 * versions) are stripped — only the schema-known fields survive. The loader
 * fills schema defaults before apply; this re-checks the invariants the schema
 * cannot express (boolean types, numeric ranges) so a bad stored section fails
 * loud at the boundary instead of inside a model call.
 *
 * The provider/model pair is the one deliberate exception: an incomplete
 * override is not corruption but the state the settings page creates on every
 * visit (each field saves as it changes), so it resolves to "no override" —
 * the documented follow-session fallback — rather than throwing.
 * @param config - untrusted resolved section.
 * @returns the validated config, unknown keys removed.
 * @throws Error describing the first violated invariant.
 */
export function resolveConfig(config: Config): Config {
  if (config === null || typeof config !== 'object') throw new Error('dsh-prompt-enhance: configuration is required')
  if (typeof config.enabled !== 'boolean') throw new Error('dsh-prompt-enhance: enabled 必须是布尔值')
  // Whitespace-only is "absent", not "set": the explicit pair is definitionally
  // non-empty, so a blank override strips away as `undefined` rather than
  // surviving as `''` and reading as "an override exists" downstream.
  const pairOrUndefined = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  const provider = pairOrUndefined(config.provider)
  const model = pairOrUndefined(config.model)
  // An incomplete pair is a NORMAL state, not a corrupt section: the settings
  // page persists each field the moment it changes, so picking a provider
  // stores `provider` alone until a model is chosen. Both READMEs and the row's
  // own hint promise that state falls back to follow-session, so it resolves to
  // NO override here. Throwing instead answered every enhance request with 500
  // during that window — a config error for one optional preference.
  //
  // Only a COMPLETE pair pins the route; a half pair must never survive to read
  // as an override downstream (see `resolveRoute`).
  const override: { provider?: string; model?: string } = provider !== undefined && model !== undefined ? { provider, model } : {}
  const temperature = config.temperature
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < TEMPERATURE.min || temperature > TEMPERATURE.max) {
    throw new Error(`dsh-prompt-enhance: temperature 必须是 ${TEMPERATURE.min}–${TEMPERATURE.max} 之间的有限数字`)
  }
  const intInRange = (value: unknown, name: string, range: NumericRange): number => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < range.min || value > range.max) {
      throw new Error(`dsh-prompt-enhance: ${name} 必须是 ${range.min}–${range.max} 之间的整数`)
    }
    return value
  }
  return {
    enabled: config.enabled,
    provider: override.provider,
    model: override.model,
    temperature,
    // Ids are adapter-owned, so the stored string is kept as-is; a blank or
    // absent value degrades to the cheapest shipped default. An id the route
    // does not declare is rejected by the adapter with a clear error rather
    // than silently replaced.
    reasoningEffort: resolveReasoningEffort(config.reasoningEffort),
    maxOutputTokens: intInRange(config.maxOutputTokens, 'maxOutputTokens', FIELD_LIMITS.maxOutputTokens),
    maxInputChars: intInRange(config.maxInputChars, 'maxInputChars', FIELD_LIMITS.maxInputChars),
    timeoutMs: intInRange(config.timeoutMs, 'timeoutMs', FIELD_LIMITS.timeoutMs),
    systemPrompt: typeof config.systemPrompt === 'string' ? config.systemPrompt : '',
    // Tolerate absent or hand-edited values: anything but the extend literal
    // means replace, so stored sections from earlier versions keep exactly
    // the behavior they were saved under.
    strategyMode: config.strategyMode === 'extend-default' ? 'extend-default' : 'replace-default',
    shortcut: typeof config.shortcut === 'string' ? config.shortcut : '',
    maxConcurrent: intInRange(config.maxConcurrent, 'maxConcurrent', FIELD_LIMITS.maxConcurrent),
    rateLimitPerMinute: intInRange(config.rateLimitPerMinute, 'rateLimitPerMinute', FIELD_LIMITS.rateLimitPerMinute),
    streaming: typeof config.streaming === 'boolean' ? config.streaming : DEFAULT_CONFIG.streaming,
    foldAnimation: typeof config.foldAnimation === 'boolean' ? config.foldAnimation : DEFAULT_CONFIG.foldAnimation,
    autoFold: typeof config.autoFold === 'boolean' ? config.autoFold : DEFAULT_CONFIG.autoFold,
    contextAware: typeof config.contextAware === 'boolean' ? config.contextAware : DEFAULT_CONFIG.contextAware,
    contextMaxMessages: intInRange(config.contextMaxMessages, 'contextMaxMessages', FIELD_LIMITS.contextMaxMessages),
    contextMaxChars: intInRange(config.contextMaxChars, 'contextMaxChars', FIELD_LIMITS.contextMaxChars),
  }
}

/**
 * The effective system prompt. An empty override always means the built-in
 * strategy. A non-empty override follows `strategyMode`: `replace-default`
 * swaps the built-in strategy text out, while `extend-default` appends the
 * custom text after the built-in strategy. In BOTH modes the call carries
 * {@link INVARIANT_CONTRACT} — the framed draft is data, the output is the
 * rewrite alone, context is evidence — so a one-line custom strategy still
 * behaves like an enhancement instead of derailing into a conversation.
 *
 * Context rules are passed separately (not pre-merged into `builtin`) so a
 * `replace-default` strategy cannot silently drop them; they apply in every
 * mode. Tolerates an absent field (older stored sections predate the schema
 * default).
 * @param config - the resolved config.
 * @param builtin - the built-in strategy prompt.
 * @param contextRules - the context-rules block, or an empty string.
 * @returns the system prompt of the next call.
 */
export function effectiveSystemPrompt(config: Config, builtin: string, contextRules = ''): string {
  const custom = (config.systemPrompt ?? '').trim()
  const context = contextRules.trim() === '' ? '' : `\n${contextRules}`
  if (custom === '') return `${builtin}${context}`
  const strategy =
    config.strategyMode === 'extend-default' ? `${builtin}${context}\n\nOperator additions (follow them where they do not conflict with the rules above):\n${custom}` : `${custom}${context}`
  return `${strategy}\n\n${INVARIANT_CONTRACT}`
}
