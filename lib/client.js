window.__ModuleLoader__.load({
	id: "dsh-prompt-enhance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/EnhanceButton.tsx
var import_react3 = require("react");
var import_react_dom = require("react-dom");

// src/shared/validate.ts
function isInvisibleCodePoint(cp) {
  return cp >= 8203 && cp <= 8205 || cp === 65279 || cp >= 8234 && cp <= 8238 || cp >= 8294 && cp <= 8297;
}
function scanText(text) {
  let count = 0;
  let visibleNonBlank = false;
  for (const ch of text) {
    count++;
    const code = ch.codePointAt(0) ?? 0;
    if (!isInvisibleCodePoint(code) && !/\s/.test(ch)) visibleNonBlank = true;
  }
  return { count, visibleNonBlank };
}
function checkInputText(text, maxChars) {
  const { count, visibleNonBlank } = scanText(text);
  if (!visibleNonBlank) {
    return { ok: false, code: "empty" };
  }
  if (count > maxChars) {
    return { ok: false, code: "too-long", count, max: maxChars };
  }
  return { ok: true };
}

// src/shared/protocol.ts
var ENHANCE_ENDPOINT = "/dsh-prompt-enhance/enhance";
var ENHANCE_STREAM_ENDPOINT = "/dsh-prompt-enhance/enhance-stream";
var PROMPT_ENHANCE_ROW_IDS = [
  "dsh-prompt-enhance",
  "prompt-enhance",
  "web-ui-dsh-prompt-enhance",
  "web-ui-prompt-enhance"
];

// src/client/enhance-client.ts
var EnhanceClientError = class extends Error {
  constructor(detail) {
    super(detail.message);
    this.detail = detail;
  }
};
function jsonBody(body) {
  return new TextEncoder().encode(JSON.stringify(body));
}
var KNOWN_ERROR_CODES = /* @__PURE__ */ new Set([
  "rejected",
  "rate-limit",
  "concurrency-limit",
  "cooldown",
  "timeout",
  "upstream",
  "unconfigured",
  "internal",
  "effort-unsupported"
]);
function parseError(value) {
  const record = value;
  if (record !== null && typeof record === "object") {
    const code = typeof record.code === "string" && KNOWN_ERROR_CODES.has(record.code) ? record.code : "internal";
    const message = typeof record.message === "string" && record.message !== "" ? record.message : void 0;
    const params = record.params !== null && typeof record.params === "object" ? record.params : void 0;
    return { code, ...message !== void 0 ? { message } : {}, ...params !== void 0 ? { params } : {} };
  }
  return { code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\u3002" };
}
function tokenCount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
function parseUsage(value) {
  if (value === null || typeof value !== "object") return void 0;
  const record = value;
  const inputTokens = tokenCount(record.inputTokens);
  const outputTokens = tokenCount(record.outputTokens);
  if (inputTokens === void 0 || outputTokens === void 0) return void 0;
  const totalTokens = tokenCount(record.totalTokens);
  const cacheReadTokens = tokenCount(record.cacheReadTokens);
  const cacheWriteTokens = tokenCount(record.cacheWriteTokens);
  return {
    inputTokens,
    outputTokens,
    ...totalTokens === void 0 ? {} : { totalTokens },
    ...cacheReadTokens === void 0 ? {} : { cacheReadTokens },
    ...cacheWriteTokens === void 0 ? {} : { cacheWriteTokens }
  };
}
function parseResult(value) {
  const record = value;
  if (record !== null && typeof record === "object" && typeof record.text === "string" && record.text !== "" && typeof record.provider === "string" && record.provider !== "" && typeof record.model === "string" && record.model !== "" && typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)) {
    const usage = parseUsage(record.usage);
    return {
      text: record.text,
      provider: record.provider,
      model: record.model,
      elapsedMs: record.elapsedMs,
      ...usage === void 0 ? {} : { usage }
    };
  }
  throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u7ED3\u679C\u3002" });
}
async function readEnvelope(response) {
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u54CD\u5E94\u3002" });
  }
  const envelope = parsed;
  if (envelope !== null && typeof envelope === "object" && envelope.ok === true) {
    return parseResult(envelope.value);
  }
  if (envelope !== null && typeof envelope === "object" && envelope.error !== void 0) {
    throw new EnhanceClientError(parseError(envelope.error));
  }
  throw new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002` });
}
async function rejectionOf(response) {
  try {
    const parsed = await response.json();
    if (parsed !== null && typeof parsed === "object" && parsed.error !== void 0) {
      return new EnhanceClientError(parseError(parsed.error));
    }
  } catch {
  }
  return new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF08HTTP ${response.status}\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002` });
}
function takeFrames(buffer) {
  const frames = [];
  let rest = buffer;
  for (let index = rest.indexOf("\n\n"); index !== -1; index = rest.indexOf("\n\n")) {
    const raw = rest.slice(0, index);
    rest = rest.slice(index + 2);
    let event = "message";
    const data = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length > 0) frames.push({ event, data: data.join("\n") });
  }
  return { frames, rest };
}
function parseFrame(frame) {
  if (frame.event !== "delta" && frame.event !== "done" && frame.event !== "error") return void 0;
  let parsed;
  try {
    parsed = JSON.parse(frame.data);
  } catch {
    return void 0;
  }
  const record = parsed;
  if (record === null || typeof record !== "object" || record.type !== frame.event) return void 0;
  return record;
}
async function requestEnhanceStream(body, options) {
  let response;
  try {
    response = await fetch(ENHANCE_STREAM_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: jsonBody(body),
      signal: options.signal
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new EnhanceClientError({ code: "internal", message: "\u5DF2\u53D6\u6D88\u589E\u5F3A\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", message: "\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\u670D\u52A1\uFF0C\u8BF7\u786E\u8BA4 dsh web \u6B63\u5728\u8FD0\u884C\u540E\u91CD\u8BD5\u3002" });
  }
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!response.ok) throw await rejectionOf(response);
  const stream = response.body;
  if (stream === null || stream === void 0 || !contentType.includes("event-stream")) {
    void Promise.resolve().then(() => stream?.cancel()).catch(() => {
    });
    return requestEnhance(body, options.signal);
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = takeFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        const event = parseFrame(frame);
        if (event === void 0) continue;
        if (event.type === "delta") options.onDelta(event.text);
        else if (event.type === "done") return parseResult(event.value);
        else throw new EnhanceClientError(parseError(event.error));
      }
    }
  } finally {
    void Promise.resolve().then(() => reader.cancel()).catch(() => {
    });
  }
  throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u63D0\u524D\u5173\u95ED\u4E86\u589E\u5F3A\u6D41\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
}
async function requestEnhance(body, signal) {
  let response;
  try {
    response = await fetch(ENHANCE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody(body),
      signal
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new EnhanceClientError({ code: "internal", message: "\u5DF2\u53D6\u6D88\u589E\u5F3A\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", message: "\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\u670D\u52A1\uFF0C\u8BF7\u786E\u8BA4 dsh web \u6B63\u5728\u8FD0\u884C\u540E\u91CD\u8BD5\u3002" });
  }
  return readEnvelope(response);
}

// src/client/ResultPanel.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var retryable = (code) => code === "upstream" || code === "timeout" || code === "internal";
var UPSTREAM_ERROR_KEYS = {
  auth: "error.upstream.auth",
  "invalid-credential": "error.upstream.invalidCredential",
  "rate-limit": "error.upstream.rateLimit",
  quota: "error.upstream.quota",
  empty: "error.upstream.empty",
  "context-window": "error.upstream.contextWindow",
  "tool-call": "error.upstream.toolCall",
  "max-tokens": "error.upstream.maxTokens"
};
function localizedErrorMessage(t, code, params) {
  if (code === "rejected" && typeof params?.count === "number" && typeof params?.max === "number") {
    return t("error.tooLong", { count: params.count, max: params.max });
  }
  if (code === "upstream" && typeof params?.reason === "string") {
    const specific = UPSTREAM_ERROR_KEYS[params.reason];
    if (specific !== void 0) return t(specific);
  }
  switch (code) {
    case "rejected":
      return t("error.rejected");
    case "rate-limit":
      return t("error.rateLimit", params);
    case "concurrency-limit":
      return t("error.concurrencyLimit", params);
    case "cooldown":
      return t("error.cooldown", params);
    case "timeout":
      return t("error.timeout", params);
    case "unconfigured":
      return t("error.unconfigured");
    case "effort-unsupported":
      return t("error.effortUnsupported", params);
    case "upstream":
      return t("error.upstream");
    default:
      return t("error.internal");
  }
}
function fallbackCopy(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
function ResultPanel(props) {
  const { state, t, onApply, onCancel, onRetry } = props;
  const [copied, setCopied] = (0, import_react.useState)("idle");
  const panelRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.isComposing) return;
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (panel === null) return;
        const focusables = panel.querySelectorAll('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (first === void 0 || last === void 0) return;
        const active = document.activeElement;
        const atRoot = active === panel;
        if (event.shiftKey && (active === first || atRoot)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);
  const openerRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener === null || !opener.isConnected) return;
      const active = document.activeElement;
      if (active === null || active === document.body) opener.focus();
    };
  }, []);
  const copy = (0, import_react.useCallback)(() => {
    if (state.result === void 0) return;
    const text = state.result.text;
    const done = (ok) => setCopied(ok ? "ok" : "failed");
    if (navigator.clipboard !== void 0) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
      return;
    }
    done(fallbackCopy(text));
  }, [state.result]);
  const formatMs = (ms) => ms < 1e3 ? `${ms}ms` : `${(ms / 1e3).toFixed(1)}s`;
  const formatTokens = (tokens) => tokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const totalTokensOf = (usage) => usage.totalTokens ?? usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  const tokenDetail = (usage) => {
    const parts = [
      t("panel.tokens.input", { count: formatTokens(usage.inputTokens) }),
      t("panel.tokens.output", { count: formatTokens(usage.outputTokens) })
    ];
    if ((usage.cacheReadTokens ?? 0) > 0) {
      parts.push(t("panel.tokens.cacheRead", { count: formatTokens(usage.cacheReadTokens ?? 0) }));
    }
    if ((usage.cacheWriteTokens ?? 0) > 0) {
      parts.push(t("panel.tokens.cacheWrite", { count: formatTokens(usage.cacheWriteTokens ?? 0) }));
    }
    return parts.join(" \xB7 ");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-overlay", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onCancel();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "section",
    {
      ref: panelRef,
      className: "dsh-pe-panel",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": t("panel.title"),
      tabIndex: -1,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dsh-pe-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "\u2728 ",
            t("panel.title")
          ] }),
          state.phase === "result" && state.result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh-pe-meta", children: [
            t("panel.model", { provider: state.result.provider, model: state.result.model }),
            " \xB7 ",
            t("panel.elapsed", { ms: formatMs(state.result.elapsedMs) }),
            state.result.usage === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              " \xB7 ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "span",
                {
                  title: tokenDetail(state.result.usage),
                  children: t("panel.tokens", { total: formatTokens(totalTokensOf(state.result.usage)) })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsh-pe-close", "aria-label": t("panel.close"), onClick: onCancel, children: "\u2715" })
        ] }),
        state.phase === "loading" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-loading", children: state.streaming === void 0 || state.streaming === "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-spin", "aria-hidden": true }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t("panel.loading") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-hint", children: t("panel.loading.hint") })
        ] }) : (
          // Incremental view: the text already generated, replaced by the
          // normalized full body the moment the call settles.
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-pe-stream", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-pe-col-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-pe-spin small", "aria-hidden": true }),
              t("panel.streaming")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "dsh-pe-col-text", children: state.streaming })
          ] })
        ) }),
        state.phase === "error" && state.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-error", children: state.error.localized !== void 0 ? (
          // Client-side guard failures carry their own pre-localized copy.
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: state.error.localized })
        ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: localizedErrorMessage(t, state.error.code, state.error.params) }),
          state.error.message !== void 0 && state.error.message !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-error-detail", children: state.error.message })
        ] }) }),
        state.phase === "result" && state.result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-pe-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-pe-col", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-col-title", children: t("panel.original") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "dsh-pe-col-text", children: state.original })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-pe-col", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-pe-col-title", children: t("panel.enhanced") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "dsh-pe-col-text", children: state.result.text })
          ] })
        ] }),
        state.phase === "result" && state.stale && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-pe-stale", children: [
          "\u26A0 ",
          t("panel.stale.warn")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "dsh-pe-foot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-pe-grow" }),
          state.phase === "error" && retryable(state.error?.code) && onRetry !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsh-pe-btn-action plain", onClick: onRetry, children: t("panel.retry") }),
          state.phase === "result" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsh-pe-btn-action plain", onClick: copy, children: copied === "ok" ? t("panel.copied") : copied === "failed" ? t("panel.copyFailed") : t("panel.copy") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsh-pe-btn-action primary", onClick: onApply, children: t("panel.apply") })
          ] }),
          state.phase !== "result" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dsh-pe-btn-action plain", onClick: onCancel, children: state.phase === "loading" ? t("panel.cancel") : t("panel.close") })
        ] })
      ]
    }
  ) });
}

// src/client/undo-stack.ts
function totalOf(stacks) {
  let n = 0;
  for (const stack of stacks.values()) n += stack.length;
  return n;
}
function createUndoStack(maxDepth = 3, maxTotalEntries = 60) {
  const stacks = /* @__PURE__ */ new Map();
  return {
    push(sessionId, entry) {
      const stack = stacks.get(sessionId) ?? [];
      stack.push(entry);
      while (stack.length > maxDepth) stack.shift();
      stacks.delete(sessionId);
      stacks.set(sessionId, stack);
      while (totalOf(stacks) > maxTotalEntries) {
        const oldest = stacks.keys().next().value;
        if (oldest === void 0) break;
        stacks.delete(oldest);
      }
    },
    peek(sessionId) {
      const stack = stacks.get(sessionId);
      return stack === void 0 || stack.length === 0 ? void 0 : stack[stack.length - 1];
    },
    pop(sessionId) {
      const stack = stacks.get(sessionId);
      const entry = stack?.pop();
      if (stack !== void 0 && stack.length === 0) stacks.delete(sessionId);
      return entry;
    },
    clear(sessionId) {
      stacks.delete(sessionId);
    },
    depth(sessionId) {
      return stacks.get(sessionId)?.length ?? 0;
    }
  };
}

