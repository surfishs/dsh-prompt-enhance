/**
 * The bounded body reader (B8).
 *
 * The route has to tell "body too large" apart from "body is not JSON" to answer
 * 413 rather than 422. That used to ride on the message text, so re-wording the
 * reader would silently downgrade the status. These tests pin the TYPE instead.
 * @module tests/http
 */

import { describe, expect, it } from 'vitest'
import { BodyTooLargeError, UnsupportedMediaTypeError, readBoundedJson } from '../src/http'

/**
 * A request that yields exactly one body chunk.
 * @param body - the chunk content.
 * @param headers - request headers; JSON by default.
 * @returns the request stand-in the reader accepts.
 */
function reqOf(body: string, headers: Record<string, string> = { 'content-type': 'application/json' }): never {
  return {
    headers,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body, 'utf8')
    },
  } as never
}

describe('readBoundedJson', () => {
  it('parses a body inside the cap', async () => {
    await expect(readBoundedJson(reqOf('{"text":"hi"}'), 64)).resolves.toEqual({ text: 'hi' })
  })

  it('throws the typed overflow error, not a message', async () => {
    const error = await readBoundedJson(reqOf('x'.repeat(128)), 16).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(BodyTooLargeError)
    expect(error).toMatchObject({ code: 'body-too-large' })
  })

  it('leaves a parse error a parse error', async () => {
    const error = await readBoundedJson(reqOf('not json'), 64).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(SyntaxError)
    expect(error).not.toBeInstanceOf(BodyTooLargeError)
  })

  it('refuses a body that is not declared as JSON', async () => {
    const missing = await readBoundedJson(reqOf('{"text":"hi"}', {}), 64).catch((reason: unknown) => reason)
    expect(missing).toBeInstanceOf(UnsupportedMediaTypeError)
    const form = await readBoundedJson(reqOf('text=hi', { 'content-type': 'application/x-www-form-urlencoded' }), 64).catch((reason: unknown) => reason)
    expect(form).toBeInstanceOf(UnsupportedMediaTypeError)
  })

  it('accepts a JSON media type with parameters and a +json suffix', async () => {
    await expect(readBoundedJson(reqOf('{"text":"hi"}', { 'content-type': 'application/json; charset=utf-8' }), 64)).resolves.toEqual({ text: 'hi' })
    await expect(readBoundedJson(reqOf('{"text":"hi"}', { 'content-type': 'application/vnd.api+json' }), 64)).resolves.toEqual({ text: 'hi' })
  })
})
