/**
 * Which tone a status wears.
 *
 * 2xx reads as settled, 5xx as ours, and the rest as the caller's — except
 * 402, which is pulled out of the 4xx group deliberately: on this API it is
 * the normal FIRST answer to a task post, not a refusal.
 */
import type { Tone } from './Chip'

export function toneForStatus(status: string): Tone {
  const first = status.charAt(0)
  if (first === '2') return 'ok'
  if (first === '4') return status === '402' ? 'brand' : 'warn'
  if (first === '5') return 'danger'
  return 'muted'
}
