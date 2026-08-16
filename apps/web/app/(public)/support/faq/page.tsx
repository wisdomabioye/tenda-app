import type { Metadata } from 'next'
import { SUPPORT_FAQS, APP_INFO } from '@tenda/shared'
import { SupportShell, SupportAccordion } from '@/components/public/SupportArticle'

export const metadata: Metadata = {
  title: `FAQ & Support · ${APP_INFO.name}`,
  description: 'Answers to the most common questions about Tenda.',
}

export default function FaqPage() {
  return (
    <SupportShell title="FAQ & Support">
      <div className="flex flex-col gap-2">
        {SUPPORT_FAQS.map((faq, i) => (
          <SupportAccordion key={faq.question} title={faq.question} defaultOpen={i === 0}>
            <p className="text-sm leading-6 text-content-secondary">{faq.answer}</p>
          </SupportAccordion>
        ))}
      </div>
      <p className="text-sm text-content-secondary">
        Still stuck? Email{' '}
        <a href={`mailto:${APP_INFO.support.email}`} className="font-semibold text-brand-primary hover:underline">
          {APP_INFO.support.email}
        </a>
        .
      </p>
    </SupportShell>
  )
}
