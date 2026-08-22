import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/routes'

export default function LegacyPostPage() {
  redirect(ROUTES.createGig)
}