// src/client/ui-state.ts
var listeners = /* @__PURE__ */ new Set();
var panelState;
var version = 0;
function notify() {
  version++;
  for (const listener of listeners) listener();
}
var pendingDeltaText = "";
var pendingDeltaSession;
var pendingDeltaScheduled = false;
function flushPendingDelta() {
  pendingDeltaScheduled = false;
  if (pendingDeltaText === "" || pendingDeltaSession === void 0) return;
  const sessionId = pendingDeltaSession;
  const text = pendingDeltaText;
  pendingDeltaText = "";
  pendingDeltaSession = void 0;
  if (panelState === void 0 || panelState.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { ...panelState, streaming: (panelState.streaming ?? "") + text };
  notify();
}
function scheduleDeltaFlush() {
  if (pendingDeltaScheduled) return;
  pendingDeltaScheduled = true;
  queueMicrotask(flushPendingDelta);
}
var undoStore = createUndoStack(3);
function pushUndo(sessionId, entry) {
  undoStore.push(sessionId, entry);
  notify();
}
function peekUndo(sessionId) {
  return undoStore.peek(sessionId);
}
function popUndo(sessionId) {
  const entry = undoStore.pop(sessionId);
  notify();
  return entry;
}
var sessions = /* @__PURE__ */ new Map();
var lastMountedSession;
function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getVersion() {
  return version;
}
function getPanel() {
  return panelState;
}
function abortOf(state) {
  try {
    state?.abort?.();
  } catch {
  }
}
function openLoading(state) {
  abortOf(panelState);
  panelState = { ...state, phase: "loading" };
  notify();
}
function settleResult(sessionId, result) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { sessionId, phase: "result", original: panelState.original, result };
  notify();
}
function settleError(sessionId, error) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { sessionId, phase: "error", original: panelState.original, error };
  notify();
}
function appendDelta(sessionId, text) {
  if (text === "") return;
  if (panelState === void 0 || panelState.sessionId !== sessionId || panelState.phase !== "loading") return;
  pendingDeltaText += text;
  pendingDeltaSession = sessionId;
  scheduleDeltaFlush();
}
function openError(sessionId, original, error) {
  abortOf(panelState);
  panelState = { sessionId, phase: "error", original, error };
  notify();
}
function setStale(sessionId, stale) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "result" || panelState.stale === stale) return;
  panelState = { ...panelState, stale };
  notify();
}
function closePanel() {
  abortOf(panelState);
  if (panelState === void 0) return;
  panelState = void 0;
  notify();
}
function registerSession(sessionId, entry) {
  sessions.set(sessionId, entry);
  lastMountedSession = sessionId;
  notify();
  return () => {
    if (sessions.get(sessionId) === entry) sessions.delete(sessionId);
    if (lastMountedSession === sessionId) {
      const keys = [...sessions.keys()];
      lastMountedSession = keys[keys.length - 1];
    }
    if (panelState?.sessionId === sessionId) closePanel();
    undoStore.clear(sessionId);
    notify();
  };
}
function shortcutTarget() {
  const active = document.activeElement;
  if (active !== null && active instanceof Element) {
    let node = active;
    for (let depth = 0; depth < 8 && node !== null; depth++) {
      if (node === document.body || node === document.documentElement) break;
      for (const entry of sessions.values()) {
        if (entry.root !== null && (node === entry.root || node.contains(entry.root))) {
          const found = entry;
          return () => found.run();
        }
      }
      node = node.parentElement;
    }
  }
  const fallback = lastMountedSession !== void 0 ? sessions.get(lastMountedSession) : void 0;
  return fallback === void 0 ? void 0 : () => fallback.run();
}

// src/client/settings.ts
var DEFAULT_CLIENT_SETTINGS = {
  enabled: true,
  maxInputChars: 12e3,
  shortcut: "",
  streaming: true
};
var listeners2 = /* @__PURE__ */ new Set();
var current = DEFAULT_CLIENT_SETTINGS;
function setClientSettings(next) {
  current = next;
  for (const listener of listeners2) listener();
}
function getClientSettings() {
  return current;
}
function subscribeClientSettings(listener) {
  listeners2.add(listener);
  return () => {
    listeners2.delete(listener);
  };
}
function decodeClientSettings(section) {
  const record = section;
  if (record === null || typeof record !== "object") return DEFAULT_CLIENT_SETTINGS;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_CLIENT_SETTINGS.enabled,
    maxInputChars: typeof record.maxInputChars === "number" && Number.isFinite(record.maxInputChars) && record.maxInputChars > 0 ? Math.floor(record.maxInputChars) : DEFAULT_CLIENT_SETTINGS.maxInputChars,
    shortcut: typeof record.shortcut === "string" ? record.shortcut : DEFAULT_CLIENT_SETTINGS.shortcut,
    streaming: typeof record.streaming === "boolean" ? record.streaming : DEFAULT_CLIENT_SETTINGS.streaming
  };
}

// src/client/session-key.ts
var import_react2 = require("react");
var fallbackSeq = 0;
var zoneKeys = /* @__PURE__ */ new WeakMap();
function fallbackKeyOf(share) {
  if (share === void 0) return `pe:mount:${++fallbackSeq}`;
  const known = zoneKeys.get(share);
  if (known !== void 0) return known;
  const minted = `pe:zone:${++fallbackSeq}`;
  zoneKeys.set(share, minted);
  return minted;
}
function useSessionKey(maybeSessionId, share) {
  const fallback = (0, import_react2.useRef)(void 0);
  if (maybeSessionId !== void 0 && maybeSessionId !== "") return maybeSessionId;
  if (fallback.current === void 0) fallback.current = fallbackKeyOf(share);
  return fallback.current;
}
function serverSessionId(maybeSessionId) {
  return maybeSessionId !== void 0 && maybeSessionId !== "" ? maybeSessionId : void 0;
}

// src/client/EnhanceButton.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function countOf(value) {
  return Array.isArray(value) ? value.length : 0;
}
function stringOf(value) {
  return typeof value === "string" ? value : "";
}
function EnhanceButton(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const wireId = serverSessionId(sessionId);
  const draft = useInput((state) => stringOf(state.draft));
  const phase = useInput((state) => state.phase);
  const occurrenceCount = useInput((state) => countOf(state.occurrences));
  const attachmentCount = useInput((state) => {
    const record = state;
    return countOf(record.attachmentIds) + countOf(record.imageIds);
  });
  const settings = (0, import_react3.useSyncExternalStore)(subscribeClientSettings, getClientSettings);
  const panel = (0, import_react3.useSyncExternalStore)(subscribe, getPanel);
  const rootRef = (0, import_react3.useRef)(null);
  const busy = panel !== void 0 && panel.sessionId === uiKey && panel.phase === "loading";
  const anyBusy = panel !== void 0 && panel.phase === "loading";
  const otherBusy = anyBusy && !busy;
  const start = (0, import_react3.useCallback)(() => {
    if (anyBusy) return;
    if (!settings.enabled) {
      const disabled = t("error.disabled");
      openError(uiKey, draft, { code: "rejected", localized: disabled });
      return;
    }
    if (attachmentCount > 0 && draft.trim() === "") {
      const attachmentsOnly = t("error.attachmentsOnly");
      openError(uiKey, draft, { code: "rejected", localized: attachmentsOnly });
      return;
    }
    const check = checkInputText(draft, settings.maxInputChars);
    if (!check.ok) {
      const message = check.code === "empty" ? t("error.empty") : t("error.tooLong", { count: check.count, max: check.max });
      openError(uiKey, draft, { code: "rejected", localized: message });
      return;
    }
    if (occurrenceCount > 0) {
      const occurrences = t("error.occurrences");
      openError(uiKey, draft, { code: "rejected", localized: occurrences });
      return;
    }
    if (phase !== "plain") {
      const busyPhase = t("error.phase");
      openError(uiKey, draft, { code: "rejected", localized: busyPhase });
      return;
    }
    const controller = new AbortController();
    openLoading({ sessionId: uiKey, original: draft, abort: () => controller.abort() });
    const settle = (result) => settleResult(uiKey, result);
    const fail = (error) => {
      const detail = error instanceof EnhanceClientError ? error.detail : { code: "internal", message: error instanceof Error ? error.message : String(error) };
      settleError(uiKey, detail);
    };
    if (settings.streaming) {
      requestEnhanceStream({ sessionId: wireId, text: draft }, {
        signal: controller.signal,
        onDelta: (delta) => appendDelta(uiKey, delta)
      }).then(settle, fail);
      return;
    }
    requestEnhance({ sessionId: wireId, text: draft }, controller.signal).then(settle, fail);
  }, [anyBusy, draft, attachmentCount, occurrenceCount, phase, settings, uiKey, wireId, t]);
  const runRef = (0, import_react3.useRef)(start);
  (0, import_react3.useEffect)(() => {
    runRef.current = start;
  });
  (0, import_react3.useEffect)(() => {
    const entry = {
      root: rootRef.current,
      run: () => runRef.current()
    };
    return registerSession(uiKey, entry);
  }, [uiKey]);
  (0, import_react3.useEffect)(() => {
    if (panel !== void 0 && panel.sessionId === uiKey && panel.phase === "result") {
      setStale(uiKey, draft !== panel.original);
    }
  }, [draft, panel, uiKey]);
  const apply2 = (0, import_react3.useCallback)(() => {
    if (panel === void 0 || panel.phase !== "result" || panel.result === void 0) return;
    pushUndo(uiKey, { original: draft, applied: panel.result.text });
    inputActions.setDraft(panel.result.text);
    closePanel();
  }, [draft, inputActions, panel, uiKey]);
  if (!settings.enabled) return null;
  const owned = panel !== void 0 && panel.sessionId === uiKey ? panel : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        ref: rootRef,
        type: "button",
        className: `dsh-pe-btn${busy ? " is-busy" : ""}`,
        title: busy ? t("button.busy") : otherBusy ? t("button.otherBusy") : t("button.title"),
        "aria-label": otherBusy ? t("button.otherBusy") : t("button.title"),
        "aria-disabled": otherBusy || void 0,
        onClick: start,
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pe-btn-icon", "aria-hidden": true, children: busy ? "\u25CC" : "\u2728" })
      }
    ),
    owned !== void 0 && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        ResultPanel,
        {
          state: owned,
          t,
          onApply: apply2,
          onCancel: () => closePanel(),
          onRetry: owned.phase === "error" ? start : void 0
        }
      ),
      document.body
    )
  ] });
}

// src/client/UndoBar.tsx
var import_react4 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function UndoBar(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const draft = useInput((state) => {
    const value = state.draft;
    return typeof value === "string" ? value : "";
  });
  (0, import_react4.useSyncExternalStore)(subscribe, getVersion);
  const entry = peekUndo(uiKey);
  (0, import_react4.useEffect)(() => {
    if (entry !== void 0 && entry.applied !== draft) popUndo(uiKey);
  }, [draft, entry, uiKey]);
  if (entry === void 0 || entry.applied !== draft) return null;
  const undo = () => {
    inputActions.setDraft(entry.original);
    popUndo(uiKey);
  };
  const dismiss = () => {
    popUndo(uiKey);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-pe-undo", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pe-undo-check", "aria-hidden": true, children: "\u2713" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("undo.applied") }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dsh-pe-undo-link", onClick: undo, children: t("undo.undo") }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dsh-pe-undo-x", "aria-label": t("undo.dismiss"), onClick: dismiss, children: "\u2715" })
  ] });
}

