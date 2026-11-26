/**
 * GET endpoints under the plugin prefix for the settings page's provider/model
 * selects: registered providers, one provider's models, and a warning-only
 * route check. Same loopback fence as the enhancement route; no credentials and
 * no model traffic beyond the adapter's own catalog lookup.
 * @module dsh-prompt-enhance/catalog-route
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { LLM_MODELS_ENDPOINT, LLM_PROVIDERS_ENDPOINT, LLM_ROUTE_CHECK_ENDPOINT } from './shared/catalog'
import { checkRoute, listModelCatalog, listProviderCatalog } from './provider-catalog'
import { trustRejection, type TrustConfigReader } from './trust'
import { writeJson } from './http'

/** Read one required query parameter, treating whitespace as absent. */
function requiredParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim()
  return value === undefined || value === '' ? undefined : value
}

/**
 * Serve one read-only catalog request.
 * @param ctx - plugin context carrying `llm`.
 * @param req - the incoming request.
 * @param res - the outgoing response.
 * @param pathname - the already-parsed request path.
 * @param readConfig - current config reader for the explicit allowlists.
 * @returns the response side effect.
 */
export async function serveCatalog(ctx: Context, req: IncomingMessage, res: ServerResponse, pathname: string, readConfig?: TrustConfigReader): Promise<void> {
  const rejection = trustRejection(ctx, req, readConfig)
  if (rejection !== undefined) {
    writeJson(res, rejection.status, {
      ok: false,
      error: { code: rejection.code, message: rejection.message },
    })
    return
  }
  if (req.method !== 'GET') {
    writeJson(res, 405, { ok: false, error: { code: 'internal', message: 'only GET is allowed' } })
    return
  }
  const url = new URL(req.url ?? '/', 'http://x')
  if (pathname === LLM_PROVIDERS_ENDPOINT) {
    writeJson(res, 200, { ok: true, value: listProviderCatalog(ctx) })
    return
  }
  if (pathname === LLM_MODELS_ENDPOINT) {
    const provider = requiredParam(url, 'provider')
    if (provider === undefined) {
      writeJson(res, 422, { ok: false, error: { code: 'rejected', message: 'provider 不能为空。' } })
      return
    }
    writeJson(res, 200, { ok: true, value: await listModelCatalog(ctx, provider) })
    return
  }
  if (pathname === LLM_ROUTE_CHECK_ENDPOINT) {
    const provider = requiredParam(url, 'provider')
    const model = requiredParam(url, 'model')
    if (provider === undefined || model === undefined) {
      writeJson(res, 422, { ok: false, error: { code: 'rejected', message: 'provider 与 model 必须成对填写。' } })
      return
    }
    writeJson(res, 200, { ok: true, value: await checkRoute(ctx, provider, model) })
    return
  }
  writeJson(res, 404, { ok: false, error: { code: 'internal', message: 'not found' } })
}
