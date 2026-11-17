window.__ModuleLoader__.load({
	id: "@surfishs/dsh-prompt-enhance",
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
var import_react2 = require("react");

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
var PROMPT_ENHANCE_ROW_IDS = ["dsh-prompt-enhance", "prompt-enhance", "web-ui-dsh-prompt-enhance", "web-ui-prompt-enhance"];

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
var KNOWN_ERROR_CODES = /* @__PURE__ */ new Set(["rejected", "rate-limit", "concurrency-limit", "cooldown", "timeout", "upstream", "unconfigured", "internal", "effort-unsupported"]);
function parseError(value) {
  const record = value;
  if (record !== null && typeof record === "object") {
    const code = typeof record.code === "string" && KNOWN_ERROR_CODES.has(record.code) ? record.code : "internal";
    const message = typeof record.message === "string" && record.message !== "" ? record.message : void 0;
    const params = record.params !== null && typeof record.params === "object" ? record.params : void 0;
    return { code, ...message !== void 0 ? { message } : {}, ...params !== void 0 ? { params } : {} };
  }
  return { code: "internal", params: { reason: "malformed" } };
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
      ...usage === void 0 ? {} : { usage },
      // Carried explicitly, not optional-by-accident: the panel's "output hit
      // the token cap" warning is driven by this flag alone, so rebuilding the
      // object without it left the host setting it, the wire carrying it, and
      // the UI never seeing it. Only `true` is ever normalized in, matching the
      // host, which sets the field solely on a capped finish.
      ...record.truncated === true ? { truncated: true } : {}
    };
  }
  throw new EnhanceClientError({ code: "internal", params: { reason: "malformed" } });
}
async function readEnvelope(response) {
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    throw new EnhanceClientError({ code: "internal", params: { reason: "malformed" } });
  }
  const envelope = parsed;
  if (envelope !== null && typeof envelope === "object" && envelope.ok === true) {
    return parseResult(envelope.value);
  }
  if (envelope !== null && typeof envelope === "object" && envelope.error !== void 0) {
    throw new EnhanceClientError(parseError(envelope.error));
  }
  throw new EnhanceClientError({ code: "internal", params: { reason: "malformed", status: response.status } });
}
async function rejectionOf(response) {
  try {
    const parsed = await response.json();
    if (parsed !== null && typeof parsed === "object" && parsed.error !== void 0) {
      return new EnhanceClientError(parseError(parsed.error));
    }
  } catch {
  }
  return new EnhanceClientError({ code: "internal", params: { reason: "refused", status: response.status } });
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
      throw new EnhanceClientError({ code: "internal", params: { reason: "cancelled" } });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", params: { reason: "unreachable" } });
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
  throw new EnhanceClientError({ code: "internal", params: { reason: "stream-closed" } });
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
      throw new EnhanceClientError({ code: "internal", params: { reason: "cancelled" } });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", params: { reason: "unreachable" } });
  }
  return readEnvelope(response);
}

// src/client/SparkleFishIcon.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var FISH_PATH = "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z";
var STAR_PATH = "M5.715 0 L7.2 4.2 L11.43 5.715 L7.2 7.2 L5.715 11.43 L4.2 7.2 L0 5.715 L4.2 4.2 Z";
var FISH_TRANSFORM = "translate(6.4976 4.3528) scale(0.78502)";
var STAR_TRANSFORM = "translate(1.1944 0.7969) scale(0.60097)";
function SparkleFishIcon(props) {
  const size = props.size ?? 15;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: size * 1.3, height: size, viewBox: "0 0 26 20", fill: "none", "aria-hidden": "true", focusable: "false", style: { display: "block", flexShrink: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { transform: FISH_TRANSFORM, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: FISH_PATH, fill: "currentColor" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: STAR_PATH, transform: STAR_TRANSFORM, fill: "currentColor" }),
    props.spinning === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("animate", { attributeName: "opacity", values: "1;0.35;1", dur: "1.1s", repeatCount: "indefinite" }) : null
  ] });
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
function runSession(sessionId, text) {
  sessions.get(sessionId)?.run(text);
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

// src/client/settings.ts
var DEFAULT_CLIENT_SETTINGS = {
  enabled: DEFAULT_VALUES.enabled,
  maxInputChars: DEFAULT_VALUES.maxInputChars,
  shortcut: DEFAULT_VALUES.shortcut,
  streaming: DEFAULT_VALUES.streaming
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
var import_react = require("react");
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
  const fallback = (0, import_react.useRef)(void 0);
  if (maybeSessionId !== void 0 && maybeSessionId !== "") return maybeSessionId;
  if (fallback.current === void 0) fallback.current = fallbackKeyOf(share);
  return fallback.current;
}
function serverSessionId(maybeSessionId) {
  return maybeSessionId !== void 0 && maybeSessionId !== "" ? maybeSessionId : void 0;
}

// src/client/EnhanceButton.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var OCCURRENCES_UNKNOWN = -1;
function occurrenceCountOf(value) {
  return Array.isArray(value) ? value.length : OCCURRENCES_UNKNOWN;
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
  const occurrenceCount = useInput((state) => occurrenceCountOf(state.occurrences));
  const settings = (0, import_react2.useSyncExternalStore)(subscribeClientSettings, getClientSettings);
  const panel = (0, import_react2.useSyncExternalStore)(subscribe, getPanel);
  const rootRef = (0, import_react2.useRef)(null);
  const busy = panel !== void 0 && panel.sessionId === uiKey && panel.phase === "loading";
  const anyBusy = panel !== void 0 && panel.phase === "loading";
  const otherBusy = anyBusy && !busy;
  const empty = draft.trim() === "";
  const start = (0, import_react2.useCallback)(
    (overrideText) => {
      const source = overrideText ?? draft;
      if (anyBusy || source.trim() === "") return;
      if (!settings.enabled) {
        const disabled = t("error.disabled");
        openError(uiKey, draft, { code: "rejected", localized: disabled });
        return;
      }
      const check = checkInputText(source, settings.maxInputChars);
      if (!check.ok) {
        const message = check.code === "empty" ? t("error.empty") : t("error.tooLong", { count: check.count, max: check.max });
        openError(uiKey, source, { code: "rejected", localized: message });
        return;
      }
      if (occurrenceCount === OCCURRENCES_UNKNOWN) {
        const unknown = t("error.chipsUnknown");
        openError(uiKey, source, { code: "rejected", localized: unknown });
        return;
      }
      if (occurrenceCount > 0) {
        const occurrences = t("error.occurrences");
        openError(uiKey, source, { code: "rejected", localized: occurrences });
        return;
      }
      if (phase !== "plain") {
        const busyPhase = t("error.phase");
        openError(uiKey, source, { code: "rejected", localized: busyPhase });
        return;
      }
      const controller = new AbortController();
      openLoading({ sessionId: uiKey, original: source, abort: () => controller.abort() });
      const settle = (result) => settleResult(uiKey, result);
      const fail = (error) => {
        const detail = error instanceof EnhanceClientError ? error.detail : { code: "internal", message: error instanceof Error ? error.message : String(error) };
        settleError(uiKey, detail);
      };
      if (settings.streaming) {
        requestEnhanceStream(
          { sessionId: wireId, text: source },
          {
            signal: controller.signal,
            onDelta: (delta) => appendDelta(uiKey, delta)
          }
        ).then(settle, fail);
        return;
      }
      requestEnhance({ sessionId: wireId, text: source }, controller.signal).then(settle, fail);
    },
    [anyBusy, draft, occurrenceCount, phase, settings, uiKey, wireId, t]
  );
  const runRef = (0, import_react2.useRef)(start);
  (0, import_react2.useEffect)(() => {
    runRef.current = start;
  });
  (0, import_react2.useEffect)(() => {
    const entry = {
      root: rootRef.current,
      run: (text) => runRef.current(text)
    };
    return registerSession(uiKey, entry);
  }, [uiKey]);
  (0, import_react2.useEffect)(() => {
    if (panel !== void 0 && panel.sessionId === uiKey && panel.phase === "result") {
      setStale(uiKey, draft !== panel.original);
    }
  }, [draft, panel, uiKey]);
  if (!settings.enabled) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "button",
    {
      ref: rootRef,
      type: "button",
      "data-dsh-pe-key": uiKey,
      className: `dsh-pe-btn${busy ? " is-busy" : ""}${otherBusy && !empty ? " is-blocked" : ""}${empty && !busy ? " is-empty" : ""}`,
      title: busy ? t("button.busy") : otherBusy ? t("button.otherBusy") : empty ? t("button.emptyTitle") : t("button.title"),
      "aria-label": busy ? t("button.busy") : otherBusy ? t("button.otherBusy") : empty ? t("button.emptyTitle") : t("button.title"),
      "aria-disabled": empty || otherBusy || void 0,
      onClick: () => start(),
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pe-btn-icon", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SparkleFishIcon, { size: 15, spinning: busy }) })
    }
  ) });
}

// src/client/ResultDock.tsx
var import_react5 = require("react");

// src/client/ResultPanel.tsx
var import_react3 = require("react");

