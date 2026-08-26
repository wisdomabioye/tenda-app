import { EVM_CHAIN_NAMES_PROSE } from '@/content'
import type { FaqCategory } from '../types'

/**
 * Q.13–Q.14 — sign-in and recovery, split along the line the product actually
 * draws.
 *
 * Sign-in is FIVE methods (`identity_kind` is phone | email | google | apple,
 * plus the wallet strategy), and only the wallet holds money. The old answers
 * described a wallet-only product, so a reader who signed up with an email
 * address was told to restore a seed phrase they never created. Account
 * recovery and fund recovery are different questions with different answers,
 * and conflating them is how someone concludes their money is gone when it
 * isn't — or assumes we can rescue a lost seed phrase when we can't.
 */
export const CRYPTO_CATEGORY: FaqCategory = {
  num: '04',
  slug: 'crypto',
  title: 'Crypto basics',
  caption: '2 questions',
  questions: [
    {
      id: 'Q.13',
      question: 'Do I need to know anything about crypto to use Tenda?',
      answer: (
        <>
          <p>
            No more than you&apos;d need for any mobile app. Sign in with your phone number,
            your email, Google or Apple — the same as anywhere else. Browsing gigs and offers
            needs nothing more than that.
          </p>
          <p>
            A wallet only comes in when money moves, and Tenda walks you through connecting one
            at that point. On Android your phone hands the connection to whichever wallet you
            already use; on {EVM_CHAIN_NAMES_PROSE} any WalletConnect wallet works. The wallet stays yours — Tenda never holds your keys. You don&apos;t
            even need gas money to start: new Solana wallets get seeded with a small SOL grant,
            and on Celo your USDC pays its own fees.
          </p>
          <p>
            For posters: gigs are priced in USDC, a dollar-pegged stablecoin — no volatile
            conversions to think about. For workers: payouts arrive as USDC; keep them,
            self-custody, or convert via Exchange to local cash.
          </p>
        </>
      ),
    },
    {
      id: 'Q.14',
      question: 'What if I lose my phone?',
      answer: (
        <>
          <p>
            Two separate things come back two separate ways. <strong>Your account</strong> —
            your profile, history, messages, reviews — returns the moment you sign in on a new
            device with the same phone, email, Google or Apple identity. Nothing there depends
            on the old handset.
          </p>
          <p>
            <strong>Your money</strong> lives in your wallet, not in your Tenda account, so it
            comes back the way any non-custodial wallet does: install the wallet on the new
            device and restore it from your recovery phrase. Reconnect it to Tenda and your
            active gigs and open offers are exactly where you left them — they don&apos;t care
            which device you connect from.
          </p>
          <p>
            <strong>Important:</strong> Tenda cannot recover your wallet. We can get you back
            into your account; we can do nothing about a lost recovery phrase, because we never
            had it. If you lose both the device and the phrase, the funds in that wallet are
            gone. Back up the phrase the moment you create the wallet.
          </p>
        </>
      ),
    },
  ],
}
