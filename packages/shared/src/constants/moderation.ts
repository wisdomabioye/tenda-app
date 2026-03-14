export const REPORT_CONTENT_TYPES = ['gig', 'message', 'user', 'review'] as const
export const REPORT_REASONS       = ['spam', 'harassment', 'inappropriate', 'fraud', 'other'] as const
export const REPORT_STATUSES      = ['pending', 'reviewed', 'actioned', 'dismissed'] as const

export type ReportContentType = (typeof REPORT_CONTENT_TYPES)[number]
export type ReportReason      = (typeof REPORT_REASONS)[number]
export type ReportStatus      = (typeof REPORT_STATUSES)[number]

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam:          'Spam',
  harassment:    'Harassment',
  inappropriate: 'Inappropriate content',
  fraud:         'Fraud or scam',
  other:         'Other',
}
