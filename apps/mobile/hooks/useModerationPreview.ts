import { useEffect, useRef, useState } from 'react'
import { solanaNativeAssetId, type ModerationPreviewResponse } from '@tenda/shared'
import { api } from '@/api/client'
import { APP_IDENTITY } from '@/wallet'

const DEBOUNCE_MS = 800
/** Native SOL — legacy gigs are lamports-denominated. */
const SOL_DECIMALS = 9
const MIN_TITLE_CHARS = 4

export interface ModerationPreviewInput {
  title: string
  description: string
  category: string | null
  country: string | null
  paymentLamports: number
}

/**
 * Live moderation hints while the user types (stage-6 § Mobile): debounced
 * 800ms, never blocking — the create path re-runs the same pipeline
 * server-side and stays authoritative. Null until a verdict arrives;
 * errors are silent (the hint simply doesn't show).
 */
export function useModerationPreview(input: ModerationPreviewInput): ModerationPreviewResponse | null {
  const [verdict, setVerdict] = useState<ModerationPreviewResponse | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestSeq = useRef(0)

  const { title, description, category, country, paymentLamports } = input
  const ready =
    title.trim().length >= MIN_TITLE_CHARS &&
    category !== null &&
    country !== null &&
    paymentLamports > 0

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!ready) {
      setVerdict(null)
      return
    }
    timer.current = setTimeout(() => {
      const seq = ++requestSeq.current
      api.moderation
        .preview({
          title: title.trim(),
          description: description.trim(),
          category: category,
          country: country,
          asset: solanaNativeAssetId(APP_IDENTITY.network),
          amount_raw: String(paymentLamports),
          asset_decimals: SOL_DECIMALS,
        })
        .then((v) => {
          // Drop stale responses — only the latest input's verdict counts.
          if (seq === requestSeq.current) setVerdict(v)
        })
        .catch(() => {
          if (seq === requestSeq.current) setVerdict(null)
        })
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [ready, title, description, category, country, paymentLamports])

  return verdict
}
