import { redirect } from 'next/navigation'

export default function RootPage() {
  // /disputes is the one surface EVERY admin role can read
  // (dispute_admin lacks users.read — see shared ROLE_PERMISSIONS).
  redirect('/disputes')
}
