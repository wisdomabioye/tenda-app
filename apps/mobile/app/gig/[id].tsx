import { View, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Calendar,
  Share2,
} from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { Divider } from '@/components/ui/Divider'
import { Spacer } from '@/components/ui/Spacer'
import { EmptyState } from '@/components/ui/EmptyState'
import { GigStatusBadge } from '@/components/gig'
import {
  getMockGigDetail,
  MOCK_CURRENT_USER,
  getCategoryColor,
  CATEGORY_META,
} from '@/data/mock'
import type { ColorScheme } from '@/theme/tokens'

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDeadline(deadline: Date): string {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return 'Expired'
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `${days} days left`
}

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { theme } = useUnistyles()

  const gig = getMockGigDetail(id ?? '')

  if (!gig) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Gig not found"
          description="This gig may have been removed"
          action={{ label: 'Go back', onPress: () => router.back() }}
        />
      </ScreenContainer>
    )
  }

  const categoryMeta = CATEGORY_META.find((c) => c.key === gig.category)
  const categoryColorKey = getCategoryColor(gig.category) as keyof ColorScheme
  const categoryColor = theme.colors[categoryColorKey]
  const isOwner = gig.poster_id === MOCK_CURRENT_USER.id
  const canAccept = gig.status === 'open' && !isOwner

  const posterName = [gig.poster.first_name, gig.poster.last_name]
    .filter(Boolean)
    .join(' ') || 'Anonymous'

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top bar */}
      <View style={[s.topBar, { borderBottomColor: theme.colors.borderFaint }]}>
        <IconButton
          icon={<ArrowLeft size={22} color={theme.colors.text} />}
          onPress={() => router.back()}
          variant="ghost"
        />
        <IconButton
          icon={<Share2 size={20} color={theme.colors.text} />}
          onPress={() => {}}
          variant="ghost"
        />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <GigStatusBadge status={gig.status} />
          {categoryMeta && (
            <View style={[s.categoryBadge, { backgroundColor: `${categoryColor}20` }]}>
              <View style={[s.categoryDot, { backgroundColor: categoryColor }]} />
              <Text variant="caption" weight="medium" color={categoryColor}>
                {categoryMeta.label}
              </Text>
            </View>
          )}
        </View>

        <Spacer size={spacing.sm} />

        <Text variant="heading">{gig.title}</Text>

        <Spacer size={spacing.md} />

        <MoneyText amount={gig.payment} size={32} />

        <Spacer size={spacing.lg} />

        {/* Meta info */}
        <View style={s.metaGrid}>
          <View style={s.metaItem}>
            <MapPin size={16} color={theme.colors.textFaint} />
            <Text variant="body" color={theme.colors.textSub}>
              {gig.address ?? gig.city}
            </Text>
          </View>
          <View style={s.metaItem}>
            <Clock size={16} color={theme.colors.textFaint} />
            <Text variant="body" color={theme.colors.textSub}>
              {formatDeadline(gig.deadline)}
            </Text>
          </View>
          <View style={s.metaItem}>
            <Calendar size={16} color={theme.colors.textFaint} />
            <Text variant="body" color={theme.colors.textSub}>
              {formatDate(gig.deadline)}
            </Text>
          </View>
        </View>

        <Divider />

        {/* Description */}
        <Text variant="subheading">Description</Text>
        <Spacer size={spacing.sm} />
        <Text variant="body" color={theme.colors.textSub}>
          {gig.description}
        </Text>

        <Divider />

        {/* Poster */}
        <Text variant="subheading">Posted by</Text>
        <Spacer size={spacing.sm} />
        <Card variant="outlined">
          <View style={s.posterRow}>
            <View style={s.posterInfo}>
              <Avatar
                size="md"
                name={posterName}
                src={gig.poster.avatar_url}
              />
              <View>
                <Text variant="body" weight="semibold">{posterName}</Text>
                <Text variant="caption" color={theme.colors.textSub}>
                  {gig.poster.reputation_score ?? 0} reputation
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Worker (if assigned) */}
        {gig.worker && (
          <>
            <Spacer size={spacing.md} />
            <Text variant="subheading">Assigned to</Text>
            <Spacer size={spacing.sm} />
            <Card variant="outlined">
              <View style={s.posterRow}>
                <View style={s.posterInfo}>
                  <Avatar
                    size="md"
                    name={[gig.worker.first_name, gig.worker.last_name].filter(Boolean).join(' ')}
                    src={gig.worker.avatar_url}
                  />
                  <View>
                    <Text variant="body" weight="semibold">
                      {[gig.worker.first_name, gig.worker.last_name].filter(Boolean).join(' ') || 'Anonymous'}
                    </Text>
                    <Text variant="caption" color={theme.colors.textSub}>
                      {gig.worker.reputation_score ?? 0} reputation
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </>
        )}

        <Spacer size={spacing['2xl']} />
      </ScrollView>

      {/* Bottom CTA */}
      {canAccept && (
        <View style={[s.bottomBar, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.borderFaint }]}>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onPress={() => {
              // TODO: accept gig via API
            }}
          >
            Accept Gig
          </Button>
        </View>
      )}
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaGrid: {
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  posterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  posterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
  },
})
