/**
 * #85 — bootstrap admin login email (ops script, NOT a runtime surface):
 *
 *   pnpm admin:grant-email -- <user-id> <email>
 *
 * Attaches (or rotates) the dashboard login email for an EXISTING admin
 * (users.role must already be dispute_admin/super_admin — the script
 * refuses to touch roles). This is how the FIRST super_admin gets dashboard
 * access; afterwards the #87 provisioning surface (audited, added_by
 * stamped) is the normal path. added_by stays NULL here to mark ops grants.
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@tenda/shared/db/schema'
import { grantAdminEmail } from '@server/lib/admin-auth'

async function main(): Promise<void> {
  // pnpm forwards the conventional `--` separator verbatim — drop it.
  const [user_id, email] = process.argv.slice(2).filter((a) => a !== '--')
  if (user_id === undefined || email === undefined) {
    console.error('Usage: pnpm admin:grant-email -- <user-id> <email>')
    process.exitCode = 1
    return
  }
  const url = process.env.DATABASE_URL
  if (url === undefined || url === '') {
    console.error('DATABASE_URL is not set')
    process.exitCode = 1
    return
  }

  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema })
  try {
    const granted = await grantAdminEmail(db, { user_id, email, added_by: null })
    console.log(`✓ dashboard login '${granted.email}' granted to ${granted.role} ${granted.user_id}`)
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

void main()
