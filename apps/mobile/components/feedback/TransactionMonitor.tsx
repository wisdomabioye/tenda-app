import { useEffect, useRef, useSyncExternalStore } from 'react'
import { View, Modal, StyleSheet, ActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CheckCircle, XCircle, Wallet } from 'lucide-react-native'
import { radius, spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import {
  abortPendingWalletRequest,
  hasPendingWalletRequest,
  subscribePendingWalletRequest,
} from '@/wallet'
import type { TxPhase } from '@/hooks/useEscrowActions'
import { ESCROW_CONFIRM_DISMISS_MS, useEscrowTransactionSync } from '@/hooks/escrow-sync'

interface TransactionMonitorProps {
  signature: string | null
  onConfirmed: () => void
  onFailed: (msg: string) => void
  /** When true, shows one-time setup messaging instead of the generic confirming text. */
  setupPhase?: boolean
  /**
   * Subscribe to `escrow:<id>` for the server-applied confirmation frame.
   * RPC polling remains active as an independent missed-frame fallback.
   */
  escrowId?: string
  /**
   * CAIP-2 chain of the tx (CO3). Selects the RPC fallback: solana
   * signature-status (also the default for legacy callers), or EVM receipt
   * polling through the connected provider for eip155 chains.
   */
  chainId?: string
  /**
   * Lifecycle before the signature exists (build → wallet signature). When
   * provided, the modal opens as soon as the phase leaves 'idle', so the
   * user gets "Approve in your wallet" guidance while the popup is up — not
   * a blank gap. Omitted → legacy behaviour, the modal shows only once a
   * signature is broadcast.
   */
  phase?: TxPhase
  /** Present-tense verb for the confirming heading, e.g. "Releasing payment". */
  actionLabel?: string
  /**
   * Overrides the caption under the "Preparing transaction…" heading. Gig
   * creation runs the moderation gate here (a several-second LLM review before
   * the wallet opens), so it sets this to explain the wait rather than leave
   * the user staring at a generic spinner.
   */
  preparingCaption?: string
  /** Authoritative API projection check after an RPC receipt confirms. */
  checkApplied: () => Promise<boolean>
}

/** Visual state = internal poll result once broadcast, else the pre-sign phase. */
type Display = 'preparing' | 'signing' | 'confirming' | 'confirmed' | 'deferred' | 'failed'

export function TransactionMonitor({ signature, onConfirmed, onFailed, setupPhase = false, escrowId, chainId, phase, actionLabel, preparingCaption, checkApplied }: TransactionMonitorProps) {
  const { theme } = useUnistyles()
  const confirmation = useEscrowTransactionSync({ signature, escrowId, chainId, checkApplied })
  const confirmedRef = useRef(onConfirmed)
  confirmedRef.current = onConfirmed
  // True only while a guarded WalletConnect request is awaiting the wallet —
  // the one moment a Cancel can actually abort something. Solana/MWA signing
  // never registers here, so its signing view stays button-free.
  const canCancelSigning = useSyncExternalStore(
    subscribePendingWalletRequest,
    hasPendingWalletRequest,
  )

  useEffect(() => {
    if (confirmation.state !== 'applied') return
    const timer = setTimeout(() => confirmedRef.current(), ESCROW_CONFIRM_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [confirmation.state])

  function handleDismiss() {
    onFailed(confirmation.failure || 'Transaction failed')
  }

  // The confirming spinner covers everything from broadcast onward; the phase
  // (when supplied) drives the pre-signature messaging.
  const phaseActive = phase !== undefined && phase !== 'idle'
  const open = phaseActive || !!signature
  if (!open) return null

  const display: Display =
    confirmation.state === 'applied'
      ? 'confirmed'
      : confirmation.state === 'deferred'
        ? 'deferred'
        : confirmation.state === 'failed'
        ? 'failed'
        : phase === 'preparing'
          ? 'preparing'
          : phase === 'signing'
            ? 'signing'
            : 'confirming'

  const confirmingTitle = actionLabel
    ? `${actionLabel}…`
    : setupPhase
      ? 'Setting up worker account…'
      : 'Confirming transaction…'

  return (
    <Modal transparent animationType="fade" visible={open}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: theme.colors.surface.card }]}>
          {display === 'preparing' && (
            <>
              <ActivityIndicator size="large" color={theme.colors.brand.primary} />
              <Text variant="subheading" align="center" style={s.title}>
                Preparing transaction…
              </Text>
              <Text variant="caption" color={theme.colors.content.secondary} align="center">
                {preparingCaption ?? 'Getting your request ready, one moment.'}
              </Text>
            </>
          )}

          {display === 'signing' && (
            <>
              <Wallet size={48} color={theme.colors.brand.primary} />
              <Text variant="subheading" align="center" style={s.title}>
                Approve in your wallet
              </Text>
              <Text variant="caption" color={theme.colors.content.secondary} align="center">
                Your wallet is opening — approve the transaction there to continue.
              </Text>
              {canCancelSigning && (
                <Button variant="outline" size="md" onPress={abortPendingWalletRequest}>
                  Cancel
                </Button>
              )}
            </>
          )}

          {display === 'confirming' && (
            <>
              <ActivityIndicator size="large" color={theme.colors.brand.primary} />
              <Text variant="subheading" align="center" style={s.title}>
                {confirmation.state === 'syncing' ? 'Syncing with Tenda…' : confirmingTitle}
              </Text>
              <Text variant="caption" color={theme.colors.content.secondary} align="center">
                {confirmation.state === 'syncing'
                  ? 'Confirmed on-chain. Updating your gig now.'
                  : setupPhase
                  ? 'One-time setup required to accept gigs. Please wait.'
                  : 'Confirming on-chain. This may take a few seconds.'}
              </Text>
            </>
          )}

          {display === 'confirmed' && (
            <>
              <CheckCircle size={56} color={theme.colors.feedback.success.base} />
              <Text variant="subheading" align="center" style={s.title}>
                {setupPhase ? 'Worker account created!' : 'Transaction confirmed!'}
              </Text>
            </>
          )}

          {display === 'failed' && (
            <>
              <XCircle size={56} color={theme.colors.feedback.danger.base} />
              <Text variant="subheading" align="center" style={s.title}>
                Transaction issue
              </Text>
              <Text variant="caption" color={theme.colors.content.secondary} align="center">
                {confirmation.failure}
              </Text>
              <Button variant="outline" size="md" onPress={handleDismiss}>
                Dismiss
              </Button>
            </>
          )}

          {display === 'deferred' && (
            <>
              <ActivityIndicator size="large" color={theme.colors.brand.primary} />
              <Text variant="subheading" align="center" style={s.title}>
                Sync is taking longer
              </Text>
              <Text variant="caption" color={theme.colors.content.secondary} align="center">
                {confirmation.failure}
              </Text>
              <Button variant="outline" size="md" onPress={handleDismiss}>
                Continue
              </Button>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    marginTop: spacing.sm,
  },
})
