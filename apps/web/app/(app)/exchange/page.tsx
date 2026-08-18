'use client'

/**
 * P2P exchange — the Tier-3 order book, behind the CO4 advanced-mode gate
 * (the settings toggle unlocks it; exchange is NEVER public — both endpoints
 * require auth). There is no Buy tab: onramp was retired (#61).
 *
 * The page owns the gate and nothing else: the list state comes from the URL
 * and the surface renders it.
 */
import Link from 'next/link'
import { ArrowLeftRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useExchangeRoute } from '@/hooks/exchange/useExchangeRoute'
import { useExchangeScreen } from '@/hooks/exchange/useExchangeScreen'
import { EXCHANGE_COPY, ExchangeSurface } from '@/components/exchange/market'
import { EmptyPanel, EMPTY_ACTION_CLASS } from '@/components/ui/EmptyPanel'

export default function ExchangePage() {
  const user = useAuthStore((s) => s.user)
  const route = useExchangeRoute()
  const locked = user !== null && !user.advanced_mode_enabled
  const screen = useExchangeScreen({
    currency: route.currency,
    chainId: route.chainId,
    enabled: !locked,
  })

  if (locked) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-8 py-24">
        <EmptyPanel
          icon={<ArrowLeftRight size={28} />}
          title={EXCHANGE_COPY.locked.title}
          body={EXCHANGE_COPY.locked.body}
          action={
            <Link href="/settings" className={EMPTY_ACTION_CLASS}>
              {EXCHANGE_COPY.locked.action}
            </Link>
          }
        />
      </div>
    )
  }

  return <ExchangeSurface route={route} screen={screen} userId={user?.id ?? ''} />
}
