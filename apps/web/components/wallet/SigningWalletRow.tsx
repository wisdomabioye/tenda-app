'use client'

/**
 * "Signing with 0x12…abcd on Base Sepolia · Switch" — the signer preview the
 * TxConfirmDialog mounts above its buttons, so the wallet that is about to
 * open is a fact on screen, not a surprise (a multichain wallet like Phantom
 * can hold the EVM session even when the user thinks of it as Solana).
 * Given a `spend` (a value-moving action), it also warns when THAT wallet
 * positively holds less of the asset than the action debits — the moment the
 * user can still switch or top up, instead of after the revert.
 * All behaviour lives in useSigningWallet/useSignerBalance; this renders it.
 */
import { chainLabel, formatAssetAmount, truncateWallet } from '@tenda/shared'
import { Button } from '@/components/ui/Button'
import { useSigningWallet } from '@/hooks/wallet/useSigningWallet'
import { useSignerBalance, type SpendPreview } from '@/hooks/wallet/useSignerBalance'

export function SigningWalletRow({ chainId, spend }: { chainId: string; spend?: SpendPreview }) {
  const signer = useSigningWallet(chainId)
  const balance = useSignerBalance(chainId, spend ?? null, signer.address)
  if (signer.namespace === null) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface-card px-3 py-1.5">
        <p className="text-[13px] leading-5 text-content-secondary">
          Signing with{' '}
          <span className="font-numeric font-semibold text-content-primary">
            {signer.address !== null ? truncateWallet(signer.address) : 'no linked wallet'}
          </span>{' '}
          on {chainLabel(chainId)}
        </p>
        <Button
          variant="ghost"
          size="md"
          disabled={signer.switching}
          onClick={() => void signer.switchWallet()}
        >
          {signer.switching ? 'Waiting…' : 'Switch'}
        </Button>
      </div>
      {spend !== undefined && balance.funds === 'short' && balance.availableRaw !== null && (
        <p role="alert" className="text-[13px] leading-5 text-feedback-danger-text">
          This wallet holds {formatAssetAmount(balance.availableRaw, spend.assetId)} but{' '}
          {formatAssetAmount(spend.amountRaw, spend.assetId)} is needed — switch wallet or add
          funds first.
        </p>
      )}
      {signer.error !== null && (
        <p role="alert" className="text-[13px] leading-5 text-feedback-danger-text">
          {signer.error}
        </p>
      )}
    </div>
  )
}