// src/client/locales.ts
var zh = {
  "button.title": "\u63D0\u793A\u8BCD\u589E\u5F3A",
  "button.busy": "\u6B63\u5728\u589E\u5F3A\u2026",
  "button.otherBusy": "\u53E6\u4E00\u4E2A\u4F1A\u8BDD\u6B63\u5728\u589E\u5F3A\u4E2D\uFF1B\u8BF7\u7B49\u5B83\u5B8C\u6210\u6216\u5148\u5173\u95ED\u5176\u7ED3\u679C\u9762\u677F\u3002",
  "panel.title": "\u63D0\u793A\u8BCD\u589E\u5F3A",
  "panel.loading": "\u6B63\u5728\u589E\u5F3A\uFF0C\u7A0D\u5019\u2026",
  "panel.streaming": "\u6B63\u5728\u751F\u6210\uFF08\u8FB9\u5199\u8FB9\u663E\u793A\uFF09\u2026",
  "panel.loading.hint": "\u539F\u6587\u4FDD\u7559\u5728\u8F93\u5165\u6846\u4E2D\uFF0C\u4E0D\u4F1A\u88AB\u52A8\u4FEE\u6539\u3002",
  "panel.cancel": "\u53D6\u6D88",
  "panel.original": "\u539F\u59CB\u63D0\u793A\u8BCD",
  "panel.enhanced": "\u589E\u5F3A\u7ED3\u679C",
  "panel.apply": "\u56DE\u586B\u5230\u8F93\u5165\u6846",
  "panel.copy": "\u590D\u5236\u7ED3\u679C",
  "panel.copied": "\u5DF2\u590D\u5236",
  "panel.copyFailed": "\u590D\u5236\u5931\u8D25",
  "panel.close": "\u5173\u95ED",
  "panel.retry": "\u91CD\u8BD5",
  "panel.stale.warn": "\u8349\u7A3F\u5728\u589E\u5F3A\u671F\u95F4\u6709\u6539\u52A8\u2014\u2014\u589E\u5F3A\u7ED3\u679C\u57FA\u4E8E\u589E\u5F3A\u524D\u7684\u6587\u672C\u3002\u56DE\u586B\u5C06\u8986\u76D6\u4F60\u7684\u6700\u65B0\u7F16\u8F91(\u64A4\u9500\u53EF\u6062\u590D\u56DE\u586B\u524D\u7684\u8349\u7A3F)\u3002",
  "panel.model": "\u6A21\u578B\uFF1A{provider} / {model}",
  "panel.elapsed": "\u8017\u65F6 {ms}",
  "panel.tokens": "{total} tokens",
  "panel.tokens.input": "\u8F93\u5165 {count}",
  "panel.tokens.output": "\u8F93\u51FA {count}",
  "panel.tokens.cacheRead": "\u7F13\u5B58\u8BFB\u53D6 {count}",
  "panel.tokens.cacheWrite": "\u7F13\u5B58\u5199\u5165 {count}",
  "undo.applied": "\u5DF2\u7528\u589E\u5F3A\u7ED3\u679C\u66FF\u6362\u539F\u63D0\u793A\u8BCD",
  "undo.undo": "\u64A4\u9500",
  "undo.dismiss": "\u5173\u95ED\u63D0\u793A",
  "error.empty": "\u8F93\u5165\u6846\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u8F93\u5165\u8981\u589E\u5F3A\u7684\u63D0\u793A\u8BCD\u3002",
  "error.tooLong": "\u5185\u5BB9\u5171 {count} \u4E2A\u5B57\u7B26\uFF0C\u8D85\u8FC7 {max} \u4E2A\u5B57\u7B26\u4E0A\u9650\uFF08\u6309 Unicode \u5B57\u7B26\u6570\u7EDF\u8BA1\uFF0C\u4E0D\u662F token \u6570\uFF09\u3002\u4E3A\u907F\u514D\u6539\u53D8\u539F\u610F\u4E0D\u4F1A\u81EA\u52A8\u622A\u65AD\uFF0C\u8BF7\u7CBE\u7B80\u540E\u518D\u8BD5\u3002",
  "error.attachmentsOnly": "\u8F93\u5165\u6846\u53EA\u9644\u52A0\u4E86\u9644\u4EF6\uFF08\u56FE\u7247\u6216\u6587\u4EF6\uFF09\uFF0C\u8BF7\u8865\u5145\u8981\u589E\u5F3A\u7684\u6587\u672C\u3002",
  "error.occurrences": "\u8F93\u5165\u5185\u5BB9\u5305\u542B\u547D\u4EE4\u6216\u6587\u4EF6\u5F15\u7528\uFF0C\u6682\u4E0D\u652F\u6301\u589E\u5F3A\uFF1B\u8BF7\u5148\u79FB\u9664\u540E\u518D\u8BD5\u3002",
  "error.phase": "\u5F53\u524D\u8F93\u5165\u6B63\u88AB\u5360\u7528\uFF08\u63D0\u4EA4\u4E2D\uFF09\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
  "error.disabled": "\u63D0\u793A\u8BCD\u589E\u5F3A\u5DF2\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5173\u95ED\u3002",
  "error.rejected": "\u589E\u5F3A\u8BF7\u6C42\u88AB\u62D2\u7EDD\u3002",
  "error.timeout": "\u589E\u5F3A\u8D85\u65F6\uFF08{seconds} \u79D2\uFF09\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.unconfigured": "\u5C1A\u672A\u786E\u5B9A\u589E\u5F3A\u7528\u7684\u6A21\u578B\uFF1A\u8BF7\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u6210\u5BF9\u586B\u5199 provider/model\uFF0C\u6216\u5148\u5728\u5F53\u524D\u4F1A\u8BDD\u53D1\u9001\u4E00\u6761\u6D88\u606F\uFF08\u5C06\u8DDF\u968F\u4F1A\u8BDD\u6A21\u578B\uFF09\u3002",
  "error.effortUnsupported": "\u8BE5\u6A21\u578B\u4E0D\u652F\u6301\u6240\u9009\u63A8\u7406\u6863\u4F4D\u300C{effort}\u300D\uFF0C\u8BF7\u6539\u9009\u5176\u5B83\u6863\u4F4D\uFF0C\u6216\u6539\u7528\u300C\u8DDF\u968F\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u300D\u3002",
  "error.upstream": "\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.internal": "\u589E\u5F3A\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.rateLimit": "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF1A\u6BCF\u5206\u949F\u6700\u591A {limit} \u6B21\u589E\u5F3A\uFF0C\u8BF7\u5728 {retryAfterSeconds} \u79D2\u540E\u518D\u8BD5\u3002",
  "error.concurrencyLimit": "\u5DF2\u6709 {max} \u4E2A\u589E\u5F3A\u6B63\u5728\u8FDB\u884C\uFF0C\u8BF7\u7B49\u5176\u4E2D\u4E00\u4E2A\u5B8C\u6210\u540E\u518D\u8BD5\u3002",
  "error.cooldown": "\u8FDE\u7EED {failures} \u6B21\u589E\u5F3A\u5931\u8D25\uFF0C\u5DF2\u6682\u505C\u8C03\u7528\u4EE5\u514D\u6301\u7EED\u51B2\u51FB\u6A21\u578B\u670D\u52A1\uFF1B\u8BF7 {retryAfterSeconds} \u79D2\u540E\u91CD\u8BD5\uFF0C\u6216\u5148\u68C0\u67E5\u8BBE\u7F6E\u91CC\u7684\u6A21\u578B\u914D\u7F6E\u3002",
  "error.upstream.auth": "\u9274\u6743\u5931\u8D25\uFF1A\u8BF7\u68C0\u67E5\u8BE5 provider \u7684 API Key \u914D\u7F6E\u3002",
  "error.upstream.invalidCredential": "\u9274\u6743\u5931\u8D25\uFF1A\u5B58\u50A8\u7684 API Key \u4E0D\u53EF\u7528\uFF0C\u8BF7\u4FEE\u6B63\u540E\u91CD\u8BD5\u3002",
  "error.upstream.rateLimit": "\u6A21\u578B\u670D\u52A1\u9650\u6D41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "error.upstream.quota": "\u6A21\u578B\u670D\u52A1\u914D\u989D/\u4F59\u989D\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u8D26\u6237\u3002",
  "error.upstream.empty": "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "error.upstream.contextWindow": "\u8F93\u5165\u8D85\u51FA\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF0C\u8BF7\u7CBE\u7B80\u539F\u6587\u6216\u66F4\u6362\u6A21\u578B\u3002",
  "error.upstream.toolCall": "\u6A21\u578B\u8BF7\u6C42\u4E86\u5DE5\u5177\u8C03\u7528\uFF0C\u63D0\u793A\u8BCD\u589E\u5F3A\u53EA\u9700\u8981\u7EAF\u6587\u672C\uFF1B\u8BF7\u66F4\u6362\u6A21\u578B\u540E\u91CD\u8BD5\u3002",
  "error.upstream.maxTokens": "\u91CD\u5199\u7ED3\u679C\u8FBE\u5230\u8F93\u51FA\u4E0A\u9650\uFF08maxOutputTokens\uFF09\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u8C03\u5927\u4E0A\u9650\u6216\u7CBE\u7B80\u539F\u6587\u540E\u91CD\u8BD5\u3002",
  "settings.summary": "\u6A21\u578B\u3001\u4E0A\u4E0B\u6587\u4E0E\u8D44\u6E90\u9650\u5236",
  "settings.title": "\u63D0\u793A\u8BCD\u589E\u5F3A",
  "settings.description": "\u628A\u8F93\u5165\u6846\u8349\u7A3F\u6539\u5199\u4E3A\u7ED3\u6784\u5316\u63D0\u793A\u8BCD\uFF1A\u89D2\u8272\u4E0E\u76EE\u6807\u3001\u53EF\u6267\u884C\u6B65\u9AA4\u3001\u8F93\u51FA\u683C\u5F0F\u3001\u9A8C\u6536\u6807\u51C6\u3001\u8FB9\u754C\u6761\u4EF6\u3002\u539F\u6587\u4FDD\u7559\uFF0C\u5931\u8D25\u4E0D\u6539\u8349\u7A3F\uFF1B\u4FDD\u5B58\u540E\u4E0B\u4E00\u6B21\u8C03\u7528\u5373\u751F\u6548\u3002",
  "settings.save": "\u4FDD\u5B58",
  "settings.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "settings.saveFailed": "\u672C\u90E8\u7F72\u6CA1\u6709\u63A5\u53D7\u8FD9\u4E9B\u503C\uFF0C\u5DF2\u4FDD\u7559\u4F9B\u4F60\u4FEE\u6539\u3002",
  "settings.readOnly": "\u672C\u90E8\u7F72\u7684\u8BBE\u7F6E\u4E3A\u53EA\u8BFB\u3002",
  "settings.unavailable": "\u8BE5\u63D2\u4EF6\u5F53\u524D\u672A\u52A0\u8F7D\uFF0C\u6682\u65F6\u65E0\u6CD5\u914D\u7F6E\u3002",
  "settings.reset": "\u6062\u590D\u9ED8\u8BA4",
  "settings.invalidNumber": "\u8BF7\u586B\u6570\u5B57\uFF1B\u7559\u7A7A\u8868\u793A\u4F7F\u7528\u9ED8\u8BA4\u503C\u3002",
  "settings.disconnected": "\u8868\u5355\u6CA1\u6709\u63A5\u901A\uFF1A\u5BBF\u4E3B\u6CA1\u6709\u5411\u8FD9\u4E2A\u9875\u9762\u6CE8\u5165\u8868\u5355\u72B6\u6001\u3002\u63D2\u4EF6\u4ECD\u6309\u7EC4\u5408\u914D\u7F6E\u5DE5\u4F5C\u3002",
  "settings.row.enabled.label": "\u603B\u5F00\u5173",
  "settings.row.enabled.hint": "\u5173\u95ED\u540E\u9690\u85CF\u8F93\u5165\u6846\u7684\u589E\u5F3A\u6309\u94AE\uFF0C\u547D\u4EE4\u4E0E\u5FEB\u6377\u952E\u4E00\u5E76\u505C\u7528\u3002",
  "settings.row.contextAware.label": "\u4E0A\u4E0B\u6587\u611F\u77E5",
  "settings.row.contextAware.hint": "\u8BFB\u53D6\u5F53\u524D\u4F1A\u8BDD\u6700\u8FD1\u51E0\u8F6E\u5BF9\u8BDD\u6765\u6D88\u89E3\u6307\u4EE3\u3001\u8865\u5168\u7701\u7565\uFF1B\u65E0\u5386\u53F2\u65F6\u56DE\u9000\u4E3A\u5355\u6761\u589E\u5F3A\u3002",
  "settings.row.streaming.label": "\u589E\u91CF\u5C55\u793A",
  "settings.row.streaming.hint": "\u6A21\u578B\u8FB9\u5199\u8FB9\u5728\u9762\u677F\u663E\u793A\uFF1B\u4EC5\u5F71\u54CD\u663E\u793A\u8282\u594F\uFF0C\u6700\u7EC8\u5199\u5165\u7684\u6587\u672C\u4E0D\u53D8\u3002",
  "settings.row.provider.label": "\u6A21\u578B\u670D\u52A1\u65B9",
  "settings.row.provider.hint": "\u4ECE DSH \u5DF2\u6CE8\u518C\u7684 LLM provider \u4E2D\u9009\u62E9\uFF1B\u7559\u7A7A\u8DDF\u968F\u5F53\u524D\u4F1A\u8BDD\u7684\u6A21\u578B\u3002",
  "settings.row.model.label": "\u6A21\u578B ID",
  "settings.row.model.hint": "\u4ECE\u8BE5 provider \u58F0\u660E\u7684\u6A21\u578B\u4E2D\u9009\u62E9\uFF0C\u6216\u9009\u300C\u81EA\u5B9A\u4E49\u2026\u300D\u624B\u586B\u6A21\u578B ID\uFF1B\u7559\u7A7A\u8DDF\u968F\u4F1A\u8BDD\u3002",
  "settings.routing.followSession": "\u8DDF\u968F\u4F1A\u8BDD\u6A21\u578B\uFF08\u4E0D\u6307\u5B9A\uFF09",
  "settings.routing.groupRegistered": "\u5DF2\u6CE8\u518C",
  "settings.routing.groupDormant": "\u672A\u914D\u7F6E\uFF08\u9700\u5148\u5728\u6A21\u578B\u670D\u52A1\u4E2D\u914D\u7F6E\uFF09",
  "settings.routing.selectModel": "\u8BF7\u9009\u62E9\u6A21\u578B",
  "settings.routing.unconfiguredSuffix": "\uFF08\u672A\u914D\u7F6E\uFF09",
  "settings.routing.unconfiguredTitle": "\u9700\u5148\u5728 DSH \u6A21\u578B\u670D\u52A1\u4E2D\u914D\u7F6E\u8BE5 provider",
  "settings.routing.currentProvider": "\u5F53\u524D\u503C\uFF1A{value}\uFF08\u672A\u6CE8\u518C\uFF09",
  "settings.routing.currentModel": "\u5F53\u524D\u503C\uFF1A{value}\uFF08\u4E0D\u5728\u6A21\u578B\u5217\u8868\uFF09",
  "settings.routing.providersLoading": "\u6B63\u5728\u8BFB\u53D6\u5DF2\u6CE8\u518C\u7684 provider\u2026",
  "settings.routing.providersFailed": "\u65E0\u6CD5\u8BFB\u53D6\u5DF2\u6CE8\u518C\u7684 provider\uFF0C\u8BF7\u68C0\u67E5 DSH \u7684\u6A21\u578B\u670D\u52A1\u914D\u7F6E\u3002",
  "settings.routing.providerMissing": "\u5F53\u524D provider\u300C{value}\u300D\u4E0D\u5728\u5DF2\u6CE8\u518C\u5217\u8868\u4E2D\uFF1B\u589E\u5F3A\u8C03\u7528\u4F1A\u5931\u8D25\uFF0C\u8BF7\u5148\u5728 DSH \u6A21\u578B\u670D\u52A1\u4E2D\u914D\u7F6E\u3002",
  "settings.routing.providerUnconfigured": "provider\u300C{name}\u300D\u5C1A\u672A\u914D\u7F6E\uFF0C\u8BF7\u5148\u5728 DSH \u6A21\u578B\u670D\u52A1\u4E2D\u586B\u5199\u51ED\u636E\u540E\u518D\u9009\u62E9\u3002",
  "settings.routing.modelsLoading": "\u6B63\u5728\u8BFB\u53D6\u8BE5 provider \u7684\u6A21\u578B\u2026",
  "settings.routing.modelsFailed": "\u8BE5 provider \u672A\u63D0\u4F9B\u6A21\u578B\u5217\u8868\uFF0C\u53EF\u6539\u7528\u300C\u81EA\u5B9A\u4E49\u2026\u300D\u586B\u5199\u6A21\u578B ID\u3002",
  "settings.routing.custom": "\u81EA\u5B9A\u4E49\u2026",
  "settings.routing.customPlaceholder": "\u8F93\u5165\u6A21\u578B ID",
  "settings.routing.pickFromList": "\u4ECE\u5217\u8868\u9009\u62E9",
  "settings.routing.pairIncomplete": "provider \u4E0E model \u5FC5\u987B\u6210\u5BF9\u586B\u5199\uFF1B\u53EA\u586B\u4E00\u4E2A\u65F6\u4FDD\u5B58\u540E\u4F1A\u6309\u300C\u8DDF\u968F\u4F1A\u8BDD\u300D\u5904\u7406\u3002",
  "settings.routing.routeUnavailable": "\u8BE5 provider/model \u5F53\u524D\u4E0D\u53EF\u7528\uFF1B\u53EF\u4EE5\u4FDD\u5B58\uFF0C\u4F46\u589E\u5F3A\u8C03\u7528\u53EF\u80FD\u5931\u8D25\u3002\u8BF7\u786E\u8BA4\u6A21\u578B\u670D\u52A1\u5DF2\u914D\u7F6E\u4E14\u6A21\u578B ID \u6B63\u786E\u3002",
  "settings.routing.retry": "\u91CD\u8BD5",
  "settings.row.temperature.label": "\u6E29\u5EA6",
  "settings.row.temperature.hint": "\u91C7\u6837\u6E29\u5EA6\uFF0C\u8D8A\u4F4E\u8D8A\u5FE0\u5B9E\u539F\u6587\uFF1B\u9ED8\u8BA4 0.3\u3002",
  "settings.row.reasoningEffort.label": "\u63A8\u7406\u9884\u7B97",
  "settings.row.reasoningEffort.hint": "\u6863\u4F4D\u9009\u9879\u6765\u81EA\u5F53\u524D provider/model \u7684\u58F0\u660E\uFF1B\u81EA\u5B9A\u4E49\u6A21\u578B\u65F6\u6309\u9700\u8BFB\u53D6\u3002\u8DDF\u968F\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u8868\u793A\u4E0D\u4F20\u8BE5\u5B57\u6BB5\u3002",
  "settings.row.maxOutputTokens.label": "\u8F93\u51FA token \u4E0A\u9650",
  "settings.row.maxOutputTokens.hint": "\u5355\u6B21\u589E\u5F3A\u7684\u8F93\u51FA\u9884\u7B97\uFF1B\u9ED8\u8BA4 8192\u3002",
  "settings.row.maxInputChars.label": "\u8F93\u5165\u5B57\u7B26\u4E0A\u9650",
  "settings.row.maxInputChars.hint": "\u8D85\u51FA\u76F4\u63A5\u62D2\u7EDD\u3001\u4E0D\u622A\u65AD\uFF1B\u9ED8\u8BA4 12000\u3002",
  "settings.row.timeoutMs.label": "\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  "settings.row.timeoutMs.hint": "\u5355\u6B21\u589E\u5F3A\u7684\u7AEF\u5230\u7AEF\u8D85\u65F6\uFF1B\u9ED8\u8BA4 60000\u3002",
  "settings.row.strategyMode.label": "\u63D0\u793A\u8BCD\u7EC4\u5408\u65B9\u5F0F",
  "settings.row.strategyMode.hint": "\u81EA\u5B9A\u4E49\u7CFB\u7EDF\u63D0\u793A\u8BCD\u975E\u7A7A\u65F6\uFF1A\u6574\u4F53\u66FF\u6362\u5185\u7F6E\u7B56\u7565\uFF08\u4ECD\u4FDD\u7559\u6700\u5C0F\u8F93\u51FA\u5951\u7EA6\uFF09\uFF0C\u6216\u8FFD\u52A0\u5728\u5185\u7F6E\u7B56\u7565\u4E4B\u540E\uFF08\u5185\u7F6E\u89C4\u5219\u7EE7\u7EED\u751F\u6548\uFF09\u3002",
  "settings.row.systemPrompt.label": "\u81EA\u5B9A\u4E49\u7CFB\u7EDF\u63D0\u793A\u8BCD",
  "settings.row.systemPrompt.hint": "\u7559\u7A7A\u4F7F\u7528\u5185\u7F6E\u589E\u5F3A\u7B56\u7565\u3002",
  "settings.row.systemPrompt.placeholder": "\u5982\uFF1A\u628A\u7528\u6237\u7684\u4E2D\u6587\u6587\u5B57\u7FFB\u8BD1\u6210\u82F1\u6587\u3002",
  "settings.row.contextMaxMessages.label": "\u4E0A\u4E0B\u6587\u6D88\u606F\u6761\u6570",
  "settings.row.contextMaxMessages.hint": "\u6700\u591A\u53C2\u8003\u6700\u8FD1\u591A\u5C11\u8F6E\u5BF9\u8BDD\uFF1B0 \u8868\u793A\u4E0D\u53C2\u8003\uFF1B\u9ED8\u8BA4 8\u3002",
  "settings.row.contextMaxChars.label": "\u4E0A\u4E0B\u6587\u5B57\u7B26\u4E0A\u9650",
  "settings.row.contextMaxChars.hint": "\u5386\u53F2\u7247\u6BB5\u7684\u5B57\u7B26\u9884\u7B97\uFF1B0 \u8868\u793A\u4E0D\u53C2\u8003\uFF1B\u9ED8\u8BA4 4000\u3002",
  "settings.row.maxConcurrent.label": "\u5E76\u53D1\u4E0A\u9650",
  "settings.row.maxConcurrent.hint": "\u540C\u65F6\u8FDB\u884C\u7684\u589E\u5F3A\u6570\uFF0C\u8D85\u51FA\u8FD4\u56DE 429\uFF1B\u9ED8\u8BA4 2\u3002",
  "settings.row.rateLimitPerMinute.label": "\u6BCF\u5206\u949F\u8C03\u7528\u4E0A\u9650",
  "settings.row.rateLimitPerMinute.hint": "\u6BCF\u5206\u949F\u6210\u529F\u8C03\u7528\u6570\uFF0C\u8D85\u51FA\u8FD4\u56DE 429\uFF1B\u9ED8\u8BA4 10\u3002",
  "settings.row.shortcut.label": "\u5FEB\u6377\u952E",
  "settings.row.shortcut.hint": "\u9ED8\u8BA4\u7559\u7A7A\uFF08\u7981\u7528\uFF09\uFF1B\u586B\u5199\u540E\u751F\u6548\uFF0C\u5982 ctrl+alt+shift+e\uFF08\u987B\u5305\u542B ctrl/alt/meta \u4E2D\u81F3\u5C11\u4E00\u4E2A\u4FEE\u9970\u952E\uFF09\u3002",
  "settings.row.shortcut.placeholder": "\u5982 ctrl+alt+shift+e",
  "settings.strategy.replace": "\u66FF\u6362\u5185\u7F6E\u7B56\u7565",
  "settings.strategy.extend": "\u8FFD\u52A0\u5728\u5185\u7F6E\u7B56\u7565\u540E",
  "settings.reasoning.inherit": "\u8DDF\u968F\u63D0\u4F9B\u65B9\u9ED8\u8BA4",
  "settings.reasoning.loading": "\u6B63\u5728\u8BFB\u53D6\u8BE5\u6A21\u578B\u7684\u6863\u4F4D\u2026",
  "settings.reasoning.unavailable": "\u65E0\u6CD5\u8BFB\u53D6\u8BE5\u6A21\u578B\u7684\u6863\u4F4D\uFF0C\u4EC5\u53EF\u8DDF\u968F\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u3002",
  "settings.reasoning.unsupported": "\u5F53\u524D\u503C\u300C{effort}\u300D\u4E0D\u5728\u8BE5\u6A21\u578B\u652F\u6301\u7684\u6863\u4F4D\u4E2D\u3002",
  "settings.reasoning.refresh": "\u91CD\u65B0\u83B7\u53D6\u6863\u4F4D\u4FE1\u606F",
  "settings.reasoning.refreshing": "\u6B63\u5728\u83B7\u53D6\u6863\u4F4D\u4FE1\u606F\u2026",
  "settings.reasoning.refreshOk": "\u6863\u4F4D\u4FE1\u606F\u5DF2\u66F4\u65B0",
  "settings.reasoning.refreshFailed": "\u83B7\u53D6\u6863\u4F4D\u4FE1\u606F\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
};
var en = {
  "button.title": "Enhance prompt",
  "button.busy": "Enhancing\u2026",
  "button.otherBusy": "Another session is enhancing right now \u2014 wait for it, or close its result panel first.",
  "panel.title": "Prompt Enhance",
  "panel.loading": "Enhancing, please wait\u2026",
  "panel.streaming": "Generating (shown as it is written)\u2026",
  "panel.loading.hint": "Your draft stays untouched until you apply the result.",
  "panel.cancel": "Cancel",
  "panel.original": "Original prompt",
  "panel.enhanced": "Enhanced result",
  "panel.apply": "Fill into input box",
  "panel.copy": "Copy result",
  "panel.copied": "Copied",
  "panel.copyFailed": "Copy failed",
  "panel.close": "Close",
  "panel.retry": "Retry",
  "panel.stale.warn": "The draft changed while enhancing \u2014 the result is based on the pre-enhance text. Applying will overwrite your latest edits (undo restores the draft as it was before applying).",
  "panel.model": "Model: {provider} / {model}",
  "panel.elapsed": "{ms} elapsed",
  "panel.tokens": "{total} tokens",
  "panel.tokens.input": "Input {count}",
  "panel.tokens.output": "Output {count}",
  "panel.tokens.cacheRead": "Cache read {count}",
  "panel.tokens.cacheWrite": "Cache write {count}",
  "undo.applied": "Original prompt replaced by the enhanced version",
  "undo.undo": "Undo",
  "undo.dismiss": "Dismiss",
  "error.empty": "The input box is empty \u2014 type a prompt to enhance first.",
  "error.tooLong": "The draft is {count} characters, above the {max} cap (Unicode characters, not tokens). It is never auto-truncated (that would change your meaning) \u2014 please shorten it.",
  "error.attachmentsOnly": "The composer only has attachments; add the text you want enhanced.",
  "error.occurrences": "The draft contains commands or file references, which are not supported yet \u2014 remove them first.",
  "error.phase": "The input box is busy (submitting) \u2014 try again in a moment.",
  "error.disabled": "Prompt enhance is disabled in the plugin settings.",
  "error.rejected": "The enhance request was rejected.",
  "error.timeout": "The enhancement timed out ({seconds}s). Retry; your draft is untouched.",
  "error.unconfigured": "No model resolved for the enhancement: pair provider/model in the plugin settings, or send a message in the current session first (the enhancement will follow the session model).",
  "error.effortUnsupported": 'This model does not support the selected reasoning effort "{effort}". Choose another tier, or use "follow provider default".',
  "error.upstream": "The model provider returned an error. Retry; your draft is untouched.",
  "error.internal": "Enhancement failed. Retry; your draft is untouched.",
  "error.rateLimit": "Too many requests \u2014 at most {limit} enhancements per minute; retry in {retryAfterSeconds} seconds.",
  "error.concurrencyLimit": "{max} enhancements are already running \u2014 wait for one to finish, then retry.",
  "error.cooldown": "{failures} enhancements failed in a row; calls are paused to stop hammering the model service. Retry in {retryAfterSeconds}s, or check the model settings first.",
  "error.upstream.auth": "Authentication failed \u2014 check the API key configured for this provider.",
  "error.upstream.invalidCredential": "Authentication failed \u2014 the stored API key is invalid; fix it and retry.",
  "error.upstream.rateLimit": "The model provider is rate-limiting; retry later.",
  "error.upstream.quota": "The model provider reports a quota/balance issue \u2014 check your account.",
  "error.upstream.empty": "The model returned an empty response; retry.",
  "error.upstream.contextWindow": "The input exceeds the model context window \u2014 shorten it or switch models.",
  "error.upstream.toolCall": "The model requested tool calls, but prompt enhance needs plain text \u2014 switch models and retry.",
  "error.upstream.maxTokens": "The rewrite hit the output cap (maxOutputTokens) \u2014 raise it in settings or shorten the draft.",
  "settings.summary": "Model, context, and resource limits",
  "settings.title": "Prompt enhance",
  "settings.description": "Turns a composer draft into a structured prompt: role and goal, executable steps, output format, acceptance criteria, edge cases. The draft is preserved, failures never touch it, and saved values apply to the next call.",
  "settings.save": "Save",
  "settings.saving": "Saving\u2026",
  "settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
  "settings.readOnly": "This deployment stores settings read-only.",
  "settings.unavailable": "This plugin is not loaded, so it cannot be configured right now.",
  "settings.reset": "Reset to default",
  "settings.invalidNumber": "Enter a number, or leave blank to use the default.",
  "settings.disconnected": "This page has no form: the host did not project its form store. The plugin keeps working with its composition config.",
  "settings.row.enabled.label": "Master switch",
  "settings.row.enabled.hint": "Off hides the composer button and disables the command and the shortcut.",
  "settings.row.contextAware.label": "Context aware",
  "settings.row.contextAware.hint": "Reads the recent turns of the current conversation; falls back to a single-prompt rewrite when there is no history.",
  "settings.row.streaming.label": "Streaming display",
  "settings.row.streaming.hint": "Shows the rewrite while it is being written. Display only: the applied text is unchanged.",
  "settings.row.provider.label": "Model provider",
  "settings.row.provider.hint": "Pick a registered DSH LLM provider; leave empty to follow the current session\u2019s model.",
  "settings.row.model.label": "Model id",
  "settings.row.model.hint": "Pick one of the provider\u2019s models, or choose \u201CCustom\u2026\u201D to type an id; leave empty to follow the session.",
  "settings.routing.followSession": "Follow session model (none)",
  "settings.routing.groupRegistered": "Registered",
  "settings.routing.groupDormant": "Not configured (set up model services first)",
  "settings.routing.selectModel": "Select a model",
  "settings.routing.unconfiguredSuffix": " (not configured)",
  "settings.routing.unconfiguredTitle": "Configure this provider in DSH model services first",
  "settings.routing.currentProvider": "Current value: {value} (not registered)",
  "settings.routing.currentModel": "Current value: {value} (not in the model list)",
  "settings.routing.providersLoading": "Reading registered providers\u2026",
  "settings.routing.providersFailed": "Could not read registered providers; check the DSH model services configuration.",
  "settings.routing.providerMissing": "Provider \u201C{value}\u201D is not registered; enhancement calls will fail. Configure it in DSH model services first.",
  "settings.routing.providerUnconfigured": "Provider \u201C{name}\u201D is not configured yet; add its credentials in DSH model services before selecting it.",
  "settings.routing.modelsLoading": "Reading this provider\u2019s models\u2026",
  "settings.routing.modelsFailed": "This provider advertises no model list; use \u201CCustom\u2026\u201D to type a model id.",
  "settings.routing.custom": "Custom\u2026",
  "settings.routing.customPlaceholder": "Type a model id",
  "settings.routing.pickFromList": "Pick from list",
  "settings.routing.pairIncomplete": "provider and model must be set together; with only one filled, the save follows the session instead.",
  "settings.routing.routeUnavailable": "This provider/model is currently unavailable; you can still save, but enhancement calls may fail. Check that model services are configured and the model id is correct.",
  "settings.routing.retry": "Retry",
  "settings.row.temperature.label": "Temperature",
  "settings.row.temperature.hint": "Sampling temperature; lower stays closer to the original. Default 0.3.",
  "settings.row.reasoningEffort.label": "Reasoning effort",
  "settings.row.reasoningEffort.hint": "Tier choices come from what the configured provider/model declares; custom models are read on demand. Follow provider default omits the field.",
  "settings.row.maxOutputTokens.label": "Output token budget",
  "settings.row.maxOutputTokens.hint": "Output budget for one enhancement call. Default 8192.",
  "settings.row.maxInputChars.label": "Input character cap",
  "settings.row.maxInputChars.hint": "Over-limit drafts are rejected, never truncated. Default 12000.",
  "settings.row.timeoutMs.label": "Timeout (ms)",
  "settings.row.timeoutMs.hint": "End-to-end timeout of one enhancement call. Default 60000.",
  "settings.row.strategyMode.label": "Prompt composition",
  "settings.row.strategyMode.hint": "How a non-empty custom system prompt combines with the built-in strategy: replace it (the minimal output contract still applies), or append after it (the built-in rules still apply).",
  "settings.row.systemPrompt.label": "Custom system prompt",
  "settings.row.systemPrompt.hint": "Leave empty to use the built-in enhancement strategy.",
  "settings.row.systemPrompt.placeholder": "e.g. translate the user text from Chinese into English.",
  "settings.row.contextMaxMessages.label": "Context turns",
  "settings.row.contextMaxMessages.hint": "How many recent turns may ground the rewrite; 0 disables context. Default 8.",
  "settings.row.contextMaxChars.label": "Context characters",
  "settings.row.contextMaxChars.hint": "Character budget for the context snippet; 0 disables it. Default 4000.",
  "settings.row.maxConcurrent.label": "Concurrency cap",
  "settings.row.maxConcurrent.hint": "Concurrent enhancements per host process; excess returns 429. Default 2.",
  "settings.row.rateLimitPerMinute.label": "Calls per minute",
  "settings.row.rateLimitPerMinute.hint": "Successful calls per minute per host process; excess returns 429. Default 10.",
  "settings.row.shortcut.label": "Shortcut",
  "settings.row.shortcut.hint": "Empty by default (disabled); set it to enable, e.g. ctrl+alt+shift+e (needs at least one of ctrl/alt/meta).",
  "settings.row.shortcut.placeholder": "e.g. ctrl+alt+shift+e",
  "settings.strategy.replace": "Replace the built-in strategy",
  "settings.strategy.extend": "Append after the built-in strategy",
  "settings.reasoning.inherit": "Provider default",
  "settings.reasoning.loading": "Reading this model\u2019s tiers\u2026",
  "settings.reasoning.unavailable": "Could not read this model\u2019s tiers; only \u201Cfollow provider default\u201D is available.",
  "settings.reasoning.unsupported": "The current value \u201C{effort}\u201D is not one of this model\u2019s tiers.",
  "settings.reasoning.refresh": "Reload tier info",
  "settings.reasoning.refreshing": "Loading tier info\u2026",
  "settings.reasoning.refreshOk": "Tier info updated",
  "settings.reasoning.refreshFailed": "Could not load tier info \u2014 please retry."
};
var dictionaries = { zh, en };
var NS = "dsh-prompt-enhance";

