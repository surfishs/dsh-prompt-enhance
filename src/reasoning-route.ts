/**
 * GET /dsh-prompt-enhance/reasoning-efforts: the browser half's read-only seam
 * for "what tiers does this route declare?".
 *
 * Same trust fence as the enhance route (loopback only), no request body, no
 * provider traffic beyond the adapter's own capability lookup. Capability
 * failures are answers, not HTTP errors: the panel must be able to render the
 * "follow provider default" fallback without treating it as a transport fault.
 * @module dsh-prompt-enhance/reasoning-route
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { REASONING_EFFORTS_ENDPOINT } from './shared/reasoning'
import { resolveReasoningCapabilities } from './reasoning-efforts'
import { trustRejection, type TrustConfigReader } from './trust'
import { writeJson } from './http'

/** Read one optional query parameter, treating whitespace as absent. */
function queryParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim()
  return value === undefined || value === '' ? undefined : value
}

/**
 * Serve one capability lookup.
 * @param ctx - plugin context carrying `llm` (and `agentDefaultModel` when present).
 * @param req - the incoming request.
 * @param res - the outgoing response.
 * @param readConfig - current config reader for the explicit allowlists.
 */
export async function serveReasoningEfforts(ctx: Context, req: IncomingMessage, res: ServerResponse, readConfig?: TrustConfigReader): Promise<void> {
  const rejection = trustRejection(ctx, req, readConfig)
  if (rejection !== undefined) {
    writeJson(res, rejection.status, {
      ok: false,
      error: { code: rejection.code, message: rejection.message },
    })
    return
  }
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname !== REASONING_EFFORTS_ENDPOINT) {
    writeJson(res, 404, { ok: false, error: { code: 'internal', message: 'not found' } })
    return
  }
  if (req.method !== 'GET') {
    writeJson(res, 405, { ok: false, error: { code: 'internal', message: 'only GET is allowed' } })
    return
  }
  const provider = queryParam(url, 'provider')
  const model = queryParam(url, 'model')
  const refresh = queryParam(url, 'refresh')
  // A pair is all-or-nothing: an unpaired value would describe a route that
  // cannot be called, so the panel never renders options for it.
  if ((provider === undefined) !== (model === undefined)) {
    writeJson(res, 422, { ok: false, error: { code: 'rejected', message: 'provider 与 model 必须成对填写。' } })
    return
  }
  const value = await resolveReasoningCapabilities(ctx, provider, model, { refresh: refresh === '1' || refresh === 'true' })
  writeJson(res, 200, { ok: true, value })
}
