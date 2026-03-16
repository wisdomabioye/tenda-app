import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { MessageCircle, Flag } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/IconButton'
import { SeekerBadge } from '@/components/ui/SeekerBadge'
import { ReportSheet } from '@/components/moderation/ReportSheet'

interface PersonCardUser {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  reputation_score: number | null
  is_seeker?: boolean
}

interface Props {
  label: string
  user: PersonCardUser
  currentUserId: string
  /** ID of the context (gig or offer) — used as URL param when opening chat */
  contextId: string
  contextTitle: string
  /** When true, passes offerId/offerTitle to chat; otherwise passes gigId/gigTitle */
  isOffer?: boolean
  showMessageButton?: boolean
}

export function PersonCard({
  label,
  user,
  currentUserId,
  contextId,
  contextTitle,
  isOffer = false,
  showMessageButton = true,
}: Props) {
  const { theme } = useUnistyles()
  const router = useRouter()
  const [reportOpen, setReportOpen] = useState(false)

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Anonymous'
  const isSelf = currentUserId === user.id

  function handleMessage() {
    const param = isOffer ? 'offerId' : 'gigId'
    const titleParam = isOffer ? 'offerTitle' : 'gigTitle'
    router.push(
      `/chat/${user.id}?${param}=${contextId}&${titleParam}=${encodeURIComponent(contextTitle)}` as Parameters<typeof router.push>[0]
    )
  }

  return (
    <>
      <Text variant="subheading">{label}</Text>
      <View style={s.spacer} />
      <Card variant="outlined">
        <View style={s.row}>
          <Avatar size="md" name={displayName} src={user.avatar_url} />
          <View style={s.info}>
            <View style={s.nameRow}>
              <Text variant="body" weight="semibold">{displayName}</Text>
              {user.is_seeker && <SeekerBadge variant="compact" />}
            </View>
            <Text variant="caption" color={theme.colors.textSub}>
              {user.reputation_score ?? 0} reputation
            </Text>
          </View>
          {!isSelf && showMessageButton && (
            <IconButton
              icon={<MessageCircle size={20} color={theme.colors.primary} />}
              onPress={handleMessage}
              variant="ghost"
            />
          )}
          {!isSelf && (
            <IconButton
              icon={<Flag size={18} color={theme.colors.textFaint} />}
              onPress={() => setReportOpen(true)}
              variant="ghost"
            />
          )}
        </View>
      </Card>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="user"
        contentId={user.id}
      />
    </>
  )
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info:    { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  spacer:  { height: spacing.sm },
})
