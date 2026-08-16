'use client'

/**
 * Exchange offer detail route — auth-gated (exchange is never public).
 */
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth.store'
import { useExchangeDetail } from '@/hooks/exchange/useExchangeDetail'
import { ExchangeDetailApp } from '@/components/exchange'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

export default function ExchangeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const { offer, isLoading, error, refresh } = useExchangeDetail(id)

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  if (offer === null || userId === null) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-8 py-24 text-center">
        <p className="font-semibold text-content-primary">
          {error?.gone ? 'Offer not available' : 'Could not load this offer'}
        </p>
        {error?.gone === true ? (
          <Link href="/exchange">
            <Button variant="outline">Back to the order book</Button>
          </Link>
        ) : (
          <Button variant="outline" onClick={() => void refresh()}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  return <ExchangeDetailApp offer={offer} userId={userId} refresh={refresh} />
}
