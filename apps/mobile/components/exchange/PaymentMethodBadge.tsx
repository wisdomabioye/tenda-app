import { Badge } from '@/components/ui/Badge'

interface Props {
  method: string
}

export function PaymentMethodBadge({ method }: Props) {
  return <Badge variant="neutral" label={method} size="sm" />
}
