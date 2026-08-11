import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { api } from '@/api/client'
import { classifyDetailLoadError, type DetailLoadError } from '@/lib/detail-load-error'
import type { ExchangeDetail } from '@tenda/shared'

/**
 * Loader for the exchange-detail read surface (/v1/exchange/:id). Refetches on
 * focus; `refresh` is reused by every transition to re-pull after a confirmed tx.
 *
 * A `gone` refetch DROPS the offer, for the reason spelled out in
 * lib/detail-load-error: without it, an offer deleted or taken down mid-session
 * kept rendering from the last good response — the screen only shows its error
 * branch when `offer` is null — leaving Accept live on something the server had
 * stopped serving. A transient failure keeps the offer on screen.
 */
export function useExchangeDetail(id: string | undefined) {
  const [offer, setOffer] = useState<ExchangeDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<DetailLoadError | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setOffer(await api.exchange.get({ id }))
    } catch (e) {
      const failure = classifyDetailLoadError(e)
      setError(failure)
      if (failure.gone) setOffer(null)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh]),
  )

  return { offer, isLoading, error, refresh }
}
