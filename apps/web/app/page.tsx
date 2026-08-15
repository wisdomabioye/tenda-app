import { redirect } from 'next/navigation'

/**
 * Entry redirect. Anonymous visitors land on the public feed; once Stage 2
 * ships a session, a signed-in visitor is routed to /home instead (the
 * decision is client-side there — the server cannot see the localStorage JWT).
 */
export default function RootPage() {
  redirect('/gigs')
}
