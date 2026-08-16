/**
 * Wallet setup guide — public SSR over the SHARED multichain wallet copy:
 * Solana wallets (Phantom/Solflare/MWA) + EVM wallets via WalletConnect
 * for Base and Celo, plus the shared troubleshooting Q&A.
 */
import type { Metadata } from 'next'
import {
  APP_INFO,
  SUPPORT_WALLET_GUIDE,
  SUPPORT_WALLET_INTRO,
  SUPPORT_WALLET_TROUBLESHOOTING,
} from '@tenda/shared'
import { SupportShell, SupportAccordion, GuideSteps, InfoCard } from '@/components/public/SupportArticle'

export const metadata: Metadata = {
  title: `Wallet Setup · ${APP_INFO.name}`,
  description: 'Connect a Solana or EVM wallet to receive escrow payouts.',
}

export default function WalletGuidePage() {
  return (
    <SupportShell title="Wallet Setup">
      <InfoCard label={SUPPORT_WALLET_INTRO.label} body={SUPPORT_WALLET_INTRO.body} />
      {SUPPORT_WALLET_GUIDE.map((wallet, i) => (
        <SupportAccordion key={wallet.id} title={wallet.name} defaultOpen={i === 0}>
          {wallet.note !== undefined && (
            <p className="rounded-control bg-feedback-warning-surface p-2.5 text-xs text-feedback-warning-text">
              {wallet.note}
            </p>
          )}
          <GuideSteps steps={wallet.steps} />
        </SupportAccordion>
      ))}
      {SUPPORT_WALLET_TROUBLESHOOTING.map((qa) => (
        <SupportAccordion key={qa.question} title={qa.question}>
          <p className="whitespace-pre-line text-sm leading-6 text-content-secondary">{qa.answer}</p>
        </SupportAccordion>
      ))}
    </SupportShell>
  )
}
