import { redirect } from 'next/navigation'

/**
 * The root is the canonical workspace entry. Its client-side AuthGate decides
 * whether the localStorage-backed session may render it.
 */
export default function RootPage() {
  redirect('/home')
}