// src/client/ActionIcons.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function icon(paths) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      focusable: "false",
      style: { display: "block", flexShrink: 0 },
      children: paths
    }
  );
}
function RegenerateIcon() {
  return icon([/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 12a9 9 0 1 1-3-6.7L21 8" }, "arc"), /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M21 3v5h-5" }, "head")]);
}
function CopyIcon() {
  return icon([/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }, "front"), /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }, "back")]);
}
function FillIcon() {
  return icon([/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 3v12" }, "stem"), /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "m7 10 5 5 5-5" }, "head"), /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M5 21h14" }, "tray")]);
}
function UndoIcon() {
  return icon([/* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M9 14 4 9l5-5" }, "head"), /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 9h10.5a5.5 5.5 0 0 1 0 11H8" }, "curve")]);
}

// src/client/ResultPanel.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
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
var CLIENT_ERROR_KEYS = {
  unreachable: "error.client.unreachable",
  malformed: "error.client.malformed",
  refused: "error.client.refused",
  "stream-closed": "error.client.streamClosed",
  cancelled: "error.client.cancelled"
};
function isClientFailureReason(value) {
  return typeof value === "string" && Object.hasOwn(CLIENT_ERROR_KEYS, value);
}
function localizedErrorMessage(t, code, params) {
  if (code === "rejected" && typeof params?.count === "number" && typeof params?.max === "number") {
    return t("error.tooLong", { count: params.count, max: params.max });
  }
  if (code === "upstream" && typeof params?.reason === "string") {
    const specific = UPSTREAM_ERROR_KEYS[params.reason];
    if (specific !== void 0) return t(specific);
  }
  if (code === "internal" && isClientFailureReason(params?.reason)) {
    return t(CLIENT_ERROR_KEYS[params.reason], params);
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
function formatTokens(tokens) {
  return tokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function totalTokensOf(usage) {
  return usage.totalTokens ?? usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
}
function ResultPanel(props) {
  const { state, t, onApply, onCancel, onRetry, applied = false, onUndo, onRegenerate, undone = false, regenerated = false } = props;
  const [copied, setCopied] = (0, import_react3.useState)("idle");
  const copy = (0, import_react3.useCallback)(() => {
    if (state.result === void 0) return;
    const text = state.result.text;
    const done = (ok) => {
      setCopied(ok ? "ok" : "failed");
      if (ok) setTimeout(() => setCopied("idle"), 2500);
    };
    if (navigator.clipboard !== void 0) {
      navigator.clipboard.writeText(text).then(
        () => done(true),
        () => done(fallbackCopy(text))
      );
      return;
    }
    done(fallbackCopy(text));
  }, [state.result]);
  const formatMs = (ms) => ms < 1e3 ? `${ms}ms` : `${(ms / 1e3).toFixed(1)}s`;
  const tokenDetail = (usage) => {
    const parts = [t("panel.tokens.input", { count: formatTokens(usage.inputTokens) }), t("panel.tokens.output", { count: formatTokens(usage.outputTokens) })];
    if ((usage.cacheReadTokens ?? 0) > 0) {
      parts.push(t("panel.tokens.cacheRead", { count: formatTokens(usage.cacheReadTokens ?? 0) }));
    }
    if ((usage.cacheWriteTokens ?? 0) > 0) {
      parts.push(t("panel.tokens.cacheWrite", { count: formatTokens(usage.cacheWriteTokens ?? 0) }));
    }
    return parts.join(" \xB7 ");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "dsh-pe-panel", role: "region", "aria-label": t("panel.title"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "dsh-pe-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-pe-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SparkleFishIcon, { size: 15 }),
        t("panel.title")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-pe-head-actions", children: [
        state.phase === "result" && state.result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-pe-badge", children: [
          t("panel.model", { provider: state.result.provider, model: state.result.model }),
          " \xB7 ",
          t("panel.elapsed", { ms: formatMs(state.result.elapsedMs) }),
          state.result.usage === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            " \xB7 ",
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { title: tokenDetail(state.result.usage), children: t("panel.tokens", { total: formatTokens(totalTokensOf(state.result.usage)) }) })
          ] })
        ] }),
        copied === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-pe-applied", children: t("panel.copiedShort") }) : regenerated ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-pe-applied", children: t("panel.regeneratedShort") }) : applied ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-pe-applied", children: t("panel.appliedShort") }) : undone ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-pe-applied", children: t("panel.undoneShort") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dsh-pe-close", "aria-label": t("panel.close"), onClick: onCancel, children: "\u2715" })
      ] })
    ] }),
    state.phase === "loading" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-pe-loading", children: state.streaming === void 0 || state.streaming === "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-pe-spin", "aria-hidden": true }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: t("panel.loading") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-pe-hint", children: t("panel.loading.hint") })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-pe-stream", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-pe-col-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-pe-spin small", "aria-hidden": true }),
        t("panel.streaming")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "dsh-pe-result-text", children: state.streaming })
    ] }) }),
    state.phase === "error" && state.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-pe-error", children: state.error.localized !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: state.error.localized }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: localizedErrorMessage(t, state.error.code, state.error.params) }),
      state.error.message !== void 0 && state.error.message !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-pe-error-detail", children: state.error.message })
    ] }) }),
    state.phase === "result" && state.result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-pe-result", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "dsh-pe-result-text", children: state.result.text }) }),
    state.phase === "result" && state.result?.truncated === true && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-pe-stale", children: [
      "\u26A0 ",
      t("panel.truncated")
    ] }),
    state.phase === "result" && state.stale && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-pe-stale", children: [
      "\u26A0 ",
      t("panel.stale.warn")
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("footer", { className: "dsh-pe-foot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-pe-grow" }),
      state.phase === "result" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-pe-btn-action plain", onClick: onRegenerate, disabled: onRegenerate === void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RegenerateIcon, {}),
        t("panel.regenerate")
      ] }),
      state.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: retryable(state.error?.code) && onRetry !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dsh-pe-btn-action plain", onClick: onRetry, children: t("panel.retry") }) }),
      state.phase === "loading" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dsh-pe-btn-action plain", onClick: onCancel, children: t("panel.cancel") }),
      state.phase === "result" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-pe-btn-action plain dsh-pe-copy", onClick: copy, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CopyIcon, {}),
          copied === "ok" ? t("panel.copied") : copied === "failed" ? t("panel.copyFailed") : t("panel.copy")
        ] }),
        applied ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-pe-btn-action primary", onClick: onUndo, disabled: onUndo === void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UndoIcon, {}),
          t("undo.undo")
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dsh-pe-btn-action primary", onClick: onApply, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(FillIcon, {}),
          t("panel.apply")
        ] })
      ] })
    ] })
  ] });
}

// src/client/useDockAlignment.ts
var import_react4 = require("react");
var EDITOR_SELECTOR = 'textarea, [contenteditable="true"], [role="textbox"]';
var SESSION_ANCHOR_ATTRIBUTE = "data-dsh-pe-key";
var CARD_MIN_WIDTH = 360;
var CARD_MIN_HEIGHT = 48;
var CARD_MIN_RADIUS = 4;
var CARD_MAX_DEPTH = 12;
var CARD_MAX_VIEWPORT_SHARE = 0.8;
var CARD_CENTER_TOLERANCE = 40;
var EDITOR_BELOW_SLACK = 4;
function isCardSurface(node, minWidth) {
  const rect = node.getBoundingClientRect();
  if (rect.width < minWidth || rect.width <= CARD_MIN_WIDTH || rect.height <= CARD_MIN_HEIGHT) return false;
  const style = getComputedStyle(node);
  return (parseFloat(style.borderTopLeftRadius) || 0) >= CARD_MIN_RADIUS && style.backgroundColor !== "rgba(0, 0, 0, 0)";
}
function cardAround(start) {
  let node = start.parentElement;
  for (let depth = 0; depth < CARD_MAX_DEPTH && node !== null; depth++) {
    if (isCardSurface(node, 0)) return node.getBoundingClientRect();
    node = node.parentElement;
  }
  return void 0;
}
function editorsIn(scope) {
  return Array.from(scope.querySelectorAll(EDITOR_SELECTOR));
}
function useDockAlignment(active, uiKey) {
  const rootRef = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    if (!active) return;
    const root = rootRef.current;
    if (root === null) return;
    let frame = 0;
    const cardFromEditor = (editor) => {
      const editorRect = editor.getBoundingClientRect();
      const candidates = [];
      let node = editor;
      for (let depth = 0; depth < CARD_MAX_DEPTH && node !== null; depth++) {
        if (isCardSurface(node, editorRect.width)) candidates.push(node.getBoundingClientRect());
        node = node.parentElement;
      }
      const widest = (list) => list.sort((a, b) => b.width - a.width)[0];
      if (candidates.length === 0) return void 0;
      const editorCenter = editorRect.left + editorRect.width / 2;
      const centered = candidates.filter((rect) => rect.width <= window.innerWidth * CARD_MAX_VIEWPORT_SHARE && Math.abs(rect.left + rect.width / 2 - editorCenter) < CARD_CENTER_TOLERANCE);
      return widest(centered) ?? widest(candidates);
    };
    const editorBelow = (scope, rootRect) => editorsIn(scope).find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= rootRect.bottom - EDITOR_BELOW_SLACK;
    });
    const cardForThisEntry = () => {
      if (uiKey !== void 0) {
        const anchor = Array.from(document.querySelectorAll(`[${SESSION_ANCHOR_ATTRIBUTE}]`)).find((node) => node.getAttribute(SESSION_ANCHOR_ATTRIBUTE) === uiKey);
        if (anchor !== void 0) {
          const anchored = cardAround(anchor);
          if (anchored !== void 0) return anchored;
        }
      }
      const rootRect = root.getBoundingClientRect();
      const parent = root.parentElement;
      const scoped = parent === null ? void 0 : editorBelow(parent, rootRect);
      if (scoped !== void 0) {
        const rect = cardFromEditor(scoped);
        if (rect !== void 0) return rect;
      }
      const anywhere = editorBelow(document, rootRect);
      return anywhere === void 0 ? void 0 : cardFromEditor(anywhere);
    };
    const apply2 = (cardRect) => {
      if (cardRect === void 0) {
        root.style.width = "";
        root.style.marginLeft = "";
        return;
      }
      const width = `${cardRect.width}px`;
      if (root.style.width !== width) root.style.width = width;
      const afterWidth = root.getBoundingClientRect();
      const currentMargin = parseFloat(root.style.marginLeft) || 0;
      const marginLeft = `${cardRect.left - (afterWidth.left - currentMargin)}px`;
      if (root.style.marginLeft !== marginLeft) root.style.marginLeft = marginLeft;
    };
    const align = () => {
      root.style.transform = "";
      apply2(cardForThisEntry());
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
    };
    schedule();
    schedule();
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(document.documentElement);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [active, uiKey]);
  return rootRef;
}

// src/client/ResultDock.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function ResultDock(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const panel = (0, import_react5.useSyncExternalStore)(subscribe, getPanel);
  const rootRef = useDockAlignment(panel !== void 0 && panel.sessionId === uiKey, uiKey);
  const [undone, setUndone] = (0, import_react5.useState)(false);
  const [regenerated, setRegenerated] = (0, import_react5.useState)(false);
  const [pendingRegenerate, setPendingRegenerate] = (0, import_react5.useState)(false);
  const previousResultRef = (0, import_react5.useRef)(void 0);
  const draft = useInput((state) => {
    const value = state.draft;
    return typeof value === "string" ? value : "";
  });
  const phase = useInput((state) => {
    const value = state.phase;
    return typeof value === "string" ? value : "";
  });
  const useSession = props.useSession;
  const sessionRunning = useSession === void 0 ? false : (
    // eslint-disable-next-line react-hooks/rules-of-hooks
    Boolean(useSession((state) => state.running))
  );
  const sessionQueued = useSession === void 0 ? 0 : (
    // eslint-disable-next-line react-hooks/rules-of-hooks
    Number(useSession((state) => state.queue?.length ?? 0))
  );
  const entry = peekUndo(uiKey);
  const applied = entry !== void 0 && entry.applied === draft;
  const prevSession = (0, import_react5.useRef)({ running: sessionRunning, queued: sessionQueued });
  (0, import_react5.useEffect)(() => {
    const prev = prevSession.current;
    prevSession.current = { running: sessionRunning, queued: sessionQueued };
    if (panel === void 0 || panel.sessionId !== uiKey) return;
    if (phase === "sending" || sessionRunning && !prev.running || sessionQueued > prev.queued) {
      closePanel();
    }
  }, [phase, sessionRunning, sessionQueued, panel, uiKey]);
  (0, import_react5.useEffect)(() => {
    if (panel === void 0 || panel.sessionId !== uiKey) return;
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing || event.key !== "Escape") return;
      event.preventDefault();
      closePanel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panel, uiKey]);
  (0, import_react5.useEffect)(() => {
    if (!undone) return;
    const timer = setTimeout(() => setUndone(false), 2500);
    return () => clearTimeout(timer);
  }, [undone]);
  (0, import_react5.useEffect)(() => {
    if (!pendingRegenerate) return;
    if (panel === void 0 || panel.sessionId !== uiKey) {
      setPendingRegenerate(false);
      return;
    }
    if (panel.phase === "error") {
      setPendingRegenerate(false);
      return;
    }
    if (panel.phase === "result" && panel.result !== previousResultRef.current) {
      setPendingRegenerate(false);
      setRegenerated(true);
    }
  }, [panel, pendingRegenerate, uiKey]);
  (0, import_react5.useEffect)(() => {
    if (!regenerated) return;
    const timer = setTimeout(() => setRegenerated(false), 2500);
    return () => clearTimeout(timer);
  }, [regenerated]);
  (0, import_react5.useEffect)(() => {
    if (!pendingRegenerate) return;
    const timer = setTimeout(() => setPendingRegenerate(false), 15e3);
    return () => clearTimeout(timer);
  }, [pendingRegenerate]);
  if (panel === void 0 || panel.sessionId !== uiKey) return null;
  const apply2 = () => {
    if (panel.phase !== "result" || panel.result === void 0) return;
    pushUndo(uiKey, { original: draft, applied: panel.result.text });
    inputActions.setDraft(panel.result.text);
    setUndone(false);
    setRegenerated(false);
  };
  const undo = () => {
    if (entry === void 0) return;
    inputActions.setDraft(entry.original);
    popUndo(uiKey);
    setUndone(true);
    setRegenerated(false);
  };
  const regenerate = () => {
    if (panel.phase !== "result") return;
    previousResultRef.current = panel.result;
    setRegenerated(false);
    setPendingRegenerate(true);
    runSession(uiKey);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { ref: rootRef, className: "dsh-pe-dock", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    ResultPanel,
    {
      state: panel,
      t,
      applied,
      undone,
      regenerated,
      onApply: apply2,
      onUndo: undo,
      onRegenerate: regenerate,
      onCancel: () => closePanel(),
      onRetry: panel.phase === "error" ? () => runSession(uiKey) : void 0
    }
  ) });
}

// src/client/UndoBar.tsx
var import_react6 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function UndoBar(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const draft = useInput((state) => {
    const value = state.draft;
    return typeof value === "string" ? value : "";
  });
  (0, import_react6.useSyncExternalStore)(subscribe, getVersion);
  const entry = peekUndo(uiKey);
  (0, import_react6.useEffect)(() => {
    if (entry !== void 0 && entry.applied !== draft) popUndo(uiKey);
  }, [draft, entry, uiKey]);
  const panel = getPanel();
  const visible = (panel === void 0 || panel.sessionId !== uiKey) && entry !== void 0 && entry.applied === draft;
  const rootRef = useDockAlignment(visible, uiKey);
  if (!visible) return null;
  const undo = () => {
    inputActions.setDraft(entry.original);
    popUndo(uiKey);
  };
  const dismiss = () => {
    popUndo(uiKey);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { ref: rootRef, className: "dsh-pe-dock", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dsh-pe-undo", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dsh-pe-undo-check", "aria-hidden": true, children: "\u2713" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t("undo.applied") }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { type: "button", className: "dsh-pe-undo-link", onClick: undo, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(UndoIcon, {}),
      t("undo.undo")
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dsh-pe-undo-x", "aria-label": t("undo.dismiss"), onClick: dismiss, children: "\u2715" })
  ] }) });
}

// src/client/locales.ts
var zh = {
  "button.title": "\u63D0\u793A\u8BCD\u589E\u5F3A",
  "button.busy": "\u6B63\u5728\u589E\u5F3A\u2026",
  "button.otherBusy": "\u53E6\u4E00\u4E2A\u4F1A\u8BDD\u6B63\u5728\u589E\u5F3A\u4E2D\uFF1B\u8BF7\u7B49\u5B83\u5B8C\u6210\u6216\u5148\u5173\u95ED\u5176\u7ED3\u679C\u9762\u677F\u3002",
  "button.emptyTitle": "\u63D0\u793A\u8BCD\u589E\u5F3A\uFF08\u5F53\u524D\u8F93\u5165\u533A\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u8F93\u5165\u6587\u5B57\uFF09",
  "panel.title": "\u63D0\u793A\u8BCD\u589E\u5F3A",
  "panel.loading": "\u6B63\u5728\u589E\u5F3A\uFF0C\u7A0D\u5019\u2026",
  "panel.streaming": "\u6B63\u5728\u751F\u6210\u2026",
  "panel.loading.hint": "\u539F\u6587\u4FDD\u7559\u5728\u8F93\u5165\u6846\u4E2D\uFF0C\u4E0D\u4F1A\u88AB\u52A8\u4FEE\u6539\u3002",
  "panel.cancel": "\u53D6\u6D88",
  "panel.original": "\u539F\u59CB\u63D0\u793A\u8BCD",
  "panel.enhanced": "\u589E\u5F3A\u7ED3\u679C",
  "panel.apply": "\u56DE\u586B\u5230\u8F93\u5165\u6846",
  "panel.regenerate": "\u91CD\u65B0\u751F\u6210",
  "panel.appliedShort": "\u5DF2\u66FF\u6362 \u2713",
  "panel.undoneShort": "\u5DF2\u64A4\u9500 \u2713",
  "panel.regeneratedShort": "\u5DF2\u91CD\u65B0\u751F\u6210 \u2713",
  "panel.copiedShort": "\u5DF2\u590D\u5236 \u2713",
  "panel.copy": "\u590D\u5236\u7ED3\u679C",
  "panel.copied": "\u5DF2\u590D\u5236",
  "panel.copyFailed": "\u590D\u5236\u5931\u8D25",
  "panel.close": "\u5173\u95ED",
  "panel.retry": "\u91CD\u8BD5",
  "panel.stale.warn": "\u8349\u7A3F\u5DF2\u6539\u52A8\uFF0C\u5F53\u524D\u7ED3\u679C\u57FA\u4E8E\u6539\u52A8\u524D\u7684\u6587\u672C\uFF1B\u56DE\u586B\u4F1A\u8986\u76D6\u5F53\u524D\u8F93\u5165\uFF08\u53EF\u64A4\u9500\uFF09\u3002",
  "panel.truncated": "\u8F93\u51FA\u8FBE\u5230 Token \u4E0A\u9650\uFF0C\u7ED3\u679C\u53EF\u80FD\u4E0D\u5B8C\u6574\u3002\u53EF\u5728\u8BBE\u7F6E\u4E2D\u8C03\u9AD8\u300C\u6700\u5927\u8F93\u51FA Token\u300D\u3002",
  "panel.model": "\u6A21\u578B\uFF1A{provider} / {model}",
  "panel.elapsed": "\u8017\u65F6 {ms}",
  "panel.tokens": "{total} tokens",
  "panel.tokens.input": "\u8F93\u5165 {count}",
  "panel.tokens.output": "\u8F93\u51FA {count}",
  "panel.tokens.cacheRead": "\u7F13\u5B58\u8BFB\u53D6 {count}",
  "panel.tokens.cacheWrite": "\u7F13\u5B58\u5199\u5165 {count}",
  "undo.applied": "\u5DF2\u66FF\u6362\u539F\u63D0\u793A\u8BCD",
  "undo.undo": "\u64A4\u9500",
  "undo.dismiss": "\u5173\u95ED\u63D0\u793A",
  "error.empty": "\u8F93\u5165\u6846\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u8F93\u5165\u8981\u589E\u5F3A\u7684\u63D0\u793A\u8BCD\u3002",
  "error.tooLong": "\u5185\u5BB9\u5171 {count} \u4E2A\u5B57\u7B26\uFF0C\u8D85\u8FC7 {max} \u4E2A\u5B57\u7B26\u4E0A\u9650\uFF08\u6309 Unicode \u5B57\u7B26\u6570\u7EDF\u8BA1\uFF0C\u4E0D\u662F token \u6570\uFF09\u3002\u4E3A\u907F\u514D\u6539\u53D8\u539F\u610F\u4E0D\u4F1A\u81EA\u52A8\u622A\u65AD\uFF0C\u8BF7\u7CBE\u7B80\u540E\u518D\u8BD5\u3002",
  "error.occurrences": "\u8F93\u5165\u5185\u5BB9\u5305\u542B\u547D\u4EE4\u6216\u6587\u4EF6\u5F15\u7528\uFF0C\u6682\u4E0D\u652F\u6301\u589E\u5F3A\uFF1B\u8BF7\u5148\u79FB\u9664\u540E\u518D\u8BD5\u3002",
  "error.chipsUnknown": "\u65E0\u6CD5\u8BFB\u53D6\u8F93\u5165\u6846\u7684\u5F15\u7528\u72B6\u6001\uFF08\u5BBF\u4E3B\u672A\u63D0\u4F9B\u5F15\u7528\u4FE1\u606F\uFF09\u3002\u4E3A\u907F\u514D\u8986\u76D6\u5DF2\u6DFB\u52A0\u7684\u547D\u4EE4\u6216\u6587\u4EF6\u5F15\u7528\uFF0C\u672C\u6B21\u589E\u5F3A\u5DF2\u963B\u6B62\uFF1B\u8BF7\u6E05\u7A7A\u8F93\u5165\u6846\u540E\u8F93\u5165\u7EAF\u6587\u672C\u8349\u7A3F\uFF0C\u6216\u5347\u7EA7 DSH \u540E\u91CD\u8BD5\u3002",
  "error.phase": "\u5F53\u524D\u8F93\u5165\u6B63\u88AB\u5360\u7528\uFF08\u63D0\u4EA4\u4E2D\uFF09\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
  "error.disabled": "\u63D0\u793A\u8BCD\u589E\u5F3A\u5DF2\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5173\u95ED\u3002",
  "error.rejected": "\u589E\u5F3A\u8BF7\u6C42\u88AB\u62D2\u7EDD\u3002",
  "error.timeout": "\u589E\u5F3A\u8D85\u65F6\uFF08{seconds} \u79D2\uFF09\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.unconfigured": "\u5C1A\u672A\u786E\u5B9A\u589E\u5F3A\u7528\u7684\u6A21\u578B\uFF1A\u8BF7\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u6210\u5BF9\u586B\u5199 provider/model\uFF0C\u6216\u5148\u5728\u5F53\u524D\u4F1A\u8BDD\u53D1\u9001\u4E00\u6761\u6D88\u606F\uFF08\u5C06\u8DDF\u968F\u4F1A\u8BDD\u6A21\u578B\uFF09\u3002",
  "error.effortUnsupported": "\u8BE5\u6A21\u578B\u4E0D\u652F\u6301\u6240\u9009\u63A8\u7406\u6863\u4F4D\u300C{effort}\u300D\uFF0C\u8BF7\u6539\u9009\u5176\u5B83\u6863\u4F4D\uFF0C\u6216\u6539\u7528\u300C\u8DDF\u968F\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u300D\u3002",
  "error.upstream": "\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.internal": "\u589E\u5F3A\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.client.unreachable": "\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\u670D\u52A1\uFF0C\u8BF7\u786E\u8BA4 dsh web \u6B63\u5728\u8FD0\u884C\u540E\u91CD\u8BD5\u3002",
  "error.client.malformed": "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u6570\u636E\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.client.refused": "\u5BBF\u4E3B\u670D\u52A1\u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF08HTTP {status}\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "error.client.streamClosed": "\u5BBF\u4E3B\u670D\u52A1\u63D0\u524D\u5173\u95ED\u4E86\u589E\u5F3A\u6D41\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.client.cancelled": "\u5DF2\u53D6\u6D88\u589E\u5F3A\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
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
  "settings.saved": "\u5DF2\u4FDD\u5B58",
  "settings.saveFailed": "\u672C\u90E8\u7F72\u6CA1\u6709\u63A5\u53D7\u8FD9\u4E9B\u503C\uFF0C\u5DF2\u4FDD\u7559\u4F9B\u4F60\u4FEE\u6539\u3002",
  "settings.saveFailedShort": "\u4FDD\u5B58\u5931\u8D25",
  "settings.advanced": "\u9AD8\u7EA7\u8BBE\u7F6E",
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
  "settings.routing.pairIncomplete": "provider \u4E0E model \u5FC5\u987B\u6210\u5BF9\u586B\u5199\uFF1B\u53EA\u586B\u4E00\u4E2A\u65F6\u4FDD\u5B58\u540E\u4F1A\u6309\u300C\u8DDF\u968F\u4F1A\u8BDD\u300D\u5904\u7406\u3002",
  "settings.routing.routeUnavailable": "\u8BE5 provider/model \u5F53\u524D\u4E0D\u53EF\u7528\uFF1B\u53EF\u4EE5\u4FDD\u5B58\uFF0C\u4F46\u589E\u5F3A\u8C03\u7528\u53EF\u80FD\u5931\u8D25\u3002\u8BF7\u786E\u8BA4\u6A21\u578B\u670D\u52A1\u5DF2\u914D\u7F6E\u4E14\u6A21\u578B ID \u6B63\u786E\u3002",
  "settings.routing.retry": "\u91CD\u8BD5",
  "settings.row.temperature.label": "\u6E29\u5EA6",
  "settings.row.temperature.hint": "\u91C7\u6837\u6E29\u5EA6\uFF080~1\uFF0C\u6B65\u8FDB 0.05\uFF09\uFF0C\u8D8A\u4F4E\u8D8A\u5FE0\u5B9E\u539F\u6587\uFF1B\u9ED8\u8BA4 0.3\u3002",
  "settings.row.reasoningEffort.label": "\u63A8\u7406\u9884\u7B97",
  "settings.row.reasoningEffort.hint": "\u6863\u4F4D\u9009\u9879\u6765\u81EA\u5F53\u524D provider/model \u7684\u58F0\u660E\uFF1B\u81EA\u5B9A\u4E49\u6A21\u578B\u65F6\u6309\u9700\u8BFB\u53D6\u3002\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u8868\u793A\u4E0D\u4F20\u8BE5\u5B57\u6BB5\u3002",
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
  "settings.row.systemPrompt.placeholder": "\u4F8B\uFF1A\u628A\u7528\u6237\u7684\u4E2D\u6587\u8F93\u5165\u7FFB\u8BD1\u6210\u82F1\u6587\u3002",
  "settings.row.contextMaxMessages.label": "\u4E0A\u4E0B\u6587\u6D88\u606F\u6761\u6570",
  "settings.row.contextMaxMessages.hint": "\u6700\u591A\u53C2\u8003\u6700\u8FD1\u591A\u5C11\u8F6E\u5BF9\u8BDD\uFF1B0 \u8868\u793A\u4E0D\u53C2\u8003\uFF1B\u9ED8\u8BA4 8\u3002",
  "settings.row.contextMaxChars.label": "\u4E0A\u4E0B\u6587\u5B57\u7B26\u4E0A\u9650",
  "settings.row.contextMaxChars.hint": "\u5386\u53F2\u7247\u6BB5\u7684\u5B57\u7B26\u9884\u7B97\uFF1B0 \u8868\u793A\u4E0D\u53C2\u8003\uFF1B\u9ED8\u8BA4 4000\u3002",
  "settings.row.maxConcurrent.label": "\u5E76\u53D1\u4E0A\u9650",
  "settings.row.maxConcurrent.hint": "\u540C\u65F6\u8FDB\u884C\u7684\u589E\u5F3A\u4E0A\u9650\uFF1B\u8FBE\u5230\u4E0A\u9650\u65F6\u65B0\u8BF7\u6C42\u4F1A\u63D0\u793A\u7A0D\u540E\u518D\u8BD5\u3002\u9ED8\u8BA4 2\u3002",
  "settings.row.rateLimitPerMinute.label": "\u6BCF\u5206\u949F\u8C03\u7528\u4E0A\u9650",
  "settings.row.rateLimitPerMinute.hint": "\u6BCF\u5206\u949F\u589E\u5F3A\u6B21\u6570\u4E0A\u9650\uFF08\u6ED1\u52A8\u7A97\u53E3\uFF09\uFF1B\u8D85\u9650\u65F6\u63D0\u793A\u7A0D\u540E\u518D\u8BD5\u3002\u9ED8\u8BA4 10\u3002",
  "settings.row.shortcut.label": "\u5FEB\u6377\u952E",
  "settings.row.shortcut.hint": "\u9ED8\u8BA4\u7559\u7A7A\uFF08\u7981\u7528\uFF09\uFF1B\u586B\u5199\u540E\u751F\u6548\uFF0C\u4F8B\uFF1Actrl+alt+shift+e\uFF08\u987B\u5305\u542B ctrl/alt/meta \u4E2D\u81F3\u5C11\u4E00\u4E2A\u4FEE\u9970\u952E\uFF09\u3002",
  "settings.row.shortcut.placeholder": "\u4F8B\uFF1Actrl+alt+shift+e",
  "settings.strategy.replace": "\u66FF\u6362\u5185\u7F6E\u7B56\u7565",
  "settings.strategy.extend": "\u8FFD\u52A0\u5728\u5185\u7F6E\u7B56\u7565\u540E",
  "settings.reasoning.inherit": "\u63D0\u4F9B\u65B9\u9ED8\u8BA4",
  "settings.reasoning.loading": "\u6B63\u5728\u8BFB\u53D6\u8BE5\u6A21\u578B\u7684\u6863\u4F4D\u2026",
  "settings.reasoning.unavailable": "\u65E0\u6CD5\u8BFB\u53D6\u8BE5\u6A21\u578B\u7684\u6863\u4F4D\u5217\u8868\uFF1B\u5DF2\u4FDD\u5B58\u7684\u6863\u4F4D\u4ECD\u4F1A\u7167\u5E38\u53D1\u9001\u3002",
  "settings.reasoning.noTiers": "\u8BE5\u6A21\u578B\u672A\u58F0\u660E\u63A8\u7406\u6863\u4F4D\uFF0C\u8C03\u7528\u65F6\u5C06\u8DDF\u968F\u63D0\u4F9B\u65B9\u9ED8\u8BA4\u3002",
  "settings.reasoning.unsupported": "\u5F53\u524D\u503C\u300C{effort}\u300D\u4E0D\u5728\u8BE5\u6A21\u578B\u652F\u6301\u7684\u6863\u4F4D\u4E2D\u3002",
  "settings.reasoning.current": "\u5F53\u524D\u503C\uFF1A{value}",
  "settings.reasoning.currentTitle": "\u8BE5\u6A21\u578B\u672A\u58F0\u660E\u6B64\u6863\u4F4D",
  "settings.reasoning.refresh": "\u91CD\u65B0\u83B7\u53D6\u6863\u4F4D\u4FE1\u606F",
  "settings.reasoning.refreshing": "\u6B63\u5728\u83B7\u53D6\u6863\u4F4D\u4FE1\u606F\u2026",
  "settings.reasoning.refreshOk": "\u6863\u4F4D\u4FE1\u606F\u5DF2\u66F4\u65B0",
  "settings.reasoning.refreshFailed": "\u83B7\u53D6\u6863\u4F4D\u4FE1\u606F\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
};
var en = {
  "button.title": "Enhance prompt",
  "button.busy": "Enhancing\u2026",
  "button.otherBusy": "Another session is enhancing right now \u2014 wait for it, or close its result panel first.",
  "button.emptyTitle": "Enhance prompt (the input is empty \u2014 type something first)",
  "panel.title": "Prompt Enhance",
  "panel.loading": "Enhancing, please wait\u2026",
  "panel.streaming": "Generating\u2026",
  "panel.loading.hint": "Your draft stays untouched until you apply the result.",
  "panel.cancel": "Cancel",
  "panel.original": "Original prompt",
  "panel.enhanced": "Enhanced result",
  "panel.apply": "Fill into input box",
  "panel.regenerate": "Regenerate",
  "panel.appliedShort": "Replaced \u2713",
  "panel.undoneShort": "Undone \u2713",
  "panel.regeneratedShort": "Regenerated \u2713",
  "panel.copiedShort": "Copied \u2713",
  "panel.copy": "Copy result",
  "panel.copied": "Copied",
  "panel.copyFailed": "Copy failed",
  "panel.close": "Close",
  "panel.retry": "Retry",
  "panel.stale.warn": "Draft changed \u2014 this result uses the earlier text; Apply overwrites the current input (undoable).",
  "panel.truncated": 'Output hit the token cap and may be incomplete. Raise "Max output tokens" in the settings.',
  "panel.model": "Model: {provider} / {model}",
  "panel.elapsed": "{ms} elapsed",
  "panel.tokens": "{total} tokens",
  "panel.tokens.input": "Input {count}",
  "panel.tokens.output": "Output {count}",
  "panel.tokens.cacheRead": "Cache read {count}",
  "panel.tokens.cacheWrite": "Cache write {count}",
  "undo.applied": "Original draft replaced",
  "undo.undo": "Undo",
  "undo.dismiss": "Dismiss",
  "error.empty": "The input box is empty \u2014 type a prompt to enhance first.",
  "error.tooLong": "The draft is {count} characters, above the {max} cap (Unicode characters, not tokens). It is never auto-truncated (that would change your meaning) \u2014 please shorten it.",
  "error.occurrences": "The draft contains commands or file references, which are not supported yet \u2014 remove them first.",
  "error.chipsUnknown": "The composer reference state could not be read on this host, so the enhancement was blocked to avoid overwriting a command or file reference. Clear the input box and type plain text, or update DSH, then retry.",
  "error.phase": "The input box is busy (submitting) \u2014 try again in a moment.",
  "error.disabled": "Prompt enhance is disabled in the plugin settings.",
  "error.rejected": "The enhance request was rejected.",
  "error.timeout": "The enhancement timed out ({seconds}s). Retry; your draft is untouched.",
  "error.unconfigured": "No model resolved for the enhancement: pair provider/model in the plugin settings, or send a message in the current session first (the enhancement will follow the session model).",
  "error.effortUnsupported": 'This model does not support the selected reasoning effort "{effort}". Choose another tier, or use "follow provider default".',
  "error.upstream": "The model provider returned an error. Retry; your draft is untouched.",
  "error.internal": "Enhancement failed. Retry; your draft is untouched.",
  "error.client.unreachable": "Cannot reach the host service \u2014 make sure dsh web is running, then retry.",
  "error.client.malformed": "The host returned data that could not be parsed. Retry; your draft is untouched.",
  "error.client.refused": "The host refused the request (HTTP {status}). Retry later.",
  "error.client.streamClosed": "The host closed the enhance stream early. Retry; your draft is untouched.",
  "error.client.cancelled": "The enhancement was cancelled; your draft is untouched.",
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
  "settings.saved": "Saved",
  "settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
  "settings.saveFailedShort": "Save failed",
  "settings.advanced": "Advanced",
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
  "settings.routing.pairIncomplete": "provider and model must be set together; with only one filled, the save follows the session instead.",
  "settings.routing.routeUnavailable": "This provider/model is currently unavailable; you can still save, but enhancement calls may fail. Check that model services are configured and the model id is correct.",
  "settings.routing.retry": "Retry",
  "settings.row.temperature.label": "Temperature",
  "settings.row.temperature.hint": "Sampling temperature (0\u20131, step 0.05); lower stays closer to the original. Default 0.3.",
  "settings.row.reasoningEffort.label": "Reasoning effort",
  "settings.row.reasoningEffort.hint": "Tier choices come from what the configured provider/model declares; custom models are read on demand. Provider default omits the field.",
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
  "settings.row.maxConcurrent.hint": "Concurrent enhancement limit; a new request past the limit is told to retry later. Default 2.",
  "settings.row.rateLimitPerMinute.label": "Calls per minute",
  "settings.row.rateLimitPerMinute.hint": "Successful enhancements per minute (sliding window); past the limit the request is told to retry later. Default 10.",
  "settings.row.shortcut.label": "Shortcut",
  "settings.row.shortcut.hint": "Empty by default (disabled); set it to enable, e.g. ctrl+alt+shift+e (needs at least one of ctrl/alt/meta).",
  "settings.row.shortcut.placeholder": "e.g. ctrl+alt+shift+e",
  "settings.strategy.replace": "Replace the built-in strategy",
  "settings.strategy.extend": "Append after the built-in strategy",
  "settings.reasoning.inherit": "Provider default",
  "settings.reasoning.loading": "Reading this model\u2019s tiers\u2026",
  "settings.reasoning.unavailable": "Could not read this model\u2019s tier list; your saved tier is still sent.",
  "settings.reasoning.noTiers": "This model declares no reasoning tiers; calls follow the provider default.",
  "settings.reasoning.unsupported": "The current value \u201C{effort}\u201D is not one of this model\u2019s tiers.",
  "settings.reasoning.current": "Current value: {value}",
  "settings.reasoning.currentTitle": "This model does not declare this tier",
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
.dsh-pe-dock { width: 100%; }
.dsh-pe-panel {
  box-sizing: border-box;
  --pe-bg: var(--dsw-alias-bg-layer-1, #1f2127);
  --pe-fg: var(--dsw-alias-label-primary, #e6e8ee);
  --pe-fg-dim: var(--dsw-alias-label-secondary, rgba(230, 232, 238, 0.55));
  --pe-border: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));
  --pe-separator: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.25));
  /* No hover token exists: a neutral grey alpha is already theme-agnostic. */
  --pe-hover: rgba(127, 127, 127, 0.18);
  --pe-danger: var(--dsw-alias-state-error-primary, #ffb4a8);
  --pe-warn-fg: var(--dsw-alias-state-warn-primary, #e8c07d);
  /* Tints of the themed warning color, so the banner cannot keep an amber cast
     from the other scheme. */
  --pe-warn-border: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e8c07d) 35%, transparent);
  --pe-warn-bg: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e8c07d) 12%, transparent);
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 6px;
  border-radius: 12px;
  border: 1px solid var(--pe-border);
  background: var(--pe-bg);
  color: var(--pe-fg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 14px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.dsh-pe-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--pe-separator);
  font-size: 12.5px;
  font-weight: 600;
}
.dsh-pe-head .dsh-pe-title { display: inline-flex; align-items: center; gap: 6px; }
.dsh-pe-head .dsh-pe-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  min-width: 0;
}
.dsh-pe-head .dsh-pe-badge {
  margin-left: 0;
  border: 1px solid var(--pe-border);
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 400;
  font-size: 11px;
  opacity: 0.72;
  white-space: nowrap;
}
.dsh-pe-applied {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 999px;
  color: var(--dsw-alias-state-success-primary, #2da44e);
  border: 1px solid currentColor;
  white-space: nowrap;
}
.dsh-pe-close {
  border: none; background: transparent; color: inherit; opacity: 0.6;
  font-size: 15px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
}
.dsh-pe-close:hover { opacity: 1; background: var(--pe-hover); }
.dsh-pe-result { padding: 2px 10px 6px; }
.dsh-pe-result-text {
  margin: 0;
  max-height: 30vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.6;
}
.dsh-pe-col-title {
  padding: 4px 10px 2px;
  font-size: 11px;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.dsh-pe-error {
  padding: 10px;
  font-size: 12.5px;
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
  flex: 1; padding: 14px 10px; font-size: 12.5px;
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
  border: 2px solid var(--pe-separator); border-top-color: var(--dsw-alias-brand-primary, #6ea8ff);
  animation: dsh-pe-spin 0.9s linear infinite;
}
.dsh-pe-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--pe-separator);
}
.dsh-pe-foot .dsh-pe-grow { flex: 1; }
.dsh-pe-btn-action {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--pe-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.dsh-pe-btn-action.primary {
  min-width: 112px;
  border-color: transparent;
  /* Fill and label are a PAIR: the alias layer flips brand-primary from
     near-black (light theme) to near-white (dark theme), so the label has to
     flip with it \u2014 a hardcoded foreground turns the dark theme into
     white-on-white. label-primary-inverted is the color the shell itself
     paints onto an inverted surface; the fallback chain keeps an inverted label
     on hosts that predate that token. */
  background: var(--dsw-alias-brand-primary, #3f76e1);
  color: var(--dsw-alias-label-primary-inverted, var(--dsw-alias-bg-base, #ffffff));
}
.dsh-pe-btn-action.primary:hover {
  /* Blend toward the panel surface, not toward white: in the dark theme white
     IS the fill, so a white-ward blend would show no hover change at all. */
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #3f76e1) 88%, var(--dsw-alias-bg-layer-1, #1f2127));
}
.dsh-pe-btn-action.plain { background: transparent; color: inherit; }
.dsh-pe-btn-action.plain:hover { background: var(--pe-hover); }
.dsh-pe-btn-action.dsh-pe-copy { min-width: 96px; }
.dsh-pe-btn-action:disabled { opacity: 0.45; cursor: default; }

.dsh-pe-stale {
  padding: 6px 10px;
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
.dsh-pe-btn.is-busy { cursor: progress; }
.dsh-pe-btn.is-blocked { cursor: progress; }
.dsh-pe-btn.is-empty { opacity: 0.4; cursor: not-allowed; }
.dsh-pe-btn.is-empty:hover { opacity: 0.4; background: transparent; }
.dsh-pe-btn:disabled { opacity: 0.45; cursor: default; }
.dsh-pe-btn .dsh-pe-btn-icon { display: inline-flex; align-items: center; }
@keyframes dsh-pe-spin { to { transform: rotate(360deg); } }

.dsh-pe-undo {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  margin-left: auto;
  padding: 3px 6px 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.32));
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1, transparent);
  font-size: 12px;
  color: inherit;
}
.dsh-pe-undo .dsh-pe-undo-check {
  color: var(--dsw-alias-state-success-primary, #2da44e);
  font-weight: 600;
}
.dsh-pe-undo-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.32));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 120ms ease;
}
.dsh-pe-undo-link:hover { background: rgba(127, 127, 127, 0.16); }
.dsh-pe-undo-link:active { background: rgba(127, 127, 127, 0.22); }
.dsh-pe-undo-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.55;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
}
.dsh-pe-undo-x:hover { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.12)); }
.dsh-pe-segmented-labels [role="tab"] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  white-space: nowrap;
}
.dsh-pe-advanced {
  margin-top: 12px;
  border-top: 1px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.22));
}
.dsh-pe-advanced > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 4px;
  list-style: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, inherit);
  cursor: pointer;
  user-select: none;
}
.dsh-pe-advanced > summary::-webkit-details-marker { display: none; }
.dsh-pe-advanced > summary::marker { content: ''; }
.dsh-pe-advanced > summary::before {
  content: '';
  flex: none;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid currentColor;
  transition: transform 120ms ease;
}
.dsh-pe-advanced[open] > summary::before { transform: rotate(90deg); }
.dsh-pe-advanced > summary:hover {
  color: var(--dsw-alias-label-primary, inherit);
  background: rgba(127, 127, 127, 0.08);
  border-radius: 6px;
}
.dsh-pe-advanced > summary:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f8cff);
  outline-offset: -2px;
  border-radius: 6px;
}
.dsh-pe-advanced[open] > summary { margin-bottom: 4px; }
.dsh-pe-advanced + .dsh-pe-form-footer { margin-top: 0; }
.dsh-pe-chip-reset:hover:not(:disabled),
.dsh-pe-chip-refresh:hover:not(:disabled) {
  --pe-chip-bg: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.18));
  --pe-chip-color: var(--dsw-alias-label-primary, inherit);
}
.dsh-pe-chip-reset:focus-visible,
.dsh-pe-chip-refresh:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f8cff);
  outline-offset: 2px;
}
.dsh-pe-form-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.22));
}
.dsh-pe-save-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  margin-left: auto;
}
.dsh-pe-save-status {
  min-width: 0;
  max-width: 100%;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, inherit);
  text-align: right;
  overflow-wrap: anywhere;
}
.dsh-pe-save-button {
  flex: none;
  margin-left: 0;
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.32));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-pe-save-button:hover:not(:disabled) { background: rgba(127, 127, 127, 0.12); }
.dsh-pe-save-button:disabled { opacity: 0.5; cursor: default; }
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
    ctx.effect(
      () => () => {
        try {
          unsubscribeForm?.();
        } catch {
        }
      },
      "dsh-prompt-enhance: settings form mirror"
    );
    try {
      const watch = forms.describe?.()?.subscribe?.(() => bind());
      if (typeof watch === "function") {
        ctx.effect(
          () => () => {
            try {
              watch();
            } catch {
            }
          },
          "dsh-prompt-enhance: settings namespace watch"
        );
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
    ctx.effect(
      () => () => {
        try {
          unsubscribe?.();
        } catch {
        }
      },
      "dsh-prompt-enhance: settings binder mirror"
    );
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
    ctx.effect(
      () => () => {
        try {
          unsubscribe?.();
        } catch {
        }
      },
      "dsh-prompt-enhance: settings scope mirror"
    );
  });
}

