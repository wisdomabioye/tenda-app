'use client'

import { formatAssetAmount } from '@tenda/shared'
import { useEscrowFee } from '@/hooks/escrow/useEscrowFee'
import { GIG_DETAIL_COPY } from './copy'

export function GigFeeNote({ isSeeker, amountRaw, asset, symbol }: { isSeeker: boolean; amountRaw: string; asset: string; symbol: string }) {
  const { netRaw, feePct } = useEscrowFee(isSeeker, amountRaw)
  return (
    <p className="mt-2.5 text-[13px] leading-[18px] text-content-secondary">
      {netRaw === null
        ? GIG_DETAIL_COPY.feePending
        : GIG_DETAIL_COPY.workerReceives(formatAssetAmount(netRaw.toString(), asset), symbol, feePct)}
    </p>
  )
}
