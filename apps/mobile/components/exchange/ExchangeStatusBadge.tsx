import { Badge } from '@/components/ui/Badge'
import type { ExchangeOfferStatus } from '@tenda/shared'

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'accent' | 'neutral'

const VARIANT: Record<ExchangeOfferStatus, BadgeTone> = {
  draft:     'neutral',
  open:      'success',
  accepted:  'brand',
  paid:      'warning',
  completed: 'success',
  disputed:  'danger',
  resolved:  'neutral',
  cancelled: 'neutral',
  expired:   'neutral',
}

const LABEL: Record<ExchangeOfferStatus, string> = {
  draft:     'Draft',
  open:      'Open',
  accepted:  'In progress',
  paid:      'In payment',
  completed: 'Completed',
  disputed:  'Disputed',
  resolved:  'Resolved',
  cancelled: 'Cancelled',
  expired:   'Expired',
}

interface Props {
  status: ExchangeOfferStatus
}

export function ExchangeStatusBadge({ status }: Props) {
  return <Badge variant={VARIANT[status]} label={LABEL[status]} />
}