// src/client/styles.ts
var STYLE_ID = "dsh-prompt-enhance-styles";
var CSS = `
.dsh-pe-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--dsh-pe-z-index, 1000);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.32);
  padding: 24px 16px;
}
.dsh-pe-panel {
  --pe-bg: #1f2127;
  --pe-fg: #e6e8ee;
  --pe-fg-dim: rgba(230, 232, 238, 0.55);
  --pe-border: rgba(127, 127, 127, 0.35);
  --pe-separator: rgba(127, 127, 127, 0.25);
  --pe-hover: rgba(127, 127, 127, 0.18);
  --pe-danger: #ffb4a8;
  --pe-warn-fg: #e8c07d;
  --pe-warn-border: rgba(230, 158, 60, 0.35);
  --pe-warn-bg: rgba(230, 158, 60, 0.12);
  display: flex;
  flex-direction: column;
  width: min(880px, 100%);
  max-height: min(70vh, 640px);
  border-radius: 12px;
  border: 1px solid var(--pe-border);
  background: var(--pe-bg);
  color: var(--pe-fg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  outline: none;
}
@media (prefers-color-scheme: light) {
  .dsh-pe-panel {
    --pe-bg: #ffffff;
    --pe-fg: #1c1e24;
    --pe-fg-dim: rgba(28, 30, 36, 0.55);
    --pe-border: rgba(0, 0, 0, 0.18);
    --pe-separator: rgba(0, 0, 0, 0.12);
    --pe-hover: rgba(0, 0, 0, 0.08);
    --pe-danger: #a63a2e;
    --pe-warn-fg: #8a5a00;
    --pe-warn-border: rgba(176, 122, 0, 0.4);
    --pe-warn-bg: rgba(230, 158, 60, 0.15);
  }
}
.dsh-pe-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--pe-separator);
  font-size: 13px;
  font-weight: 600;
}
.dsh-pe-head .dsh-pe-meta { margin-left: auto; font-weight: 400; font-size: 11px; opacity: 0.6; }
.dsh-pe-close {
  border: none; background: transparent; color: inherit; opacity: 0.6;
  font-size: 15px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
}
.dsh-pe-close:hover { opacity: 1; background: var(--pe-hover); }
.dsh-pe-body { display: flex; flex: 1; min-height: 0; }
.dsh-pe-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.dsh-pe-col + .dsh-pe-col { border-left: 1px solid var(--pe-separator); }
.dsh-pe-col-title {
  padding: 8px 14px 6px;
  font-size: 11px;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.dsh-pe-col-text {
  flex: 1;
  margin: 0;
  padding: 0 14px 12px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
}
.dsh-pe-error {
  padding: 20px 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--pe-danger);
  white-space: pre-wrap;
}
.dsh-pe-error .dsh-pe-error-detail {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.75;
  color: inherit;
}
.dsh-pe-loading {
  display: flex; flex-direction: column; gap: 8px;
  align-items: center; justify-content: center;
  flex: 1; padding: 28px 16px; font-size: 13px;
}
.dsh-pe-loading .dsh-pe-hint { font-size: 11px; opacity: 0.55; }
/* Incremental view: the streamed text takes the whole body, left-aligned. */
.dsh-pe-stream {
  display: flex; flex-direction: column;
  flex: 1; min-height: 0; width: 100%;
}
.dsh-pe-stream .dsh-pe-col-title {
  display: flex; align-items: center; gap: 6px;
  padding-left: 0;
}
.dsh-pe-spin.small { width: 11px; height: 11px; border-width: 1px; }
.dsh-pe-spin {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--pe-separator); border-top-color: #6ea8ff;
  animation: dsh-pe-spin 0.9s linear infinite;
}
.dsh-pe-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--pe-separator);
}
.dsh-pe-foot .dsh-pe-grow { flex: 1; }
.dsh-pe-btn-action {
  border: none; border-radius: 6px; padding: 6px 14px;
  font-size: 12px; cursor: pointer; line-height: 1;
}
.dsh-pe-btn-action.primary { background: #3f76e1; color: #fff; }
.dsh-pe-btn-action.primary:hover { background: #4d82ec; }
.dsh-pe-btn-action.plain { background: var(--pe-hover); color: inherit; }
.dsh-pe-btn-action.plain:hover { background: rgba(127, 127, 127, 0.3); }

.dsh-pe-stale {
  padding: 8px 14px;
  font-size: 12px;
  line-height: 1.5;
  border-top: 1px solid var(--pe-warn-border);
  background: var(--pe-warn-bg);
  color: var(--pe-warn-fg);
}

.dsh-pe-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}
.dsh-pe-btn:hover:not(:disabled) { opacity: 1; background: var(--pe-hover); }
.dsh-pe-btn:disabled { opacity: 0.45; cursor: default; }
.dsh-pe-btn .dsh-pe-btn-icon { font-size: 14px; }
.dsh-pe-btn.is-busy .dsh-pe-btn-icon { animation: dsh-pe-spin 1s linear infinite; }
@keyframes dsh-pe-spin { to { transform: rotate(360deg); } }

.dsh-pe-undo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px;
  font-size: 12px;
  color: inherit;
  opacity: 0.85;
}
.dsh-pe-undo .dsh-pe-undo-check { color: #7ed491; }
.dsh-pe-undo-link {
  border: none; background: var(--pe-hover); color: inherit;
  border-radius: 5px; padding: 3px 10px; font-size: 12px; cursor: pointer;
}
.dsh-pe-undo-link:hover { background: rgba(127,127,127,0.3); }
.dsh-pe-undo-x {
  border: none; background: transparent; color: inherit; opacity: 0.55;
  cursor: pointer; padding: 0 4px; font-size: 12px;
}
.dsh-pe-undo-x:hover { opacity: 1; }
`;
function ensureStyles() {
  if (document.getElementById(STYLE_ID) !== null) return false;
  const element = document.createElement("style");
  element.id = STYLE_ID;
  element.textContent = CSS;
  document.head.appendChild(element);
  return true;
}

