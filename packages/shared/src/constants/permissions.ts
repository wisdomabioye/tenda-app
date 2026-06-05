/**
 * Code-level permission map (CO8 decision, 2026-06-05). Route guards check
 * PERMISSIONS — not roles — so granting a future role (e.g. a read-only
 * support agent) is a one-line map edit, and graduating to DB-driven RBAC
 * later swaps this module's lookup without touching any call site.
 *
 * Shared (not server-only) so an admin frontend can hide UI the caller's
 * role can't use.
 *
 * Conventions:
 *   - `<domain>.read` / `<domain>.<verb>` — reads split from mutations so a
 *     read-only role stays expressible.
 *   - POST /v1/escrows/:id/resolve is NOT here: the escrow state machine
 *     already derives the 'dispute_admin' caller (lib/escrow-routes.ts);
 *     double-guarding it would create two sources of truth.
 */

import type { AdminRole } from '../types/user'

export const PERMISSIONS = [
  // dispute triage queue (+ #77 mediation threads)
  'disputes.read',
  'disputes.mediate',
  // admin escrow browser (+ #70 takedown, #78 featured rail)
  'escrows.read',
  'escrows.takedown',
  'escrows.feature',
  // user reports
  'reports.read',
  'reports.action',
  // user management
  'users.read',
  'users.suspend',
  'users.assign_roles',
  // reputation / standing
  'standing.read',
  'standing.manage',
  // money + ops dashboards
  'finance.read',
  'metrics.read',
  // platform config
  'config.read',
  'config.write',
  // announcements
  'announcements.read',
  'announcements.write',
  // moderation verdict queue + overrides
  'moderation.read',
  'moderation.override',
  // fiat rails (providers, intents, reconciliation)
  'fiat.read',
  'fiat.manage',
  // broadcast push
  'push.broadcast',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Role → granted permissions. Keyed by AdminRole (exhaustive: adding a role
 * to the enum forces an entry here). 'user' holds no permissions by
 * construction — the guard treats an unmapped role as the empty set.
 */
export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, ReadonlyArray<Permission>>> = {
  // Scoped to the dispute workflow — mirrors the pre-permission-layer
  // requireRole lists exactly (disputes + admin escrow read).
  dispute_admin: ['disputes.read', 'disputes.mediate', 'escrows.read'],
  // Everything, by construction.
  super_admin: PERMISSIONS,
}

// Precomputed per-role permission sets — O(1) checks. Shared by the server
// guards (requirePermission) and the admin dashboard (nav filtering, #90)
// so the two surfaces can never disagree on what a role may do.
const PERMISSION_SETS: ReadonlyMap<string, ReadonlySet<Permission>> = new Map(
  Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [role, new Set(perms)]),
)

/** True iff `role` holds `permission`; unmapped roles hold the empty set. */
export function hasPermission(role: string, permission: Permission): boolean {
  return PERMISSION_SETS.get(role)?.has(permission) ?? false
}
