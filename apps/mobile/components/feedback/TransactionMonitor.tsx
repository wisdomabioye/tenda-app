import { useEffect, useState } from 'react'
import { View, Modal, StyleSheet, ActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CheckCircle, XCircle, Wallet } from 'lucide-react-native'
import { radius, spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { getTransactionStatus, getEvmTransactionStatus } from '@/wallet'
import { useRealtimeStore, subscribeEscrowChannel } from '@/stores/realtime.store'
import type { TxPhase } from '@/hooks/useEscrowActions'

const POLL_INTERVAL_MS = 2_000
const POLL_FALLBACK_MS = 30_000  // RPC cadence while the WS channel is live
const TIMEOUT_MS = 60_000
const CONFIRM_DISMISS_MS = 800

type TxState = 'waiting' | 'confirmed' | 'failed'

interface TransactionMonitorProps {
  signature: string | null
  onConfirmed: () => void
  onFailed: (msg: string) => void
  /** When true, shows one-time setup messaging instead of the generic confirming text. */
  setupPhase?: boolean
  /**
   * v2 escrow flows: subscribe `escrow:<id>` so confirmation arrives over
   * WS (verify-tx republish); the RPC poll stretches to a slow fallback
   * while the socket is healthy. Legacy flows omit it and keep the fast poll.
   */
  escrowId?: string
  /**
   * CAIP-2 chain of the tx (CO3). Selects the RPC fallback: solana
   * signature-status (also the default for legacy callers), EVM receipt
   * poll via the connected provider for eip155, WS-only for anything else.
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
}

/** Visual state = internal poll result once broadcast, else the pre-sign phase. */
type Display = 'preparing' | 'signing' | 'confirming' | 'confirmed' | 'failed'

export function TransactionMonitor({ signature, onConfirmed, onFailed, setupPhase = false, escrowId, chainId, phase, actionLabel }: TransactionMonitorProps) {
  const { theme } = useUnistyles()
  const [txState, setTxState] = useState<TxState>('waiting')
  const [failMsg, setFailMsg] = useState('')

  useEffect(() => {
    setTxState('waiting')
    setFailMsg('')
    if (!signature) return

    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const deadline = Date.now() + TIMEOUT_MS

    function settle(state: Exclude<TxState, 'waiting'>, msg = '') {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      setTxState(state)
      if (state === 'confirmed') setTimeout(() => onConfirmed(), CONFIRM_DISMISS_MS)
      else setFailMsg(msg)
    }

    // Live path, escrow events pushed by the verify-tx pipeline.
    const unsubscribe = escrowId
      ? subscribeEscrowChannel(escrowId, (frame) => {
          if (frame.tx_ref === signature) settle('confirmed')
        })
      : null

    async function poll() {
      if (settled || !signature) return
      if (Date.now() > deadline) {
        settle('failed', 'Transaction timed out. It will sync when confirmed.')
        return
      }
      try {
        // CO3: pick the RPC fallback by chain. Unknown namespaces get no
        // poll at all, confirmation rides the WS channel alone.
        const namespace = chainId?.split(':')[0] ?? 'solana'
        if (namespace === 'solana') {
          const status = await getTransactionStatus(signature)
          if (status === 'confirmed' || status === 'finalized') return settle('confirmed')
          if (status === 'failed') return settle('failed', 'Transaction failed on chain.')
        } else if (namespace === 'eip155') {
          const status = await getEvmTransactionStatus(signature)
          if (status === 'confirmed') return settle('confirmed')
          if (status === 'failed') return settle('failed', 'Transaction failed on chain.')
        }
        // 'not_found' / WS-only namespace → keep polling
      } catch {
        // RPC error, keep polling
      }
      schedule()
    }

    function schedule() {
      if (settled) return
      const slow = escrowId !== undefined && useRealtimeStore.getState().connected
      timer = setTimeout(() => { void poll() }, slow ? POLL_FALLBACK_MS : POLL_INTERVAL_MS)
    }

    void poll()

    return () => {
      settled = true
      if (timer) clearTimeout(timer)
      unsubscribe?.()
    }
  }, [signature, escrowId, chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    onFailed(failMsg || 'Transaction failed')
  }

  // The confirming spinner covers everything from broadcast onward; the phase
  // (when supplied) drives the pre-signature messaging.
  const phaseActive = phase !== undefined && phase !== 'idle'
  const open = phaseActive || !!signature
  if (!open) return null

  const display: Display =
    txState === 'confirmed'
      ? 'confirmed'
      : txState === 'failed'
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
                Getting your request ready, one moment.
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
            </>
          )}

          {display === 'confirming' && (
            <>
              <ActivityIndicator size="large" color={theme.colors.brand.primary} />
              <Text variant="subheading" align="center" style={s.title}>
                {confirmingTitle}
              </Text>
              <Text variant="caption" color={theme.colors.content.secondary} align="center">
                {setupPhase
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
                {failMsg}
              </Text>
              <Button variant="outline" size="md" onPress={handleDismiss}>
                Dismiss
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
