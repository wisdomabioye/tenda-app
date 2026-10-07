const MAX_ERROR_DEPTH = 4
const MAX_MESSAGE_LENGTH = 1000

interface ErrorDiagnostic {
  code?: number | string
  message?: string
  cause?: ErrorDiagnostic
  data?: ErrorDiagnostic
  originalError?: ErrorDiagnostic
}

function redact(message: string): string {
  return message.replace(/0x[\da-f]+/gi, '[hex redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL redacted]')
    .slice(0, MAX_MESSAGE_LENGTH)
}

/** Untrusted provider errors: whitelist fields, bound recursion, never copy payloads. */
function snapshot(error: unknown, depth = 0): ErrorDiagnostic {
  if (depth >= MAX_ERROR_DEPTH || typeof error !== 'object' || error === null) return {}
  const result: ErrorDiagnostic = {}
  if ('code' in error) {
    if (typeof error.code === 'number' && Number.isFinite(error.code)) result.code = error.code
    else if (typeof error.code === 'string') result.code = redact(error.code)
  }
  if ('message' in error && typeof error.message === 'string') result.message = redact(error.message)
  function addNested(key: 'cause' | 'data' | 'originalError', value: unknown): void {
    const nested = snapshot(value, depth + 1)
    if (Object.keys(nested).length > 0) result[key] = nested
  }
  if ('cause' in error) addNested('cause', error.cause)
  if ('data' in error) addNested('data', error.data)
  if ('originalError' in error) addNested('originalError', error.originalError)
  return result
}

/** Local console only; diagnostics must never change transaction error handling. */
export function logFeeCurrencyRequestFailure(error: unknown): void {
  try {
    console.warn('[Tenda wallet] feeCurrency request failed', snapshot(error))
  } catch {
    // Hostile getters or unavailable console must not replace the original error.
  }
}