// src/client/shortcut.ts
var MODIFIER_ALIASES = /* @__PURE__ */ new Map([
  ["ctrl", "ctrl"],
  ["control", "ctrl"],
  ["alt", "alt"],
  ["option", "alt"],
  ["shift", "shift"],
  ["meta", "meta"],
  ["cmd", "meta"],
  ["command", "meta"],
  ["win", "meta"],
  ["super", "meta"]
]);
var isKeyToken = (token) => /^[a-z0-9]$/.test(token) || /^f([1-9]|1[0-2])$/.test(token);
function codeFor(token) {
  if (/^[a-z]$/.test(token)) return `Key${token.toUpperCase()}`;
  if (/^[0-9]$/.test(token)) return `Digit${token}`;
  return `F${token.slice(1)}`;
}
function parseShortcut(spec) {
  if (spec === void 0) return null;
  const tokens = spec.trim().toLowerCase().split("+").map((token) => token.trim()).filter((token) => token !== "");
  if (tokens.length === 0 || tokens.length > 5) return null;
  const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  const last = tokens[tokens.length - 1] ?? "";
  if (!isKeyToken(last)) return null;
  for (const token of tokens.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES.get(token);
    if (modifier === void 0) return null;
    modifiers[modifier] = true;
  }
  if (!modifiers.ctrl && !modifiers.alt && !modifiers.meta) return null;
  return { ...modifiers, key: last, code: codeFor(last) };
}
function matchesShortcut(event, combo) {
  if (combo === null) return false;
  return event.ctrlKey === combo.ctrl && event.altKey === combo.alt && event.shiftKey === combo.shift && event.metaKey === combo.meta && (event.code === combo.code || event.key.toLowerCase() === combo.key);
}

