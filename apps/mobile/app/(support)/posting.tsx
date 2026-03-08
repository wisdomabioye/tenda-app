import { spacing } from '@/theme/tokens'
import { ScreenContainer, Header, Spacer, Card, AccordionItem } from '@/components/ui'
import { GuideStep } from '@/components/support/GuideStep'

export default function PostingGuideScreen() {
  return (
    <ScreenContainer edges={['left', 'right']}>
      <Header title="Posting a Gig" showBack />
      <Spacer size={spacing.md} />

      {/* Creating a gig */}
      <Card variant="outlined" padding={0}>
        <AccordionItem title="How to create a gig" defaultExpanded>
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="Tap the + button" description="Find the post button in the tab bar at the bottom of the screen." />
          <Spacer size={spacing.sm} />
          <GuideStep step={2} title="Fill in the gig details" description="Add a clear title, category, location, duration, and a detailed description of what you need done." />
          <Spacer size={spacing.sm} />
          <GuideStep step={3} title="Set the payment amount" description="Enter how much you're willing to pay in SOL. The equivalent Naira value is shown for reference." />
          <Spacer size={spacing.sm} />
          <GuideStep step={4} title="Review your draft" description="Your gig is saved as a draft first. Take a moment to check all the details, title, description, location, and payment amount before publishing." />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={5}
            title="Publish your gig"
            description="Tap Publish when you're ready. You'll be asked to approve a transaction in your wallet, this locks the payment into escrow."
            warning="Make sure your wallet has enough SOL to cover the gig payment plus a small transaction fee (about ₦50 worth)."
          />
          <Spacer size={spacing.sm} />
          <GuideStep step={6} title="Wait for a worker to apply" description="Your gig is now live. Workers in your area will see it and can apply." />
        </AccordionItem>
        <AccordionItem title="Tips for setting a fair price">
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="Research similar gigs" description="Browse the gig feed to see what others are charging for similar work." />
          <Spacer size={spacing.sm} />
          <GuideStep step={2} title="Account for time and skill" description="A 2-hour errand should pay more than a 30-minute task. Skilled work (design, coding) commands higher rates." />
          <Spacer size={spacing.sm} />
          <GuideStep step={3} title="Be specific in your description" description="Clear gigs attract better workers and reduce disputes later." />
        </AccordionItem>
      </Card>

      <Spacer size={spacing.md} />

      {/* Approving work */}
      <Card variant="outlined" padding={0}>
        <AccordionItem title="How to approve completed work" defaultExpanded>
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="You'll get a notification when the worker submits" description="Open the gig to review the submitted proof (photos, links, or description)." />
          <Spacer size={spacing.sm} />
          <GuideStep step={2} title="Review the submission carefully" description="Make sure the work matches what was agreed in the gig description." />
          <Spacer size={spacing.sm} />
          <GuideStep step={3} title="Tap Approve" description="Your wallet will ask you to sign a transaction. Once approved, the payment is released to the worker instantly." />
        </AccordionItem>
        <AccordionItem title="How to raise a dispute" last>
          <Spacer size={spacing.xs} />
          <GuideStep step={1} title="Tap Dispute on the gig screen" description="Only available after the worker has submitted proof." />
          <Spacer size={spacing.sm} />
          <GuideStep step={2} title="Describe the issue clearly" description="Explain what was not delivered or what was done incorrectly." />
          <Spacer size={spacing.sm} />
          <GuideStep
            step={3}
            title="Wait for resolution"
            description="The Tenda team will review both sides and decide. Payment is held in escrow until resolved."
            tip="Keeping your gig description specific and detailed makes disputes easier to resolve in your favour."
          />
        </AccordionItem>
      </Card>

      <Spacer size={spacing.md} />
    </ScreenContainer>
  )
}
