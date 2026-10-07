import { afterEach, describe, expect, it, vi } from 'vitest'
import { logFeeCurrencyRequestFailure } from '../diagnostic'

afterEach(() => vi.restoreAllMocks())

describe('feeCurrency request diagnostics', () => {
  it('preserves code, whitespace and nested error shape without copying payloads', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logFeeCurrencyRequestFailure({
      code: -32602, message: 'Invalid params\n\nfeeCurrency: 0x123abc',
      data: { originalError: { code: -32602, message: 'Expected type `never`' }, params: ['secret'] },
      transaction: { data: 'secret' }, session: 'secret', stack: 'secret',
    })
    expect(warn).toHaveBeenCalledWith('[Tenda wallet] feeCurrency request failed', {
      code: -32602, message: 'Invalid params\n\nfeeCurrency: [hex redacted]',
      data: { originalError: { code: -32602, message: 'Expected type `never`' } },
    })
  })

  it('handles Error causes, cycles, invalid fields and long messages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cyclic = { code: NaN, message: 'x'.repeat(2000), cause: {} }
    cyclic.cause = cyclic
    logFeeCurrencyRequestFailure(cyclic)
    logFeeCurrencyRequestFailure(new Error('https://private.test/token', { cause: { code: 'timeout' } }))
    expect(warn.mock.calls[0]?.[1]).toEqual({
      message: 'x'.repeat(1000), cause: { message: 'x'.repeat(1000), cause: {
        message: 'x'.repeat(1000), cause: { message: 'x'.repeat(1000) },
      } },
    })
    expect(warn.mock.calls[1]?.[1]).toEqual({ message: '[URL redacted]', cause: { code: 'timeout' } })
    logFeeCurrencyRequestFailure({ code: {}, message: false, data: 'secret' })
    expect(warn).toHaveBeenLastCalledWith('[Tenda wallet] feeCurrency request failed', {})
  })

  it('never throws for primitives, hostile getters or a broken console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const value of [null, undefined, 'secret', 1]) logFeeCurrencyRequestFailure(value)
    expect(warn).toHaveBeenCalledTimes(4)
    expect(() => logFeeCurrencyRequestFailure({ get code() { throw new Error('getter') } })).not.toThrow()
    warn.mockImplementation(() => { throw new Error('console') })
    expect(() => logFeeCurrencyRequestFailure(new Error('original'))).not.toThrow()
  })
})
