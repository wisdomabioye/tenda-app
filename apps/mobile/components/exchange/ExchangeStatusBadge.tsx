import { Badge } from '@/components/ui/Badge'
import type { ExchangeOfferStatus } from '@tenda/shared'

const VARIANT: Record<ExchangeOfferStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft:     'neutral',
  open:      'info',
  accepted:  'warning',
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
  accepted:  'Accepted',
  paid:      'Awaiting Confirmation',
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
