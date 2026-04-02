import { Badge } from '@/components/ui/badge'
import type { GigStatus, ExchangeOfferStatus, UserStatus } from '@tenda/shared'

export function GigStatusBadge({ status }: { status: GigStatus }) {
  const variant =
    status === 'completed' ? 'default' :
    status === 'disputed' || status === 'cancelled' || status === 'expired' ? 'destructive' :
    'outline'
  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

export function ExchangeStatusBadge({ status }: { status: ExchangeOfferStatus }) {
  const variant =
    status === 'completed' ? 'default' :
    status === 'disputed' || status === 'cancelled' || status === 'expired' ? 'destructive' :
    'outline'
  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge variant={status === 'active' ? 'default' : 'destructive'} className="capitalize">
      {status}
    </Badge>
  )
}