// src/client/settings-source.ts
var RANK = {
  none: 0,
  legacyScope: 1,
  binder: 2,
  configForms: 3
};
function sectionOf(snapshot) {
  if (snapshot === null || typeof snapshot !== "object") return void 0;
  const record = snapshot;
  if (record.status === "unavailable") return void 0;
  return record.value;
}
function servedNamespaces(forms) {
  try {
    const namespaces = forms.describe?.()?.getSnapshot?.()?.view?.namespaces;
    return Array.isArray(namespaces) ? namespaces.map((entry) => String(entry?.ns ?? "")) : [];
  } catch {
    return [];
  }
}
function installClientSettingsSource(ctx, options) {
  let rank = RANK.none;
  const adopt = (next, section) => {
    if (section === void 0 || next < rank) return;
    rank = next;
    options.onSection(section);
  };
  const adoptSnapshot = (next, form) => {
    try {
      const section = sectionOf(form.getSnapshot?.());
      if (section !== void 0) adopt(next, section);
    } catch {
    }
  };
  ctx.inject(["configForms"], (formsCtx) => {
    const forms = formsCtx.configForms;
    if (forms === void 0 || typeof forms.get !== "function") return;
    let boundId;
    let unsubscribeForm;
    const resolveEntryId = () => {
      const served = servedNamespaces(forms);
      return options.rowIds.find((id) => served.includes(id)) ?? served.find((ns) => ns.includes("dsh-prompt-enhance")) ?? options.rowIds[0];
    };
    const bind = () => {
      const entryId = resolveEntryId();
      if (entryId === void 0 || entryId === boundId) return;
      let form;
      try {
        form = forms.get?.(entryId);
      } catch {
        return;
      }
      if (form === void 0) return;
      try {
        unsubscribeForm?.();
      } catch {
      }
      unsubscribeForm = void 0;
      boundId = entryId;
      adoptSnapshot(RANK.configForms, form);
      try {
        unsubscribeForm = form.subscribe?.(() => adoptSnapshot(RANK.configForms, form));
      } catch {
        unsubscribeForm = void 0;
      }
    };
    bind();
    ctx.effect(() => () => {
      try {
        unsubscribeForm?.();
      } catch {
      }
    }, "dsh-prompt-enhance: settings form mirror");
    try {
      const watch = forms.describe?.()?.subscribe?.(() => bind());
      if (typeof watch === "function") {
        ctx.effect(() => () => {
          try {
            watch();
          } catch {
          }
        }, "dsh-prompt-enhance: settings namespace watch");
      }
    } catch {
    }
  });
  ctx.inject(["webUiSettings"], (binderCtx) => {
    const binder = binderCtx.webUiSettings;
    if (binder === void 0 || typeof binder.bind !== "function") return;
    let bound;
    for (const namespace of options.rowIds) {
      try {
        bound = binder.bind({ namespace });
      } catch {
        bound = void 0;
      }
      if (bound !== void 0) break;
    }
    if (bound === void 0) return;
    adoptSnapshot(RANK.binder, bound);
    let unsubscribe;
    try {
      unsubscribe = bound.subscribe?.(() => adoptSnapshot(RANK.binder, bound));
    } catch {
      unsubscribe = void 0;
    }
    ctx.effect(() => () => {
      try {
        unsubscribe?.();
      } catch {
      }
    }, "dsh-prompt-enhance: settings binder mirror");
  });
  ctx.inject(["settingsScope"], (scopeCtx) => {
    const scopeCtxLike = scopeCtx;
    const scope = scopeCtxLike.settingsScope;
    if (scope === void 0 || typeof scope.bind !== "function") return;
    let bound;
    try {
      bound = scope.bind({ namespace: options.rowIds[0] ?? "dsh-prompt-enhance", decode: (value) => value });
    } catch {
      return;
    }
    adoptSnapshot(RANK.legacyScope, bound);
    let unsubscribe;
    try {
      unsubscribe = bound.subscribe?.(() => adoptSnapshot(RANK.legacyScope, bound));
    } catch {
      unsubscribe = void 0;
    }
    ctx.effect(() => () => {
      try {
        unsubscribe?.();
      } catch {
      }
    }, "dsh-prompt-enhance: settings scope mirror");
  });
}

// src/client/settings-page.tsx
var import_react6 = require("react");

// src/shared/defaults.ts
var DEFAULT_VALUES = {
  enabled: true,
  temperature: 0.3,
  // A rewrite does not need deep reasoning, and the route default is expensive
  // (measured: 2897 output tokens at `high` vs 252 at `off` for the same draft).
  // Sent explicitly, because omitting the field inherits that route default.
  reasoningEffort: "off",
  maxOutputTokens: 8192,
  maxInputChars: 12e3,
  timeoutMs: 6e4,
  systemPrompt: "",
  strategyMode: "replace-default",
  shortcut: "",
  maxConcurrent: 2,
  rateLimitPerMinute: 10,
  streaming: true,
  contextAware: true,
  contextMaxMessages: 8,
  contextMaxChars: 4e3
};

// src/shared/reasoning.ts
var REASONING_EFFORTS_ENDPOINT = "/dsh-prompt-enhance/reasoning-efforts";

// src/client/reasoning-options.ts
function effortOf(value) {
  if (value === null || typeof value !== "object") return void 0;
  const record = value;
  if (typeof record.id !== "string" || record.id === "" || typeof record.name !== "string" || record.name === "") return void 0;
  return {
    id: record.id,
    name: record.name,
    ...typeof record.description === "string" && record.description !== "" ? { description: record.description } : {}
  };
}
function capabilitiesOf(value) {
  if (value === null || typeof value !== "object") return { efforts: [], source: "unavailable", reason: "resolve-failed" };
  const record = value;
  const source = record.source === "resolved" || record.source === "default" || record.source === "unavailable" ? record.source : "unavailable";
  const efforts = Array.isArray(record.efforts) ? record.efforts.map(effortOf).filter((effort) => effort !== void 0) : [];
  const reason = typeof record.reason === "string" ? record.reason : void 0;
  if (source !== "unavailable" && efforts.length === 0) return { efforts: [], source: "unavailable", reason: "no-efforts" };
  return {
    efforts,
    source,
    ...typeof record.defaultEffort === "string" && record.defaultEffort !== "" ? { defaultEffort: record.defaultEffort } : {},
    ...reason === void 0 ? {} : { reason }
  };
}
async function fetchReasoningCapabilities(provider, model, options = {}) {
  const url = new URL(REASONING_EFFORTS_ENDPOINT, globalThis.location?.origin ?? "http://127.0.0.1");
  if (provider !== void 0 && model !== void 0) {
    url.searchParams.set("provider", provider);
    url.searchParams.set("model", model);
  }
  if (options.refresh === true) url.searchParams.set("refresh", "1");
  try {
    const response = await fetch(url, { signal: options.signal, headers: { accept: "application/json" } });
    if (!response.ok) return { efforts: [], source: "unavailable", reason: "resolve-failed" };
    const body = await response.json();
    const envelope = body;
    if (envelope === null || envelope === void 0 || envelope.ok !== true) {
      return { efforts: [], source: "unavailable", reason: "resolve-failed" };
    }
    return capabilitiesOf(envelope.value);
  } catch {
    return { efforts: [], source: "unavailable", reason: "resolve-failed" };
  }
}

// src/client/llm-catalog.ts
var import_react5 = require("react");

// src/shared/catalog.ts
var LLM_PROVIDERS_ENDPOINT = "/dsh-prompt-enhance/llm-providers";
var LLM_MODELS_ENDPOINT = "/dsh-prompt-enhance/llm-models";
var LLM_ROUTE_CHECK_ENDPOINT = "/dsh-prompt-enhance/llm-route-check";

