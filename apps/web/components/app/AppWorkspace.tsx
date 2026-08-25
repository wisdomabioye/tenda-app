'use client'

/**
 * Client half of the (app) layout: the authed session's lifecycle plus the
 * workspace shell.
 *
 * The realtime wiring lives HERE rather than in WorkspaceShell because it
 * belongs to whatever owns the session for its whole lifetime. This component
 * sits in the layout, so it survives every navigation inside (app) — the
 * socket is opened once, not re-opened per route.
 */
import type { ReactNode } from 'react'
import { useSelectedLayoutSegment, useSelectedLayoutSegments } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useRealtimeConnection } from '@/hooks/connectivity/useRealtimeConnection'
import { useInboxRealtime } from '@/hooks/chat/useInboxRealtime'
import { useNotificationsRealtime } from '@/hooks/notifications/useNotificationsRealtime'
import { DetailPane, WorkspaceShell } from '@/components/app/workspace'
import { paneBackFor, selectionKey, surfaceTitle } from '@/components/app/workspace/surfaces'
import { CommandPalette, surfaceCommands } from '@/components/app/workspace/palette'
import { useCommandPalette } from '@/hooks/workspace/useCommandPalette'

export function AppWorkspace({ list, children }: { list?: ReactNode; children: ReactNode }) {
  const user = useAuthStore((s) => s.user)

  // Socket lifecycle + the two realtime mirrors the bell and inbox badges
  // read. Previously mounted by AppShell; the shell swap must not drop them.
  useRealtimeConnection()
  useInboxRealtime()
  useNotificationsRealtime()

  const surface = useSelectedLayoutSegment()
  const segments = useSelectedLayoutSegments()
  const selection = selectionKey(segments)
  const paneBack = paneBackFor(surface, selection)

  // Hosted here so ⌘K works on every authed surface, not only ones with a
  // list column to put the button in.
  const { open: paletteOpen, closePalette } = useCommandPalette()

  return (
    <>
      {paletteOpen && (
        <CommandPalette
          commands={surfaceCommands()}
          onClose={closePalette}
        />
      )}
      <WorkspaceShell
        user={user}
        list={list}
        // The URL, not the presence of a pane, decides which column survives
        // the ≤900px collapse — the detail pane is always mounted.
        hasSelection={selection !== null}
        detail={
          <DetailPane
            label={surfaceTitle(surface)}
            selectionKey={selection}
            // Only when a row is open AND the surface has a list to go back
            // to. The affordance is CSS-gated to ≤900px, where the list is
            // off-screen; above that it would point at a column already
            // beside it.
            backHref={paneBack?.href}
            backLabel={paneBack?.label}
          >
            {children}
          </DetailPane>
        }
      />
    </>
  )
}
