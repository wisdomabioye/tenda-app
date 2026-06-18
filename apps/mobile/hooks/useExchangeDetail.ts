import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { api } from '@/api/client'
import type { ExchangeDetail } from '@tenda/shared'

/**
 * Loader for the exchange-detail read surface (/v1/exchange/:id). Refetches on
 * focus; `refresh` is reused by every transition to re-pull after a confirmed tx.
 */
export function useExchangeDetail(id: string | undefined) {
  const [offer, setOffer] = useState<ExchangeDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setOffer(await api.exchange.get({ id }))
    } catch (e) {
      setError((e as Error).message)
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
