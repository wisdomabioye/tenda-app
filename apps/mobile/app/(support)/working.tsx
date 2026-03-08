import { spacing } from '@/theme/tokens'
import { ScreenContainer, Header, Spacer, Card, AccordionItem } from '@/components/ui'
import { GuideStep } from '@/components/support/GuideStep'

export default function WorkingGuideScreen() {
  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <Header title="Working on a Gig" showBack />
      <Spacer size={spacing.md} />

      <Card variant="outlined" padding={0}>
        <AccordionItem title="How to find gigs" defaultExpanded>
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="Open the Home tab" description="The feed shows open gigs near you." />
          <Spacer size={spacing.sm} />
          <GuideStep step={2} title="Use filters to narrow down" description="Filter by category, city, or search by keyword to find gigs that match your skills." />
          <Spacer size={spacing.sm} />
          <GuideStep step={3} title="Tap a gig to see full details" description="Review the title, description, payment, duration, and poster's profile before accepting." />
        </AccordionItem>
        <AccordionItem title="How to accept a gig">
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="Open the gig and tap Accept" description="Only open gigs with no worker yet can be accepted." />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={2}
            title="Approve the transaction in your wallet"
            tip="Your wallet will open and ask you to sign. This records your acceptance on-chain. The payment is already locked in escrow, you're not paying anything."
          />
          <Spacer size={spacing.sm} />
          <GuideStep step={3} title="Get to work" description="Once accepted, start the work as agreed. You can message the poster from the gig screen if you have questions." />
        </AccordionItem>
        <AccordionItem title="How to submit proof of work">
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="Complete the work first" description="Make sure everything matches the gig description before submitting." />
          <Spacer size={spacing.sm} />
          <GuideStep step={2} title="Tap Submit Proof on the gig screen" description="Upload photos, a link, or a description of what you delivered." />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={3}
            title="Sign the submission in your wallet"
            description="Your wallet will ask you to approve. This records the submission on-chain."
          />
          <Spacer size={spacing.sm} />
          <GuideStep step={4} title="Wait for the client to approve" description="The client reviews your submission and approves or raises a dispute." />
        </AccordionItem>
        <AccordionItem title="How and when you get paid" last>
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="The client taps Approve" description="Once they approve, the transaction is signed on-chain immediately." />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={2}
            title="Payment arrives in your wallet"
            description="SOL is sent directly to your wallet address. No waiting, no withdrawal, it's instant."
            tip="You can convert SOL to naira through any Nigerian crypto exchange (e.g. Bybit P2P)."
          />
        </AccordionItem>
      </Card>

      <Spacer size={spacing.md} />
    </ScreenContainer>
  )
}
