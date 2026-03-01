import { useEffect, useRef, useState } from 'react'
import { View, Modal, StyleSheet, ActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CheckCircle, XCircle } from 'lucide-react-native'
import { radius, spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { getTransactionStatus } from '@/wallet'

const POLL_INTERVAL_MS = 2_000
const TIMEOUT_ATTEMPTS = 30   // 60 s total

type TxState = 'waiting' | 'confirmed' | 'failed'

interface TransactionMonitorProps {
  signature: string | null
  onConfirmed: () => void
  onFailed: (msg: string) => void
  /** When true, shows one-time setup messaging instead of the generic confirming text. */
  setupPhase?: boolean
}

export function TransactionMonitor({ signature, onConfirmed, onFailed, setupPhase = false }: TransactionMonitorProps) {
  const { theme } = useUnistyles()
  const [txState, setTxState] = useState<TxState>('waiting')
  const [failMsg, setFailMsg] = useState('')
  const attempts = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!signature) {
      setTxState('waiting')
      attempts.current = 0
      return
    }

    setTxState('waiting')
    attempts.current = 0

    timerRef.current = setInterval(async () => {
      attempts.current += 1

      if (attempts.current > TIMEOUT_ATTEMPTS) {
        clearInterval(timerRef.current!)
        setTxState('failed')
        setFailMsg('Transaction timed out. It will sync when confirmed.')
        return
      }

      try {
        const status = await getTransactionStatus(signature)
        if (status === 'confirmed' || status === 'finalized') {
          clearInterval(timerRef.current!)
          setTxState('confirmed')
          setTimeout(() => onConfirmed(), 800)
        } else if (status === 'failed') {
          clearInterval(timerRef.current!)
          setTxState('failed')
          setFailMsg('Transaction failed on chain.')
        }
        // 'not_found' → keep polling
      } catch {
        // RPC error — keep polling
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [signature]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    onFailed(failMsg || 'Transaction failed')
  }

  if (!signature) return null

  return (
    <Modal transparent animationType="fade" visible={!!signature}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: theme.colors.surface }]}>
          {txState === 'waiting' && (
            <>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text variant="subheading" align="center" style={s.title}>
                {setupPhase ? 'Setting up worker account…' : 'Confirming transaction…'}
              </Text>
              <Text variant="caption" color={theme.colors.textSub} align="center">
                {setupPhase
                  ? 'One-time setup required to accept gigs. Please wait.'
                  : 'This may take a few seconds. Please wait.'}
              </Text>
            </>
          )}

          {txState === 'confirmed' && (
            <>
              <CheckCircle size={56} color={theme.colors.success} />
              <Text variant="subheading" align="center" style={s.title}>
                {setupPhase ? 'Worker account created!' : 'Transaction confirmed!'}
              </Text>
            </>
          )}

          {txState === 'failed' && (
            <>
              <XCircle size={56} color={theme.colors.danger} />
              <Text variant="subheading" align="center" style={s.title}>
                Transaction issue
              </Text>
              <Text variant="caption" color={theme.colors.textSub} align="center">
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
