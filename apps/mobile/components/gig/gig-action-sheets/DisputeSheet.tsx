import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { spacing } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spacer } from '@/components/ui/Spacer'
import { BottomSheet } from '@/components/ui/BottomSheet'

/** Raise-a-dispute sheet. Owns the reason field; resets it when closed. */
export function DisputeSheet({
  visible,
  onClose,
  onDisputeReady,
}: {
  visible: boolean
  onClose: () => void
  onDisputeReady: (reason: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  function close() {
    setReason('')
    onClose()
  }

  async function handleDispute() {
    if (!reason.trim()) return
    setLoading(true)
    try {
      if (await onDisputeReady(reason.trim())) close()
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet visible={visible} onClose={close} title="Raise a dispute">
      <Input
        label="Reason"
        placeholder="Describe the issue clearly..."
        helper="An admin will review and reach out. Max 2000 characters."
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={5}
        style={s.multiline}
        maxLength={2000}
      />
      <Spacer size={spacing.md} />
      <Button variant="danger" size="xl" fullWidth disabled={!reason.trim()} loading={loading} onPress={handleDispute}>
        Raise Dispute
      </Button>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  multiline: { minHeight: 80, textAlignVertical: 'top' },
})