// src/client/settings-page.tsx
var import_react9 = require("react");

// src/client/llm-catalog.ts
var import_react7 = require("react");

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
  return value.providers.filter(
    (entry) => entry !== null && typeof entry === "object" && typeof entry.id === "string" && entry.id !== "" && typeof entry.name === "string" && entry.name !== "" && typeof entry.registered === "boolean"
  );
}
async function fetchModels(provider, signal) {
  const value = await getJson(endpoint(LLM_MODELS_ENDPOINT, { provider }), signal);
  if (value === void 0 || !Array.isArray(value.models)) return void 0;
  const models = value.models.filter(
    (entry) => entry !== null && typeof entry === "object" && typeof entry.id === "string" && entry.id !== "" && typeof entry.name === "string" && entry.name !== ""
  ).map((entry) => ({
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
  const [providers, setProviders] = (0, import_react7.useState)([]);
  const [providersLoading, setProvidersLoading] = (0, import_react7.useState)(true);
  const [providersFailed, setProvidersFailed] = (0, import_react7.useState)(false);
  const [providersToken, setProvidersToken] = (0, import_react7.useState)(0);
  const [models, setModels] = (0, import_react7.useState)([]);
  const [modelsLoading, setModelsLoading] = (0, import_react7.useState)(false);
  const [modelsFailed, setModelsFailed] = (0, import_react7.useState)(false);
  const [modelsToken, setModelsToken] = (0, import_react7.useState)(0);
  const [routeChecking, setRouteChecking] = (0, import_react7.useState)(false);
  const [routeAvailable, setRouteAvailable] = (0, import_react7.useState)(void 0);
  (0, import_react7.useEffect)(() => {
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
  (0, import_react7.useEffect)(() => {
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
  (0, import_react7.useEffect)(() => {
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

// src/client/settings-page-spec.ts
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var SETTINGS_SECTION_SLOT = "settings.section";
var SETTINGS_SECTION_ID = "dsh-prompt-enhance";
var SETTINGS_SECTION_ORDER = 70;
var SETTINGS_SECTION_LABEL = "\u63D0\u793A\u8BCD\u589E\u5F3A";
var SETTINGS_ROW_CONFIG_SLOT = "plugins.row.config";
var SETTINGS_NAMESPACE = "dsh-prompt-enhance";
var SETTINGS_BUNDLE = true ? "@surfishs/dsh-prompt-enhance" : "@surfishs/dsh-prompt-enhance";
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
var BASIC_ROWS = [
  { key: "enabled", kind: "boolean", label: "settings.row.enabled.label", hint: "settings.row.enabled.hint" },
  { key: "provider", kind: "provider", label: "settings.row.provider.label", hint: "settings.row.provider.hint" },
  { key: "model", kind: "model", label: "settings.row.model.label", hint: "settings.row.model.hint" },
  { key: "reasoningEffort", kind: "reasoning", label: "settings.row.reasoningEffort.label", hint: "settings.row.reasoningEffort.hint" },
  { key: "temperature", kind: "number", label: "settings.row.temperature.label", hint: "settings.row.temperature.hint" },
  { key: "contextAware", kind: "boolean", label: "settings.row.contextAware.label", hint: "settings.row.contextAware.hint" },
  { key: "streaming", kind: "boolean", label: "settings.row.streaming.label", hint: "settings.row.streaming.hint" },
  { key: "systemPrompt", kind: "text", label: "settings.row.systemPrompt.label", hint: "settings.row.systemPrompt.hint", placeholder: "settings.row.systemPrompt.placeholder" },
  { key: "shortcut", kind: "text", label: "settings.row.shortcut.label", hint: "settings.row.shortcut.hint", placeholder: "settings.row.shortcut.placeholder" }
];
var ADVANCED_ROWS = [
  { key: "strategyMode", kind: "strategy", label: "settings.row.strategyMode.label", hint: "settings.row.strategyMode.hint" },
  { key: "maxInputChars", kind: "number", label: "settings.row.maxInputChars.label", hint: "settings.row.maxInputChars.hint" },
  { key: "maxOutputTokens", kind: "number", label: "settings.row.maxOutputTokens.label", hint: "settings.row.maxOutputTokens.hint" },
  { key: "timeoutMs", kind: "number", label: "settings.row.timeoutMs.label", hint: "settings.row.timeoutMs.hint" },
  { key: "contextMaxMessages", kind: "number", label: "settings.row.contextMaxMessages.label", hint: "settings.row.contextMaxMessages.hint" },
  { key: "contextMaxChars", kind: "number", label: "settings.row.contextMaxChars.label", hint: "settings.row.contextMaxChars.hint" },
  { key: "maxConcurrent", kind: "number", label: "settings.row.maxConcurrent.label", hint: "settings.row.maxConcurrent.hint" },
  { key: "rateLimitPerMinute", kind: "number", label: "settings.row.rateLimitPerMinute.label", hint: "settings.row.rateLimitPerMinute.hint" }
];
var ROWS = [...BASIC_ROWS, ...ADVANCED_ROWS];
function descriptorOf(row) {
  switch (row.kind) {
    case "number":
      return (0, import_dsh_client_ui_primitives.settingsNumberField)(row.key);
    case "boolean":
      return settingsBooleanField(row.key);
    case "strategy":
      return settingsEnumField(
        row.key,
        STRATEGY_OPTIONS.map((option) => option.value)
      );
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
function defaultTextOf(key) {
  const descriptor = FIELD_SPECS.find((item) => item.field === key);
  const fallback = DEFAULT_VALUES[key];
  if (descriptor === void 0 || fallback === void 0) return "";
  try {
    return descriptor.format(fallback);
  } catch {
    return "";
  }
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

// src/client/settings-page-copy.ts
var ZH_COPY = zh;
function translator(t) {
  if (typeof t === "function") return t;
  return ((key, params) => {
    let text = ZH_COPY[key] ?? key;
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.split(`{${name}}`).join(String(value));
    }
    return text;
  });
}
function sectionCopy(t, chinese) {
  return {
    labels: {
      unavailable: t("settings.unavailable"),
      readOnly: t("settings.readOnly"),
      saveFailed: t("settings.saveFailed"),
      saveFailedShort: t("settings.saveFailedShort"),
      save: t("settings.save"),
      saving: t("settings.saving"),
      saved: t("settings.saved"),
      advanced: t("settings.advanced"),
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
      saveFailedShort: t("settings.saveFailedShort"),
      save: t("settings.save"),
      saving: t("settings.saving"),
      saved: t("settings.saved"),
      advanced: t("settings.advanced"),
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

// src/client/settings-page-controls.tsx
var import_react8 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

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

// src/client/settings-page-styles.ts
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
  background: "var(--pe-chip-bg, var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.12)))",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: "17px",
  color: "var(--pe-chip-color, var(--dsw-alias-label-secondary, inherit))",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  cursor: "pointer"
};
var REFRESH_STYLE = { ...CHIP_STYLE, flex: "none" };
var RESET_STYLE = CHIP_STYLE;
var FIELD_BORDER = "1px solid rgba(128, 128, 128, 0.38)";
var INPUT_STYLE = {
  boxSizing: "border-box",
  width: "100%",
  height: 34,
  padding: "0 12px",
  border: FIELD_BORDER,
  borderRadius: "var(--dsw-radius-md, 8px)",
  background: "var(--dsw-alias-bg-layer-3, transparent)",
  font: "inherit",
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-primary, inherit)",
  outline: "none"
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
  cursor: "pointer"
};
var SEPARATOR_STYLE = {
  borderTop: "0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.24))"
};
var REPOSITORY_URL = "https://github.com/surfishs/dsh-prompt-enhance";
var NPM_URL = "https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance";
var GITHUB_MARK = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z";
var NPM_MARK = "M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z";
var PLUGIN_VERSION = true ? "0.0.9" : "0.0.0";
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

// src/client/settings-page-controls.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function OverrideActions(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dsh-pe-chip-reset", style: { ...RESET_STYLE, ...props.disabled ? { opacity: 0.5, cursor: "default" } : {} }, disabled: props.disabled, onClick: props.onReset, children: props.copy.labels.reset });
}
function BooleanRow(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives2.Switch, { checked: props.view.text === "true", disabled: props.disabled, label: props.label, onChange: (next) => props.onEdit(next ? "true" : "false") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: HINT_STYLE, children: props.hint })
  ] });
}
function ChoiceRow(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_dsh_client_ui_primitives2.SegmentedControl,
      {
        id: props.id,
        className: "dsh-pe-segmented-labels",
        value: props.view.text,
        options: props.options.map((option) => ({ ...option, title: option.title ?? option.label })),
        disabled: props.disabled,
        label: props.label,
        onChange: (next) => props.onEdit(next)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: HINT_STYLE, children: props.hint })
  ] });
}
function ReasoningRow(props) {
  const pair = props.provider !== "" && props.model !== "" ? `${props.provider}/${props.model}` : "";
  const [phase, setPhase] = (0, import_react8.useState)("loading");
  const [capabilities, setCapabilities] = (0, import_react8.useState)(void 0);
  const [refreshToken, setRefreshToken] = (0, import_react8.useState)(0);
  const [feedback, setFeedback] = (0, import_react8.useState)("idle");
  const forceRef = (0, import_react8.useRef)(false);
  const feedbackTimer = (0, import_react8.useRef)(void 0);
  (0, import_react8.useEffect)(() => {
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
    fetchReasoningCapabilities(props.provider === "" ? void 0 : props.provider, props.model === "" ? void 0 : props.model, { refresh: force, signal: controller.signal }).then((answer) => {
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
  const current2 = props.view.text;
  const realTierKnown = phase === "ready" && capabilities !== void 0 && capabilities.source !== "unavailable" && capabilities.efforts.some((effort) => effort.id === current2);
  const noTiers = phase === "ready" && capabilities !== void 0 && capabilities.source === "unavailable" && capabilities.reason === "no-efforts";
  const options = [];
  if (!noTiers && current2 !== "" && current2 !== "inherit" && !realTierKnown) {
    options.push({
      value: current2,
      label: props.copy.interpolate("settings.reasoning.current", { value: current2 }),
      title: props.copy.choice("settings.reasoning.currentTitle")
    });
  }
  if (phase === "ready" && capabilities !== void 0 && capabilities.source !== "unavailable") {
    for (const effort of capabilities.efforts) {
      options.push({
        value: effort.id,
        label: effort.name,
        title: effort.description === void 0 ? effort.name : `${effort.name} \u2014 ${effort.description}`
      });
    }
  }
  options.push({
    value: "inherit",
    label: props.copy.choice("settings.reasoning.inherit"),
    title: props.copy.choice("settings.reasoning.inherit")
  });
  const unsupported = !noTiers && phase === "ready" && capabilities?.source !== "unavailable" && current2 !== "" && current2 !== "inherit" && !realTierKnown;
  const refreshing = feedback === "refreshing";
  const refresh = () => {
    forceRef.current = true;
    setRefreshToken((token) => token + 1);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: LABEL_STYLE, children: props.label }),
      phase === "ready" || refreshing ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dsh-pe-chip-refresh", style: { ...REFRESH_STYLE, opacity: props.disabled || refreshing ? 0.5 : 1 }, disabled: props.disabled || refreshing, onClick: refresh, children: props.copy.choice(refreshing ? "settings.reasoning.refreshing" : "settings.reasoning.refresh") }) : null,
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_dsh_client_ui_primitives2.SegmentedControl,
      {
        id: props.id,
        className: "dsh-pe-segmented-labels",
        value: noTiers ? "inherit" : props.view.text,
        options,
        disabled: props.disabled,
        label: props.label,
        onChange: (next) => props.onEdit(next)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    phase === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.reasoning.loading") }) : null,
    phase === "ready" && capabilities?.source === "unavailable" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice(noTiers ? "settings.reasoning.noTiers" : "settings.reasoning.unavailable") }) : null,
    unsupported ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, children: props.copy.interpolate("settings.reasoning.unsupported", { effort: props.view.text }) }) : null,
    feedback === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, "aria-live": "polite", children: props.copy.choice("settings.reasoning.refreshOk") }) : null,
    feedback === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, "aria-live": "polite", children: props.copy.choice("settings.reasoning.refreshFailed") }) : null
  ] });
}
function SelectControl(props) {
  const [focused, setFocused] = (0, import_react8.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("label", { htmlFor: props.id, style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(SelectControl, { id: props.id, value: current2, disabled: props.disabled, onChange: (value) => props.onEdit(value), children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: "", children: props.copy.choice("settings.routing.followSession") }),
      missing ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: current2, title: current2, children: props.copy.interpolate("settings.routing.currentProvider", { value: current2 }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("optgroup", { label: props.copy.choice("settings.routing.groupRegistered"), children: props.routing.providers.entries.filter((entry) => entry.registered).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: entry.id, title: entry.id, children: entry.name }, entry.id)) }),
      props.routing.providers.entries.some((entry) => !entry.registered) ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("optgroup", { label: props.copy.choice("settings.routing.groupDormant"), children: props.routing.providers.entries.filter((entry) => !entry.registered).map((entry) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("option", { value: entry.id, disabled: true, title: props.copy.choice("settings.routing.unconfiguredTitle"), children: [
        entry.name,
        props.copy.choice("settings.routing.unconfiguredSuffix")
      ] }, entry.id)) }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    props.routing.providers.loading ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.providersLoading") }) : null,
    props.routing.providers.failed ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.providersFailed") }) : null,
    props.routing.providers.failed ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", style: REFRESH_STYLE, onClick: props.routing.providers.reload, children: props.copy.choice("settings.routing.retry") }) : null,
    missing ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: WARN_STYLE, children: props.copy.interpolate("settings.routing.providerMissing", { value: current2 }) }) : null,
    unconfigured ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: WARN_STYLE, children: props.copy.interpolate("settings.routing.providerUnconfigured", { name: known.name }) }) : null
  ] });
}
function ModelRow(props) {
  const current2 = props.view.text;
  const provider = props.providerValue;
  const [customMode, setCustomMode] = (0, import_react8.useState)(false);
  const known = props.routing.models.entries.some((entry) => entry.id === current2);
  const showCustom = provider !== "" && (customMode || current2 !== "" && !known);
  const pairIncomplete = provider !== "" && current2 === "";
  const routeUnavailable = provider !== "" && current2 !== "" && props.routing.route.available === false;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("label", { htmlFor: props.id, style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
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
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: "", children: provider === "" ? props.copy.choice("settings.routing.followSession") : props.copy.choice("settings.routing.selectModel") }),
          props.routing.models.entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: entry.id, title: entry.id, children: entry.name }, entry.id)),
          provider !== "" && current2 !== "" && !known ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: current2, title: current2, children: props.copy.interpolate("settings.routing.currentModel", { value: current2 }) }) : null,
          provider !== "" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("option", { value: "__custom__", children: props.copy.choice("settings.routing.custom") }) : null
        ]
      }
    ),
    showCustom ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TextControl, { value: current2, placeholder: props.copy.choice("settings.routing.customPlaceholder"), disabled: props.disabled, onChange: props.onEdit }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    props.routing.models.loading ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.modelsLoading") }) : null,
    props.routing.models.failed && !showCustom ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: STATUS_STYLE, children: props.copy.choice("settings.routing.modelsFailed") }) : null,
    pairIncomplete ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: WARN_STYLE, children: props.copy.choice("settings.routing.pairIncomplete") }) : null,
    routeUnavailable ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: WARN_STYLE, children: props.copy.choice("settings.routing.routeUnavailable") }) : null
  ] });
}
function TextControl(props) {
  const [focused, setFocused] = (0, import_react8.useState)(false);
  const [revealedInvalid, setRevealedInvalid] = (0, import_react8.useState)(false);
  (0, import_react8.useEffect)(() => {
    if (props.invalid !== true) setRevealedInvalid(false);
  }, [props.invalid]);
  const showInvalid = props.invalid === true && revealedInvalid;
  const borderColor = showInvalid ? "var(--dsw-alias-state-error-primary, #f85149)" : focused ? "var(--dsw-alias-state-business-primary, #4f8cff)" : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "input",
    {
      id: props.id,
      type: "text",
      inputMode: props.numeric === true ? "numeric" : void 0,
      "aria-invalid": showInvalid || void 0,
      disabled: props.disabled,
      placeholder: props.placeholder,
      value: props.value,
      style: {
        ...INPUT_STYLE,
        ...props.disabled === true ? { color: "var(--dsw-alias-label-tertiary, inherit)", cursor: "default" } : {},
        ...borderColor === void 0 ? {} : { borderColor }
      },
      onFocus: () => setFocused(true),
      onBlur: () => {
        setFocused(false);
        if (props.invalid === true) setRevealedInvalid(true);
        props.onCommit?.();
      },
      onKeyDown: (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (props.invalid === true) setRevealedInvalid(true);
        props.onCommit?.();
      },
      onChange: (event) => props.onChange(event.target.value)
    }
  );
}
function ValueRow(props) {
  const invalid = props.view.invalid;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: ROW_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: HEAD_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("label", { htmlFor: props.id, style: LABEL_STYLE, children: props.label }),
      props.view.overridden ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(OverrideActions, { copy: props.copy, disabled: props.disabled, onReset: props.onReset }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      TextControl,
      {
        id: props.id,
        value: props.view.text,
        placeholder: props.placeholder,
        numeric: props.numeric,
        invalid,
        disabled: props.disabled,
        onChange: props.onEdit,
        onCommit: props.onCommit
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: HINT_STYLE, children: props.hint }),
    invalid ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { style: INVALID_STYLE, children: props.copy.labels.invalidNumber }) : null
  ] });
}