// src/client/llm-catalog.ts
async function getJson(url, signal) {
  try {
    const response = await fetch(url, { signal, headers: { accept: "application/json" } });
    if (!response.ok) return void 0;
    const body = await response.json();
    const envelope = body;
    if (envelope === null || envelope === void 0 || envelope.ok !== true) return void 0;
    return envelope.value;
  } catch {
    return void 0;
  }
}
function endpoint(path, params = {}) {
  const url = new URL(path, globalThis.location?.origin ?? "http://127.0.0.1");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url;
}
async function fetchProviders(signal) {
  const value = await getJson(endpoint(LLM_PROVIDERS_ENDPOINT), signal);
  if (value === void 0 || !Array.isArray(value.providers)) return void 0;
  return value.providers.filter((entry) => entry !== null && typeof entry === "object" && typeof entry.id === "string" && entry.id !== "" && typeof entry.name === "string" && entry.name !== "" && typeof entry.registered === "boolean");
}
async function fetchModels(provider, signal) {
  const value = await getJson(endpoint(LLM_MODELS_ENDPOINT, { provider }), signal);
  if (value === void 0 || !Array.isArray(value.models)) return void 0;
  const models = value.models.filter((entry) => entry !== null && typeof entry === "object" && typeof entry.id === "string" && entry.id !== "" && typeof entry.name === "string" && entry.name !== "").map((entry) => ({
    id: entry.id,
    name: entry.name,
    ...typeof entry.description === "string" && entry.description !== "" ? { description: entry.description } : {}
  }));
  return { models, ...typeof value.reason === "string" ? { reason: value.reason } : {} };
}
async function fetchRouteCheck(provider, model, signal) {
  const value = await getJson(endpoint(LLM_ROUTE_CHECK_ENDPOINT, { provider, model }), signal);
  if (value === void 0 || typeof value.available !== "boolean") return void 0;
  return value;
}
function useLlmRouting(provider, model) {
  const [providers, setProviders] = (0, import_react5.useState)([]);
  const [providersLoading, setProvidersLoading] = (0, import_react5.useState)(true);
  const [providersFailed, setProvidersFailed] = (0, import_react5.useState)(false);
  const [providersToken, setProvidersToken] = (0, import_react5.useState)(0);
  const [models, setModels] = (0, import_react5.useState)([]);
  const [modelsLoading, setModelsLoading] = (0, import_react5.useState)(false);
  const [modelsFailed, setModelsFailed] = (0, import_react5.useState)(false);
  const [modelsToken, setModelsToken] = (0, import_react5.useState)(0);
  const [routeChecking, setRouteChecking] = (0, import_react5.useState)(false);
  const [routeAvailable, setRouteAvailable] = (0, import_react5.useState)(void 0);
  (0, import_react5.useEffect)(() => {
    const controller = new AbortController();
    setProvidersLoading(true);
    setProvidersFailed(false);
    void fetchProviders(controller.signal).then((entries) => {
      if (controller.signal.aborted) return;
      setProvidersLoading(false);
      if (entries === void 0) {
        setProvidersFailed(true);
        setProviders([]);
        return;
      }
      setProviders(entries);
    });
    return () => controller.abort();
  }, [providersToken]);
  (0, import_react5.useEffect)(() => {
    if (provider === "") {
      setModels([]);
      setModelsLoading(false);
      setModelsFailed(false);
      return;
    }
    const controller = new AbortController();
    setModels([]);
    setModelsLoading(true);
    setModelsFailed(false);
    void fetchModels(provider, controller.signal).then((answer) => {
      if (controller.signal.aborted) return;
      setModelsLoading(false);
      if (answer === void 0) {
        setModelsFailed(true);
        return;
      }
      setModels(answer.models);
      setModelsFailed(answer.models.length === 0);
    });
    return () => controller.abort();
  }, [provider, modelsToken]);
  (0, import_react5.useEffect)(() => {
    if (provider === "" || model === "") {
      setRouteChecking(false);
      setRouteAvailable(void 0);
      return;
    }
    const controller = new AbortController();
    setRouteChecking(true);
    setRouteAvailable(void 0);
    const timer = setTimeout(() => {
      void fetchRouteCheck(provider, model, controller.signal).then((answer) => {
        if (controller.signal.aborted) return;
        setRouteChecking(false);
        setRouteAvailable(answer === void 0 ? false : answer.available);
      });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [provider, model]);
  return {
    providers: {
      loading: providersLoading,
      failed: providersFailed,
      entries: providers,
      reload: () => setProvidersToken((token) => token + 1)
    },
    models: {
      loading: modelsLoading,
      failed: modelsFailed,
      entries: models,
      reload: () => setModelsToken((token) => token + 1)
    },
    route: { checking: routeChecking, available: routeAvailable }
  };
}

// src/client/settings-page.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime4 = require("react/jsx-runtime");
var SETTINGS_SECTION_SLOT = "settings.section";
var SETTINGS_SECTION_ID = "dsh-prompt-enhance";
var SETTINGS_SECTION_ORDER = 70;
var SETTINGS_SECTION_LABEL = "\u63D0\u793A\u8BCD\u589E\u5F3A";
function sectionTitle(getLocale) {
  try {
    const t = getLocale?.()?.bind(NS);
    return t === void 0 ? SETTINGS_SECTION_LABEL : t("settings.title");
  } catch {
    return SETTINGS_SECTION_LABEL;
  }
}
var SETTINGS_ROW_CONFIG_SLOT = "plugins.row.config";
var SETTINGS_NAMESPACE = "dsh-prompt-enhance";
var SETTINGS_BUNDLE = "dsh-prompt-enhance";
var SETTINGS_ROW_ID = "dsh-prompt-enhance";
var SETTINGS_ROW_CONFIG_KEY = `${SETTINGS_BUNDLE}#${SETTINGS_ROW_ID}`;
function settingsBooleanField(key) {
  return {
    field: key,
    format: (value) => typeof value === "boolean" ? String(value) : "",
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "clear" };
      if (trimmed === "true") return { kind: "set", value: true };
      if (trimmed === "false") return { kind: "set", value: false };
      return void 0;
    }
  };
}
function settingsEnumField(key, options) {
  return {
    field: key,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "clear" };
      return options.includes(trimmed) ? { kind: "set", value: trimmed } : void 0;
    }
  };
}
var STRATEGY_OPTIONS = [
  { value: "replace-default", label: "settings.strategy.replace" },
  { value: "extend-default", label: "settings.strategy.extend" }
];
var ROWS = [
  { key: "enabled", kind: "boolean", label: "settings.row.enabled.label", hint: "settings.row.enabled.hint" },
  { key: "contextAware", kind: "boolean", label: "settings.row.contextAware.label", hint: "settings.row.contextAware.hint" },
  { key: "streaming", kind: "boolean", label: "settings.row.streaming.label", hint: "settings.row.streaming.hint" },
  { key: "provider", kind: "provider", label: "settings.row.provider.label", hint: "settings.row.provider.hint" },
  { key: "model", kind: "model", label: "settings.row.model.label", hint: "settings.row.model.hint" },
  { key: "temperature", kind: "number", label: "settings.row.temperature.label", hint: "settings.row.temperature.hint" },
  { key: "reasoningEffort", kind: "reasoning", label: "settings.row.reasoningEffort.label", hint: "settings.row.reasoningEffort.hint" },
  { key: "maxOutputTokens", kind: "number", label: "settings.row.maxOutputTokens.label", hint: "settings.row.maxOutputTokens.hint" },
  { key: "maxInputChars", kind: "number", label: "settings.row.maxInputChars.label", hint: "settings.row.maxInputChars.hint" },
  { key: "timeoutMs", kind: "number", label: "settings.row.timeoutMs.label", hint: "settings.row.timeoutMs.hint" },
  { key: "strategyMode", kind: "strategy", label: "settings.row.strategyMode.label", hint: "settings.row.strategyMode.hint" },
  { key: "systemPrompt", kind: "text", label: "settings.row.systemPrompt.label", hint: "settings.row.systemPrompt.hint", placeholder: "settings.row.systemPrompt.placeholder" },
  { key: "contextMaxMessages", kind: "number", label: "settings.row.contextMaxMessages.label", hint: "settings.row.contextMaxMessages.hint" },
  { key: "contextMaxChars", kind: "number", label: "settings.row.contextMaxChars.label", hint: "settings.row.contextMaxChars.hint" },
  { key: "maxConcurrent", kind: "number", label: "settings.row.maxConcurrent.label", hint: "settings.row.maxConcurrent.hint" },
  { key: "rateLimitPerMinute", kind: "number", label: "settings.row.rateLimitPerMinute.label", hint: "settings.row.rateLimitPerMinute.hint" },
  { key: "shortcut", kind: "text", label: "settings.row.shortcut.label", hint: "settings.row.shortcut.hint", placeholder: "settings.row.shortcut.placeholder" }
];
function descriptorOf(row) {
  switch (row.kind) {
    case "number":
      return (0, import_dsh_client_ui_primitives.settingsNumberField)(row.key);
    case "boolean":
      return settingsBooleanField(row.key);
    case "strategy":
      return settingsEnumField(row.key, STRATEGY_OPTIONS.map((option) => option.value));
    case "reasoning":
      return (0, import_dsh_client_ui_primitives.settingsTextField)(row.key);
    default:
      return (0, import_dsh_client_ui_primitives.settingsTextField)(row.key);
  }
}
var FIELD_SPECS = ROWS.map((row) => descriptorOf(row));
function createSettingsForm(scope) {
  return new import_dsh_client_ui_primitives.SettingsFormModel(scope, FIELD_SPECS);
}
var ZH_COPY = zh;
function translator(t) {
  if (typeof t === "function") return t;
  return ((key) => ZH_COPY[key] ?? key);
}
function sectionCopy(t, chinese) {
  return {
    labels: {
      unavailable: t("settings.unavailable"),
      readOnly: t("settings.readOnly"),
      saveFailed: t("settings.saveFailed"),
      save: t("settings.save"),
      saving: t("settings.saving"),
      reset: t("settings.reset"),
      invalidNumber: t("settings.invalidNumber")
    },
    title: (row) => chinese ? `${row.key}\uFF08${t(row.label)}\uFF09` : row.key,
    hint: (row) => t(row.hint),
    placeholder: (row) => row.placeholder === void 0 ? void 0 : t(row.placeholder),
    choice: (key) => t(key),
    interpolate: (key, params) => t(key, params)
  };
}
function pageCopy(t) {
  return {
    labels: {
      unavailable: t("settings.unavailable"),
      readOnly: t("settings.readOnly"),
      saveFailed: t("settings.saveFailed"),
      save: t("settings.save"),
      saving: t("settings.saving"),
      reset: t("settings.reset"),
      invalidNumber: t("settings.invalidNumber")
    },
    title: (row) => t(row.label),
    hint: (row) => t(row.hint),
    placeholder: (row) => row.placeholder === void 0 ? void 0 : t(row.placeholder),
    choice: (key) => t(key),
    interpolate: (key, params) => t(key, params)
  };
}
var ROW_STYLE = { display: "flex", flexDirection: "column", gap: 6, padding: "12px 0" };
var HEAD_STYLE = { display: "flex", alignItems: "center", gap: 8 };
var LABEL_STYLE = {
  flex: 1,
  minWidth: 0,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-primary, inherit)"
};
var HINT_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-tertiary, inherit)"
};
var STATUS_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-secondary, inherit)"
};
var CHIP_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 8px",
  border: "none",
  borderRadius: 999,
  background: "var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.12))",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: "17px",
  color: "var(--dsw-alias-label-secondary, inherit)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  cursor: "pointer"
};
var REFRESH_STYLE = { ...CHIP_STYLE, flex: "none" };
var RESET_STYLE = CHIP_STYLE;
var INPUT_STYLE = {
  boxSizing: "border-box",
  width: "100%",
  height: 34,
  padding: "0 12px",
  border: "0.5px solid var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.35))",
  borderRadius: "var(--dsw-radius-md, 8px)",
  background: "var(--dsw-alias-bg-layer-3, transparent)",
  font: "inherit",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-primary, inherit)"
};
var INVALID_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-state-error-primary, #f85149)"
};
var WARN_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-state-error-primary, #f85149)"
};
var SELECT_STYLE = {
  ...INPUT_STYLE,
  // A hairline border can vanish on some scale factors; 1px keeps the control's
  // outline stable at rest, with the focus colour applied by the component.
  border: "1px solid var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.45))",
  cursor: "pointer"
};
var SEPARATOR_STYLE = {
  borderTop: "0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.24))"
};
var REPOSITORY_URL = "https://github.com/surfishs/dsh-prompt-enhance";
var GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z";
var PLUGIN_VERSION = true ? "0.0.1" : "0.0.0";
var HEADER_STYLE = { display: "flex", flexDirection: "column", gap: 12, padding: "2px 0" };
var HEADER_ROW_STYLE = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
var HEADER_TITLE_STYLE = {
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: "-0.012em",
  lineHeight: 1.3,
  color: "var(--dsw-alias-label-primary, inherit)"
};
var HEADER_LINK_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  height: 18,
  padding: "0 7px",
  border: "1px solid var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.35))",
  borderRadius: 999,
  background: "var(--dsw-alias-bg-layer-3, transparent)",
  fontSize: 10.5,
  fontWeight: 500,
  lineHeight: 1,
  color: "var(--dsw-alias-label-secondary, inherit)",
  textDecoration: "none"
};
var HEADER_VERSION_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  height: 18,
  padding: "0 7px",
  borderRadius: 999,
  background: "var(--dsw-alias-bg-layer-4, transparent)",
  fontSize: 10.5,
  lineHeight: 1,
  color: "var(--dsw-alias-label-tertiary, inherit)",
  fontVariantNumeric: "tabular-nums"
};
var HEADER_DESCRIPTION_STYLE = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.65,
  color: "var(--dsw-alias-label-tertiary, inherit)",
  textWrap: "pretty",
  maxWidth: "72ch"
};
function PageHeader(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEADER_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEADER_ROW_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: HEADER_TITLE_STYLE, children: props.title }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("a", { href: REPOSITORY_URL, target: "_blank", rel: "noreferrer", style: HEADER_LINK_STYLE, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { width: 11, height: 11, viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { fill: "currentColor", d: GITHUB_MARK }) }),
        "GitHub"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: HEADER_VERSION_STYLE, children: [
        "v",
        props.version
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: HEADER_DESCRIPTION_STYLE, children: props.description })
  ] });
}
function viewOf(snapshot, key) {
  const value = snapshot[key];
  if (value === null || typeof value !== "object") return { text: "", overridden: false, invalid: false };
  const field = value;
  return {
    text: typeof field.text === "string" ? field.text : "",
    overridden: field.overridden === true,
    invalid: field.invalid === true
  };
}
function atDefaultValue(key, text) {
  const fallback = DEFAULT_VALUES[key];
  if (fallback === void 0) return text.trim() === "";
  if (typeof fallback === "boolean") return text.trim() === String(fallback);
  if (typeof fallback === "number") {
    const parsed = Number(text.trim());
    return Number.isFinite(parsed) && parsed === fallback;
  }
  return text.trim() === String(fallback);
}
function OverrideActions(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "button",
    {
      type: "button",
      style: { ...RESET_STYLE, ...props.disabled ? { opacity: 0.5, cursor: "default" } : {} },
      disabled: props.disabled,
      onClick: props.onReset,
      children: props.copy.labels.reset
    }
  );
}
function BooleanRow(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        import_dsh_client_ui_primitives.Switch,
        {
          checked: props.view.text === "true",
          disabled: props.disabled,
          label: props.label,
          onChange: (next) => props.onEdit(next ? "true" : "false")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: HINT_STYLE, children: props.hint })
  ] });
}
function ChoiceRow(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      import_dsh_client_ui_primitives.SegmentedControl,
      {
        id: props.id,
        value: props.view.text,
        options: props.options,
        disabled: props.disabled,
        label: props.label,
        onChange: (next) => props.onEdit(next)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: HINT_STYLE, children: props.hint })
  ] });
}
function ReasoningRow(props) {
  const pair = props.provider !== "" && props.model !== "" ? `${props.provider}/${props.model}` : "";
  const [phase, setPhase] = (0, import_react6.useState)("loading");
  const [capabilities, setCapabilities] = (0, import_react6.useState)(void 0);
  const [refreshToken, setRefreshToken] = (0, import_react6.useState)(0);
  const [feedback, setFeedback] = (0, import_react6.useState)("idle");
  const forceRef = (0, import_react6.useRef)(false);
  const feedbackTimer = (0, import_react6.useRef)(void 0);
  (0, import_react6.useEffect)(() => {
    const controller = new AbortController();
    const force = forceRef.current;
    forceRef.current = false;
    setPhase("loading");
    setCapabilities(void 0);
    setFeedback(force ? "refreshing" : "idle");
    if (feedbackTimer.current !== void 0) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = void 0;
    }
    const settle = (result) => {
      if (!force) return;
      setFeedback(result);
      feedbackTimer.current = setTimeout(() => {
        setFeedback("idle");
        feedbackTimer.current = void 0;
      }, 3e3);
    };
    fetchReasoningCapabilities(
      props.provider === "" ? void 0 : props.provider,
      props.model === "" ? void 0 : props.model,
      { refresh: force, signal: controller.signal }
    ).then((answer) => {
      if (controller.signal.aborted) return;
      setCapabilities(answer);
      setPhase("ready");
      settle(answer.source === "unavailable" ? "failed" : "ok");
    }).catch(() => {
      if (controller.signal.aborted) return;
      setCapabilities({ efforts: [], source: "unavailable", reason: "resolve-failed" });
      setPhase("ready");
      settle("failed");
    });
    return () => {
      controller.abort();
      if (feedbackTimer.current !== void 0) {
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = void 0;
      }
    };
  }, [pair, refreshToken]);
  const options = [];
  if (phase === "ready" && capabilities !== void 0 && capabilities.source !== "unavailable") {
    for (const effort of capabilities.efforts) {
      options.push({
        value: effort.id,
        label: effort.name,
        ...effort.description === void 0 ? {} : { title: effort.description }
      });
    }
  }
  options.push({ value: "inherit", label: props.copy.choice("settings.reasoning.inherit") });
  const known = phase === "ready" && capabilities?.source !== "unavailable";
  const unsupported = known && props.view.text !== "" && props.view.text !== "inherit" && !options.some((option) => option.value === props.view.text);
  const refreshing = feedback === "refreshing";
  const refresh = () => {
    forceRef.current = true;
    setRefreshToken((token) => token + 1);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: LABEL_STYLE, children: props.label }),
      phase === "ready" || refreshing ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          style: { ...REFRESH_STYLE, opacity: props.disabled || refreshing ? 0.5 : 1 },
          disabled: props.disabled || refreshing,
          onClick: refresh,
          children: props.copy.choice(refreshing ? "settings.reasoning.refreshing" : "settings.reasoning.refresh")
        }
      ) : null,
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      import_dsh_client_ui_primitives.SegmentedControl,
      {
        id: props.id,
        value: props.view.text,
        options,
        disabled: props.disabled,
        label: props.label,
        onChange: (next) => props.onEdit(next)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    phase === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.reasoning.loading") }) : null,
    phase === "ready" && capabilities?.source === "unavailable" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.reasoning.unavailable") }) : null,
    unsupported ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, children: props.copy.interpolate("settings.reasoning.unsupported", { effort: props.view.text }) }) : null,
    feedback === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, "aria-live": "polite", children: props.copy.choice("settings.reasoning.refreshOk") }) : null,
    feedback === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, "aria-live": "polite", children: props.copy.choice("settings.reasoning.refreshFailed") }) : null
  ] });
}
function SelectControl(props) {
  const [focused, setFocused] = (0, import_react6.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "select",
    {
      id: props.id,
      style: { ...SELECT_STYLE, ...focused ? { borderColor: "var(--dsw-alias-state-business-primary, #4f8cff)" } : {} },
      value: props.value,
      disabled: props.disabled,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      onChange: (event) => props.onChange(event.target.value),
      children: props.children
    }
  );
}
function ProviderRow(props) {
  const current2 = props.view.text;
  const known = props.routing.providers.entries.find((entry) => entry.id === current2);
  const missing = current2 !== "" && known === void 0;
  const unconfigured = known !== void 0 && !known.registered;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { htmlFor: props.id, style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(SelectControl, { id: props.id, value: current2, disabled: props.disabled, onChange: (value) => props.onEdit(value), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "", children: props.copy.choice("settings.routing.followSession") }),
      missing ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: current2, title: current2, children: props.copy.interpolate("settings.routing.currentProvider", { value: current2 }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("optgroup", { label: props.copy.choice("settings.routing.groupRegistered"), children: props.routing.providers.entries.filter((entry) => entry.registered).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: entry.id, title: entry.id, children: entry.name }, entry.id)) }),
      props.routing.providers.entries.some((entry) => !entry.registered) ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("optgroup", { label: props.copy.choice("settings.routing.groupDormant"), children: props.routing.providers.entries.filter((entry) => !entry.registered).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("option", { value: entry.id, disabled: true, title: props.copy.choice("settings.routing.unconfiguredTitle"), children: [
        entry.name,
        props.copy.choice("settings.routing.unconfiguredSuffix")
      ] }, entry.id)) }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    props.routing.providers.loading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.providersLoading") }) : null,
    props.routing.providers.failed ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.providersFailed") }) : null,
    props.routing.providers.failed ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", style: REFRESH_STYLE, onClick: props.routing.providers.reload, children: props.copy.choice("settings.routing.retry") }) : null,
    missing ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: WARN_STYLE, children: props.copy.interpolate("settings.routing.providerMissing", { value: current2 }) }) : null,
    unconfigured ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: WARN_STYLE, children: props.copy.interpolate("settings.routing.providerUnconfigured", { name: known.name }) }) : null
  ] });
}
function ModelRow(props) {
  const current2 = props.view.text;
  const provider = props.providerValue;
  const [customMode, setCustomMode] = (0, import_react6.useState)(false);
  const known = props.routing.models.entries.some((entry) => entry.id === current2);
  const showCustom = provider !== "" && (customMode || current2 !== "" && !known);
  const pairIncomplete = provider !== "" && current2 === "";
  const routeUnavailable = provider !== "" && current2 !== "" && props.routing.route.available === false;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { htmlFor: props.id, style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      SelectControl,
      {
        id: props.id,
        value: showCustom ? "__custom__" : current2,
        disabled: props.disabled || provider === "",
        onChange: (value) => {
          if (value === "__custom__") {
            setCustomMode(true);
            return;
          }
          setCustomMode(false);
          props.onEdit(value);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "", children: provider === "" ? props.copy.choice("settings.routing.followSession") : props.copy.choice("settings.routing.selectModel") }),
          props.routing.models.entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: entry.id, title: entry.id, children: entry.name }, entry.id)),
          provider !== "" && current2 !== "" && !known ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: current2, title: current2, children: props.copy.interpolate("settings.routing.currentModel", { value: current2 }) }) : null,
          provider !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "__custom__", children: props.copy.choice("settings.routing.custom") }) : null
        ]
      }
    ),
    showCustom ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "input",
      {
        style: INPUT_STYLE,
        value: current2,
        placeholder: props.copy.choice("settings.routing.customPlaceholder"),
        disabled: props.disabled,
        onChange: (event) => props.onEdit(event.target.value)
      }
    ) : null,
    showCustom && props.routing.models.entries.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", style: REFRESH_STYLE, onClick: () => setCustomMode(false), children: props.copy.choice("settings.routing.pickFromList") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    props.routing.models.loading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.modelsLoading") }) : null,
    props.routing.models.failed && !showCustom ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.modelsFailed") }) : null,
    pairIncomplete ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: WARN_STYLE, children: props.copy.choice("settings.routing.pairIncomplete") }) : null,
    routeUnavailable ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: WARN_STYLE, children: props.copy.choice("settings.routing.routeUnavailable") }) : null
  ] });
}
function ValueRow(props) {
  const [focused, setFocused] = (0, import_react6.useState)(false);
  const invalid = props.view.invalid;
  const borderColor = invalid ? "var(--dsw-alias-state-error-primary, #f85149)" : focused ? "var(--dsw-alias-state-business-primary, #4f8cff)" : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("label", { htmlFor: props.id, style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "input",
      {
        id: props.id,
        type: "text",
        inputMode: props.numeric ? "numeric" : void 0,
        "aria-invalid": invalid || void 0,
        disabled: props.disabled,
        placeholder: props.placeholder,
        value: props.view.text,
        style: {
          ...INPUT_STYLE,
          ...props.disabled ? { color: "var(--dsw-alias-label-tertiary, inherit)", cursor: "default" } : {},
          ...borderColor === void 0 ? {} : { borderColor }
        },
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        onChange: (event) => props.onEdit(event.target.value)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    invalid ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: INVALID_STYLE, children: props.copy.labels.invalidNumber }) : null
  ] });
}
function SettingsRow(props) {
  const shared = {
    id: `dsh-prompt-enhance-${props.row.key}`,
    label: props.copy.title(props.row),
    hint: props.copy.hint(props.row),
    copy: props.copy,
    view: props.view,
    disabled: props.disabled,
    onEdit: props.onEdit,
    onReset: props.onReset
  };
  switch (props.row.kind) {
    case "boolean":
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BooleanRow, { ...shared });
    case "strategy":
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChoiceRow, { ...shared, options: STRATEGY_OPTIONS.map((option) => ({ value: option.value, label: props.copy.choice(option.label) })) });
    case "reasoning":
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ReasoningRow, { ...shared, provider: props.reasoningPair.provider, model: props.reasoningPair.model });
    case "provider":
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ProviderRow, { ...shared, routing: props.routing });
    case "model":
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ModelRow, { ...shared, routing: props.routing, providerValue: props.providerValue });
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ValueRow, { ...shared, numeric: props.row.kind === "number", placeholder: props.copy.placeholder(props.row) });
  }
}
function SettingsRows(props) {
  const provider = viewOf(props.state, "provider").text.trim();
  const model = viewOf(props.state, "model").text.trim();
  const routing = useLlmRouting(provider, model);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives.SettingsForm, { labels: props.copy.labels, state: props.state, onSave: props.save, onDiscard: props.discard, children: ROWS.map((row, index) => {
    const raw = viewOf(props.state, row.key);
    const view = raw.overridden && atDefaultValue(row.key, raw.text) ? { ...raw, overridden: false } : raw;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: index === 0 ? void 0 : SEPARATOR_STYLE, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      SettingsRow,
      {
        row,
        copy: props.copy,
        view,
        disabled: !props.state.writable,
        reasoningPair: { provider, model },
        routing,
        providerValue: provider,
        onEdit: (text) => props.edit(row.key, text),
        onReset: () => props.resetField(row.key)
      }
    ) }, row.key);
  }) });
}
function SettingsSection(props) {
  const read = props.usePromptEnhance;
  const state = read === void 0 ? void 0 : read((snapshot) => snapshot);
  const readLocale = props.usePromptEnhanceLocale;
  const locale = readLocale === void 0 ? void 0 : readLocale((snapshot) => snapshot);
  const t = translator(props.translate);
  const chinese = (locale?.active ?? "zh").toLowerCase().startsWith("zh");
  if (state === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: 0, fontSize: 12, lineHeight: 1.6 }, children: t("settings.disconnected") });
  }
  const edit = props.edit ?? (() => {
  });
  const resetField = props.resetField ?? (() => {
  });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PageHeader, { title: t("settings.title"), description: t("settings.description"), version: PLUGIN_VERSION }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      SettingsRows,
      {
        copy: sectionCopy(t, chinese),
        state,
        edit,
        resetField,
        save: props.save,
        discard: props.discard
      }
    )
  ] });
}
function SettingsPage(props) {
  const t = translator(props.t);
  const read = props.usePromptEnhance;
  const state = read === void 0 ? void 0 : read((snapshot) => snapshot);
  if (props.view === "summary") return t("settings.summary");
  if (state === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: { margin: 0, fontSize: 12, lineHeight: 1.6 }, children: t("settings.disconnected") });
  }
  const edit = props.edit ?? (() => {
  });
  const resetField = props.resetField ?? (() => {
  });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    SettingsRows,
    {
      copy: pageCopy(t),
      state,
      edit,
      resetField,
      save: props.save,
      discard: props.discard
    }
  );
}
var SettingsPageController = class {
  /**
   * @param scope - the scope of the entry the host serves this plugin under.
   * @param getLocale - resolves the client locale service, when one is mounted.
   */
  constructor(scope, getLocale) {
    __publicField(this, "form");
    __publicField(this, "store");
    __publicField(this, "getLocale");
    this.getLocale = getLocale;
    this.form = createSettingsForm(scope);
    this.store = this.form.bind(() => {
      const out = this.form.shell();
      for (const row of ROWS) {
        try {
          out[row.key] = this.form.field(row.key);
        } catch {
        }
      }
      return out;
    });
  }
  /** The props the slots hand their pages. */
  inject() {
    const face = this.getLocale?.();
    const props = { hooks: { promptEnhance: this.store }, ...this.form.actions() };
    if (face !== void 0) {
      ;
      props.hooks.promptEnhanceLocale = {
        getSnapshot: () => face.getSnapshot(),
        subscribe: (listener) => face.subscribe(listener)
      };
      props.translate = face.bind(NS);
    }
    return props;
  }
  /** Release the form's subscriptions. */
  dispose() {
    try {
      this.form.dispose();
    } catch {
    }
  }
};
function installSettingsPages(ctx, getLocale) {
  ctx.inject(["configForms", "slots"], (servicesCtx) => {
    const services = servicesCtx;
    const forms = services.configForms;
    const slots = services.slots;
    if (forms === void 0 || typeof forms.get !== "function" || slots === void 0) return;
    let controller;
    try {
      const scope = forms.get(SETTINGS_NAMESPACE);
      if (scope === void 0) return;
      controller = new SettingsPageController(scope, getLocale);
    } catch (error) {
      console.warn("[dsh-prompt-enhance] settings form failed; both configuration pages stay off.", error);
      return;
    }
    ctx.effect(() => () => controller.dispose(), "dsh-prompt-enhance: settings form");
    ctx.effect(() => {
      const stop = slots.inject(
        SETTINGS_SECTION_SLOT,
        () => slots.register(
          {
            name: SETTINGS_SECTION_SLOT,
            id: SETTINGS_SECTION_ID,
            order: SETTINGS_SECTION_ORDER,
            label: () => sectionTitle(getLocale),
            locale: NS,
            inject: () => controller.inject()
          },
          SettingsSection
        )
      );
      return stop;
    }, "dsh-prompt-enhance: settings section");
    const whileServed = typeof forms.whileServed === "function" ? forms.whileServed.bind(forms) : void 0;
    const registerRowPage = () => {
      const stop = slots.inject(
        SETTINGS_ROW_CONFIG_SLOT,
        () => slots.register(
          {
            name: SETTINGS_ROW_CONFIG_SLOT,
            key: SETTINGS_ROW_CONFIG_KEY,
            locale: NS,
            inject: () => controller.inject()
          },
          SettingsPage
        )
      );
      return stop;
    };
    if (whileServed !== void 0) {
      ctx.effect(() => whileServed([SETTINGS_NAMESPACE], () => registerRowPage()), "dsh-prompt-enhance: settings row page");
      return;
    }
    ctx.effect(() => registerRowPage(), "dsh-prompt-enhance: settings row page");
  });
}

