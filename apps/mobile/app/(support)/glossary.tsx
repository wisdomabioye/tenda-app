import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, Header, Text, Spacer, Card, AccordionItem } from '@/components/ui'

const TERMS = [
  {
    term: 'Blockchain',
    definition:
      "A permanent public record of all transactions that no one can change or delete. Think of it like a ledger kept by millions of computers at once, no single person controls it.",
  },
  {
    term: 'Escrow',
    definition:
      "A secure holding area for payment. When a poster publishes a gig, the money is locked in escrow on-chain. It can only be released to the worker (on approval) or returned to the poster (on refund/expiry).",
  },
  {
    term: 'Lamports',
    definition:
      "The smallest unit of SOL, like Kobo is to Naira. 1 SOL = 1,000,000,000 (one billion) lamports. You'll rarely need to think about lamports; Tenda handles the conversion.",
  },
  {
    term: 'Seed Phrase',
    definition:
      "A set of 12 or 24 random words that is the master key to your wallet. Anyone with your seed phrase can access your funds. Write it down offline, never share it, and never type it into any website or app.",
  },
  {
    term: 'Signature',
    definition:
      "Your digital approval of a transaction. When your wallet asks you to 'sign', it's like signing a cheque, you're confirming you authorise that specific action.",
  },
  {
    term: 'Smart Contract',
    definition:
      "A self-executing agreement stored on the blockchain. Tenda's escrow is a smart contract, the rules (release on approval, refund on expiry) are written into code and enforced automatically.",
  },
  {
    term: 'SOL',
    definition:
      "The digital currency of the Solana blockchain, the network Tenda runs on. All gig payments on Tenda are in SOL. Tenda always shows the Naira equivalent alongside SOL amounts.",
  },
  {
    term: 'Solana',
    definition:
      "The blockchain network Tenda is built on. Solana is known for fast transactions and very low fees, usually less than ₦1 per transaction.",
  },
  {
    term: 'Transaction',
    definition:
      "Any action recorded on the blockchain, publishing a gig, accepting, submitting proof, or approving payment. Each transaction is permanent and publicly verifiable.",
  },
  {
    term: 'Wallet',
    definition:
      "Your digital identity and payment account on Tenda. Think of it like a bank account, but only you control it. Tenda supports Phantom and Solflare wallets on Android.",
  },
] as const

export default function GlossaryScreen() {
  const { theme } = useUnistyles()

  return (
    <ScreenContainer edges={['left', 'right']}>
      <Header title="Glossary" showBack />
      <Spacer size={spacing.md} />

      <Text variant="caption" color={theme.colors.textSub}>
        Plain English definitions of crypto and Tenda terms.
      </Text>
      <Spacer size={spacing.md} />

      <Card variant="outlined" padding={0}>
        {TERMS.map((item, index) => (
          <AccordionItem
            key={item.term}
            title={item.term}
            last={index === TERMS.length - 1}
          >
            <Spacer size={spacing.xs} />
            <Text variant="caption" color={theme.colors.textSub}>{item.definition}</Text>
          </AccordionItem>
        ))}
      </Card>

      <Spacer size={spacing.md} />
    </ScreenContainer>
  )
}
