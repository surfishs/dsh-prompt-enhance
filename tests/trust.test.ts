/**
 * The trust gate's refusal split: host-gate statuses and the plugin's own
 * loopback fence must stay distinguishable, because the settings page and the
 * result card now localize them separately.
 * @module tests/trust
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage } from 'node:http'
import { trustRejection } from '../src/trust'

/** Build the minimal request shape the fence reads. */
function req(headers: Record<string, string>, remoteAddress = '127.0.0.1', method = 'POST'): IncomingMessage {
  return { headers, socket: { remoteAddress }, method } as unknown as IncomingMessage
}

/** Build a context exposing only the `connection` service. */
function ctxOf(connection?: unknown): Context {
  return {
    get(name: string) {
      return name === 'connection' ? connection : undefined
    },
  } as unknown as Context
}

/** A host gate that admits every request. */
const allows = { requestRejection: (): undefined => undefined }

describe('trustRejection', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('labels a non-loopback request the host gate admitted as loopback-only', () => {
    expect(trustRejection(ctxOf(allows), req({ host: '192.168.1.7:3080' }, '192.168.1.7'))).toEqual({
      status: 403,
      code: 'loopback-only',
      message: 'forbidden: loopback-only',
    })
  })

  it('admits a loopback request the host gate admitted', () => {
    expect(trustRejection(ctxOf(allows), req({ host: '127.0.0.1:3080' }))).toBeUndefined()
  })

  it('keeps the host gate 401 and 403 distinct from the plugin fence', () => {
    expect(trustRejection(ctxOf({ requestRejection: () => 401 }), req({ host: '127.0.0.1:3080' }))).toMatchObject({
      status: 401,
      code: 'unauthorized',
    })
    expect(trustRejection(ctxOf({ requestRejection: () => 403 }), req({ host: '127.0.0.1:3080' }))).toMatchObject({
      status: 403,
      code: 'forbidden',
    })
  })

  it('still refuses proxy headers when the host gate admits the request', () => {
    expect(trustRejection(ctxOf(allows), req({ host: '127.0.0.1:3080', 'x-forwarded-for': '192.168.1.7' }))).toMatchObject({
      status: 403,
      code: 'loopback-only',
    })
  })

  it('runs the full fence when no connection service is present', () => {
    expect(trustRejection(ctxOf(undefined), req({ host: '192.168.1.7:3080' }, '192.168.1.7'))).toMatchObject({
      status: 403,
      code: 'loopback-only',
    })
    expect(trustRejection(ctxOf(undefined), req({ host: '127.0.0.1:3080' }, '127.0.0.1', 'GET'))).toBeUndefined()
    expect(trustRejection(ctxOf(undefined), req({ host: '127.0.0.1:3080' }))).toMatchObject({
      status: 403,
      code: 'forbidden',
    })
  })
})