// src/client/index.tsx
var inject = [];
function report(step, error) {
  try {
    console.warn(`[dsh-prompt-enhance] ${step} failed; that feature stays off.`, error);
  } catch {
  }
  return () => {
  };
}
function apply(ctx) {
  ensureStyles();
  let localeFace;
  ctx.inject(["locale"], (localeCtx) => {
    localeFace = localeCtx.locale;
    ctx.effect(() => {
      try {
        return localeCtx.locale.register(NS, dictionaries);
      } catch (error) {
        return report("dictionary registration", error);
      }
    }, "dsh-prompt-enhance: dictionaries");
  });
  setClientSettings(decodeClientSettings(void 0));
  installClientSettingsSource(ctx, {
    rowIds: PROMPT_ENHANCE_ROW_IDS,
    onSection: (section) => setClientSettings(decodeClientSettings(section))
  });
  installSettingsPages(ctx, () => localeFace);
  ctx.inject(["slots"], (slotsCtx) => {
    const slots = slotsCtx.slots;
    if (slots === void 0) return;
    return slots.inject("conversation.input.right", () => {
      try {
        return slots.register(
          { name: "conversation.input.right", id: "dsh-prompt-enhance", order: 60, locale: NS },
          EnhanceButton
        );
      } catch (error) {
        return report("composer enhance button slot", error);
      }
    });
  });
  ctx.inject(["slots"], (slotsCtx) => {
    const slots = slotsCtx.slots;
    if (slots === void 0) return;
    return slots.inject("conversation.input.dock", () => {
      try {
        return slots.register(
          { name: "conversation.input.dock", id: "dsh-prompt-enhance-undo", order: 90, locale: NS },
          UndoBar
        );
      } catch (error) {
        return report("undo bar slot", error);
      }
    });
  });
  ctx.effect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      const settings = getClientSettings();
      if (!settings.enabled) return;
      const combo = parseShortcut(settings.shortcut);
      if (!matchesShortcut(event, combo)) return;
      const target = shortcutTarget();
      if (target === void 0) return;
      event.preventDefault();
      event.stopPropagation();
      target();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, "dsh-prompt-enhance: shortcut");
}

		return module.exports;
	}
});

