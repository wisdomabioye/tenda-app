/**
 * Working guide — public SSR over the SHARED guide copy (one wording,
 * every surface; the mobile screen renders the same sections).
 */
import type { Metadata } from 'next'
import { APP_INFO, SUPPORT_GUIDE_WORKING } from '@tenda/shared'
import { SupportShell, SupportAccordion, GuideSteps } from '@/components/public/SupportArticle'

export const metadata: Metadata = {
  title: `Working on a Gig · ${APP_INFO.name}`,
  description: 'Accept gigs, submit proof, and get paid on Tenda.',
}

export default function WorkingGuidePage() {
  return (
    <SupportShell title="Working on a Gig">
      {SUPPORT_GUIDE_WORKING.map((section, i) => (
        <SupportAccordion key={section.title} title={section.title} defaultOpen={i === 0}>
          <GuideSteps steps={section.steps} />
        </SupportAccordion>
      ))}
    </SupportShell>
  )
}
