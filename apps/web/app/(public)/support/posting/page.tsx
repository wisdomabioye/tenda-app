/**
 * Posting guide — public SSR over the SHARED guide copy (one wording,
 * every surface; the mobile screen renders the same sections).
 */
import type { Metadata } from 'next'
import { APP_INFO, SUPPORT_GUIDE_POSTING } from '@tenda/shared'
import { SupportShell, SupportAccordion, GuideSteps } from '@/components/public/SupportArticle'

export const metadata: Metadata = {
  title: `Posting a Gig · ${APP_INFO.name}`,
  description: 'Create a task, review work, and handle disputes on Tenda.',
}

export default function PostingGuidePage() {
  return (
    <SupportShell title="Posting a Gig">
      {SUPPORT_GUIDE_POSTING.map((section, i) => (
        <SupportAccordion key={section.title} title={section.title} defaultOpen={i === 0}>
          <GuideSteps steps={section.steps} />
        </SupportAccordion>
      ))}
    </SupportShell>
  )
}