// src/client/settings-page.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function sectionTitle(getLocale) {
  try {
    const t = getLocale?.()?.bind(NS);
    return t === void 0 ? SETTINGS_SECTION_LABEL : t("settings.title");
  } catch {
    return SETTINGS_SECTION_LABEL;
  }
}
function PageHeader(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: HEADER_STYLE, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: HEADER_ROW_STYLE, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: HEADER_TITLE_STYLE, children: props.title }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("a", { href: REPOSITORY_URL, target: "_blank", rel: "noreferrer", style: HEADER_LINK_STYLE, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("svg", { width: 11, height: 11, viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { fill: "currentColor", d: GITHUB_MARK }) }),
        "GitHub"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("a", { href: NPM_URL, target: "_blank", rel: "noreferrer", style: HEADER_LINK_STYLE, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("svg", { width: 11, height: 11, viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { fill: "currentColor", d: NPM_MARK }) }),
        "npm"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("span", { style: HEADER_VERSION_STYLE, children: [
        "v",
        props.version
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { style: HEADER_DESCRIPTION_STYLE, children: props.description })
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
    onReset: props.onReset,
    onCommit: props.onCommit
  };
  switch (props.row.kind) {
    case "boolean":
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BooleanRow, { ...shared });
    case "strategy":
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ChoiceRow, { ...shared, options: STRATEGY_OPTIONS.map((option) => ({ value: option.value, label: props.copy.choice(option.label) })) });
    case "reasoning":
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ReasoningRow, { ...shared, provider: props.reasoningPair.provider, model: props.reasoningPair.model });
    case "provider":
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ProviderRow, { ...shared, routing: props.routing });
    case "model":
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ModelRow, { ...shared, routing: props.routing, providerValue: props.providerValue });
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ValueRow, { ...shared, numeric: props.row.kind === "number", placeholder: props.copy.placeholder(props.row) });
  }
}
function SettingsRows(props) {
  const provider = viewOf(props.state, "provider").text.trim();
  const model = viewOf(props.state, "model").text.trim();
  const routing = useLlmRouting(provider, model);
  const [saveState, setSaveState] = (0, import_react9.useState)("idle");
  const timers = (0, import_react9.useRef)(/* @__PURE__ */ new Map());
  const savedTimer = (0, import_react9.useRef)(void 0);
  const savedValues = (0, import_react9.useRef)(/* @__PURE__ */ new Map());
  const sequence = (0, import_react9.useRef)(0);
  (0, import_react9.useEffect)(() => {
    for (const row of ROWS) {
      if (!savedValues.current.has(row.key)) {
        savedValues.current.set(row.key, viewOf(props.state, row.key).text);
      }
    }
  }, [props.state]);
  const runSave = async (key, text) => {
    if (props.writeField === void 0) return;
    if (savedValues.current.get(key) === text) return;
    const ticket = ++sequence.current;
    setSaveState("saving");
    const result = await props.writeField(key, text);
    if (ticket !== sequence.current) return;
    if (result === "invalid") {
      setSaveState("idle");
      return;
    }
    if (result === "failed") {
      setSaveState("failed");
      return;
    }
    savedValues.current.set(key, text);
    markSaved();
  };
  const markSaved = () => {
    setSaveState("saved");
    if (savedTimer.current !== void 0) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      setSaveState("idle");
      savedTimer.current = void 0;
    }, 2e3);
  };
  const runReset = async (key, fallback) => {
    if (props.writeField === void 0) return;
    const ticket = ++sequence.current;
    setSaveState("saving");
    const result = await props.writeField(key, "");
    if (ticket !== sequence.current) return;
    if (result === "failed") {
      setSaveState("failed");
      return;
    }
    if (result === "invalid") {
      setSaveState("idle");
      return;
    }
    savedValues.current.set(key, fallback);
    markSaved();
  };
  const resetAndSave = (key) => {
    props.resetField(key);
    const fallback = defaultTextOf(key);
    savedValues.current.set(key, fallback);
    void runReset(key, fallback);
  };
  const manualSave = async () => {
    if (props.writeField === void 0) {
      props.save?.();
      markSaved();
      return;
    }
    const changed = ROWS.map((row) => ({ key: row.key, text: viewOf(props.state, row.key).text })).filter((item) => savedValues.current.get(item.key) !== item.text);
    if (changed.length === 0) {
      markSaved();
      return;
    }
    const ticket = ++sequence.current;
    setSaveState("saving");
    let failed = false;
    let invalid = false;
    for (const item of changed) {
      const result = await props.writeField(item.key, item.text);
      if (result === "saved") savedValues.current.set(item.key, item.text);
      else if (result === "failed") failed = true;
      else invalid = true;
    }
    if (ticket !== sequence.current) return;
    if (failed) setSaveState("failed");
    else if (invalid && changed.every((item) => savedValues.current.get(item.key) !== item.text)) setSaveState("idle");
    else markSaved();
  };
  const scheduleSave = (key, text, immediate) => {
    const pending = timers.current.get(key);
    if (pending !== void 0) clearTimeout(pending);
    if (immediate) {
      timers.current.delete(key);
      void runSave(key, text);
      return;
    }
    const timer = setTimeout(() => {
      timers.current.delete(key);
      void runSave(key, text);
    }, 800);
    timers.current.set(key, timer);
  };
  const onEdit = (key, text) => {
    props.edit(key, text);
    const row = ROWS.find((item) => item.key === key);
    const debounced = row !== void 0 && (row.kind === "text" || row.kind === "number");
    scheduleSave(key, text, !debounced);
  };
  const flushField = (key, text) => {
    const pending = timers.current.get(key);
    if (pending !== void 0) {
      clearTimeout(pending);
      timers.current.delete(key);
    }
    void runSave(key, text ?? viewOf(props.state, key).text);
  };
  (0, import_react9.useEffect)(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      if (savedTimer.current !== void 0) clearTimeout(savedTimer.current);
    },
    []
  );
  const statusText = props.state.writable === false ? props.copy.labels.readOnly : saveState === "saving" ? props.copy.labels.saving : saveState === "saved" ? props.copy.labels.saved : saveState === "failed" ? props.copy.labels.saveFailedShort : "";
  const renderRow = (row, index) => {
    const raw = viewOf(props.state, row.key);
    const view = raw.overridden && atDefaultValue(row.key, raw.text) ? { ...raw, overridden: false } : raw;
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: index === 0 ? void 0 : SEPARATOR_STYLE, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      SettingsRow,
      {
        row,
        copy: props.copy,
        view,
        disabled: !props.state.writable,
        reasoningPair: { provider, model },
        routing,
        providerValue: provider,
        onEdit: (text) => onEdit(row.key, text),
        onReset: () => resetAndSave(row.key),
        onCommit: () => flushField(row.key, viewOf(props.state, row.key).text)
      }
    ) }, row.key);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-pe-form", children: [
    BASIC_ROWS.map(renderRow),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "dsh-pe-advanced", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { children: props.copy.labels.advanced }),
      ADVANCED_ROWS.map(renderRow)
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "dsh-pe-form-footer", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "dsh-pe-save-group", children: [
      statusText === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "dsh-pe-save-status", role: "status", "aria-live": "polite", children: statusText }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-pe-save-button",
          disabled: props.save === void 0 || props.state.writable === false,
          onClick: () => {
            void manualSave();
          },
          children: props.copy.labels.save
        }
      )
    ] }) })
  ] });
}
function SettingsSection(props) {
  const read = props.usePromptEnhance;
  const state = read === void 0 ? void 0 : read((snapshot) => snapshot);
  const readLocale = props.usePromptEnhanceLocale;
  const locale = readLocale === void 0 ? void 0 : readLocale((snapshot) => snapshot);
  const t = translator(props.translate);
  const chinese = (locale?.active ?? "zh").toLowerCase().startsWith("zh");
  if (state === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { style: { margin: 0, fontSize: 12, lineHeight: 1.6 }, children: t("settings.disconnected") });
  }
  const edit = props.edit ?? (() => {
  });
  const resetField = props.resetField ?? (() => {
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PageHeader, { title: t("settings.title"), description: t("settings.description"), version: PLUGIN_VERSION }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SettingsRows, { copy: sectionCopy(t, chinese), state, edit, resetField, save: props.save, discard: props.discard, writeField: props.writeField })
  ] });
}
function SettingsPage(props) {
  const t = translator(props.t);
  const read = props.usePromptEnhance;
  const state = read === void 0 ? void 0 : read((snapshot) => snapshot);
  if (props.view === "summary") return t("settings.summary");
  if (state === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { style: { margin: 0, fontSize: 12, lineHeight: 1.6 }, children: t("settings.disconnected") });
  }
  const edit = props.edit ?? (() => {
  });
  const resetField = props.resetField ?? (() => {
  });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SettingsRows, { copy: pageCopy(t), state, edit, resetField, save: props.save, discard: props.discard, writeField: props.writeField });
}
var SettingsPageController = class {
  /**
   * @param scope - the scope of the entry the host serves this plugin under.
   * @param getLocale - resolves the client locale service, when one is mounted.
   */
  constructor(scope, getLocale) {
    __publicField(this, "form");
    __publicField(this, "scope");
    __publicField(this, "store");
    __publicField(this, "getLocale");
    this.getLocale = getLocale;
    this.scope = scope;
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
    const props = {
      hooks: { promptEnhance: this.store },
      ...this.form.actions(),
      writeField: (key, text) => this.writeField(key, text)
    };
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
  /** Write one field through the host's per-field mutation API. */
  async writeField(key, text) {
    const descriptor = FIELD_SPECS.find((item) => item.field === key);
    if (descriptor === void 0) return "failed";
    const parsed = descriptor.parse(text);
    if (parsed === void 0) return "invalid";
    if (this.scope.set === void 0) return "failed";
    try {
      if (parsed.kind === "clear") {
        if (this.scope.unset === void 0) return "failed";
        if (!await this.scope.unset(key)) return "failed";
      } else {
        if (!await this.scope.set(key, parsed.value)) return "failed";
      }
      return "saved";
    } catch {
      return "failed";
    }
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
        return slots.register({ name: "conversation.input.right", id: "dsh-prompt-enhance", order: 60, locale: NS }, EnhanceButton);
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
        return slots.register({ name: "conversation.input.dock", id: "dsh-prompt-enhance-result", order: 30, locale: NS }, ResultDock);
      } catch (error) {
        return report("result dock slot", error);
      }
    });
  });
  ctx.inject(["slots"], (slotsCtx) => {
    const slots = slotsCtx.slots;
    if (slots === void 0) return;
    return slots.inject("conversation.input.dock", () => {
      try {
        return slots.register({ name: "conversation.input.dock", id: "dsh-prompt-enhance-undo", order: 90, locale: NS }, UndoBar);
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

