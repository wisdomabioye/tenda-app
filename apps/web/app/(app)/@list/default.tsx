/**
 * Fallback for the @list slot.
 *
 * Next renders this whenever the current surface has no `@list/<surface>`
 * entry, and on any hard navigation it cannot recover a slot's active state
 * for. Returning null (rather than notFound()) is deliberate: most surfaces
 * legitimately have no list column, and WorkspaceShell reads a null slot as
 * "no list" and collapses the grid to rail + content.
 *
 * To give a surface a list, add `app/(app)/@list/<surface>/page.tsx`. Nothing
 * else changes — see components/app/workspace/surfaces.ts for the contract.
 */
export default function ListSlotDefault() {
  return null
}
