/**
 * lib/otp — the OtpSender transports the main otp suite leaves uncovered
 * (it injects a fake sender): termiiSender (fetch-stubbed POST + non-2xx
 * 502) and consoleSender (dev fallback that logs, never throws).
 */

import { test, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { termiiSender, consoleSender, emailOtpSender, TERMII_SMS_URL } from '@server/lib/otp'
import { sendViaResend, RESEND_API_URL } from '@server/lib/email'
import { AppError } from '@server/lib/errors'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('termiiSender: POSTs to Termii with the code embedded in the SMS body', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init?.body ?? '{}') })
    return { ok: true, status: 200 } as Response
  }) as typeof fetch

  await termiiSender({ api_key: 'K', sender_id: 'Tenda' }).send('+2348012345678', '123456')
  assert.strictEqual(calls[0].url, TERMII_SMS_URL)
  assert.strictEqual(calls[0].body.api_key, 'K')
  assert.strictEqual(calls[0].body.to, '+2348012345678')
  assert.strictEqual(calls[0].body.from, 'Tenda')
  assert.match(String(calls[0].body.sms), /123456/)
})

test('termiiSender: non-2xx → 502 AppError carrying the status', async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 500 }) as Response) as typeof fetch
  await assert.rejects(
    () => termiiSender({ api_key: 'K', sender_id: 'S' }).send('+2348000000000', '000000'),
    (e: unknown) => e instanceof AppError && e.statusCode === 502 && /status 500/.test(e.message),
  )
})

test('consoleSender: logs the code + identifier + channel and never throws', async () => {
  const logs: { obj: Record<string, unknown>; msg: string }[] = []
  await consoleSender(
    { warn: (obj, msg) => logs.push({ obj: obj as Record<string, unknown>, msg }) },
    'email',
  ).send('a@x.io', '654321')
  assert.strictEqual(logs.length, 1)
  assert.strictEqual(logs[0].obj.code, '654321')
  assert.strictEqual(logs[0].obj.identifier, 'a@x.io')
  assert.strictEqual(logs[0].obj.channel, 'email')
})

test('emailOtpSender: POSTs to Resend with the code in the body', async () => {
  const calls: { url: string; body: Record<string, unknown>; auth: string }[] = []
  globalThis.fetch = (async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
    calls.push({
      url: String(url),
      body: JSON.parse(init?.body ?? '{}'),
      auth: init?.headers?.Authorization ?? '',
    })
    return { ok: true, status: 200 } as Response
  }) as typeof fetch

  await emailOtpSender({ api_key: 'K', from: 'no-reply@tenda.app' }).send('user@x.io', '424242')
  assert.strictEqual(calls[0].url, RESEND_API_URL)
  assert.strictEqual(calls[0].auth, 'Bearer K')
  assert.deepStrictEqual(calls[0].body.to, ['user@x.io'])
  assert.match(String(calls[0].body.text), /424242/)
})

test('sendViaResend: non-2xx → 502 AppError carrying the status', async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 422 }) as Response) as typeof fetch
  await assert.rejects(
    () => sendViaResend({ api_key: 'K', from: 'f@x.io' }, { to: 't@x.io', subject: 's', text: 'b' }),
    (e: unknown) => e instanceof AppError && e.statusCode === 502 && /status 422/.test(e.message),
  )
})
