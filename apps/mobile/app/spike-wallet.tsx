import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui/Header'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { useSpikeWallet, WalletSpikeProvider } from '@/wallet/spike/provider'
import type { Namespace } from '@/wallet/spike/types'

interface LogEntry {
  ts: number
  level: 'info' | 'ok' | 'err'
  text: string
}

function formatNamespace(ns: Namespace): string {
  return ns === 'eip155' ? 'EVM' : 'Solana'
}

function SpikeWalletInner() {
  const wallet = useSpikeWallet()
  const [logs, setLogs] = useState<LogEntry[]>([])

  const log = (level: LogEntry['level'], text: string) => {
    setLogs((prev) => [{ ts: Date.now(), level, text }, ...prev].slice(0, 50))
  }

  useEffect(() => {
    if (wallet.lastError) log('err', wallet.lastError)
  }, [wallet.lastError])

  useEffect(() => {
    if (wallet.account) log('ok', `connected ${wallet.account.walletId} (${wallet.account.address.slice(0, 12)}…)`)
  }, [wallet.account])

  const handleConnect = () => {
    log('info', 'Opening wallet picker…')
    wallet.openConnectModal()
  }

  const handleSign = async () => {
    if (!wallet.account) return
    const message = `Tenda spike sign-test\nWallet: ${wallet.account.address}\nChain: ${wallet.account.chainId}\nTimestamp: ${new Date().toISOString()}`
    const startedAt = Date.now()
    log('info', `signMessage (${formatNamespace(wallet.account.namespace)})…`)
    try {
      const result = await wallet.signMessage(message)
      const ms = Date.now() - startedAt
      log('ok', `signed in ${ms}ms — ${result.signature.slice(0, 24)}…`)
    } catch (err) {
      log('err', err instanceof Error ? err.message : 'unknown sign error')
    }
  }

  const handleDisconnect = async () => {
    try {
      await wallet.disconnect()
      log('info', 'disconnected')
    } catch (err) {
      log('err', err instanceof Error ? err.message : 'unknown disconnect error')
    }
  }

  return (
    <ScreenContainer>
      <Header title="Wallet Spike" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text variant="label">Status</Text>
          <Text variant="body">
            {wallet.isConnected ? 'Connected' : wallet.isConnecting ? 'Connecting…' : 'Disconnected'}
          </Text>
          {wallet.account && (
            <>
              <Text variant="caption">Namespace: {formatNamespace(wallet.account.namespace)}</Text>
              <Text variant="caption">Chain: {wallet.account.chainId}</Text>
              <Text variant="caption" selectable>
                Address: {wallet.account.address}
              </Text>
            </>
          )}
        </View>

        <View style={styles.actions}>
          {!wallet.isConnected ? (
            <Button onPress={handleConnect} loading={wallet.isConnecting}>
              Connect wallet
            </Button>
          ) : (
            <>
              <Button onPress={handleSign}>Sign auth message</Button>
              <Button onPress={handleDisconnect} variant="secondary">
                Disconnect
              </Button>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text variant="label">Event log</Text>
          {logs.length === 0 && <Text variant="caption">No events yet.</Text>}
          {logs.map((entry) => (
            <Text key={entry.ts} variant="caption" style={[styles.logLine, levelStyles[entry.level]]}>
              {new Date(entry.ts).toLocaleTimeString()} · {entry.text}
            </Text>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

export default function SpikeWalletScreen() {
  return (
    <WalletSpikeProvider>
      <SpikeWalletInner />
    </WalletSpikeProvider>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 4,
  },
  actions: {
    gap: 12,
  },
  logLine: {
    fontFamily: 'SpaceGrotesk_400Regular',
  },
})

const levelStyles = StyleSheet.create({
  info: { opacity: 0.7 },
  ok: { color: '#16a34a' },
  err: { color: '#dc2626' },
})
