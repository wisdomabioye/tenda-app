import { Badge } from '@/components/ui/Badge'
import { STATUS_BADGE_VARIANT, STATUS_LABEL } from '@/data/mock'
import type { GigStatus } from '@tenda/shared'

interface GigStatusBadgeProps {
  status: GigStatus
}

export function GigStatusBadge({ status }: GigStatusBadgeProps) {
  return (
    <Badge
      variant={STATUS_BADGE_VARIANT[status]}
      label={STATUS_LABEL[status]}
    />
  )
}
