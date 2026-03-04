import { useState } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  Wallet,
  PlusCircle,
  Hammer,
  ShieldCheck,
  HelpCircle,
  BookOpen,
  ChevronRight,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Header, Text, Spacer, Input } from '@/components/ui'

interface Topic {
  icon: LucideIcon
  title: string
  description: string
  route: string
}

const TOPICS: Topic[] = [
  {
    icon: Wallet,
    title: 'Wallet Setup',
    description: 'Install Phantom or Solflare, connect, and troubleshoot issues',
    route: '/(support)/wallet',
  },
  {
    icon: PlusCircle,
    title: 'Posting a Gig',
    description: 'Create a gig, set a price, approve work, and manage disputes',
    route: '/(support)/posting',
  },
  {
    icon: Hammer,
    title: 'Working on a Gig',
    description: 'Find, accept, submit proof, and get paid for gigs',
    route: '/(support)/working',
  },
  {
    icon: ShieldCheck,
    title: 'Payments & Escrow',
    description: 'How escrow works, fee breakdown, disputes, and refunds',
    route: '/(support)/escrow',
  },
  {
    icon: HelpCircle,
    title: 'FAQ & Support',
    description: 'Common questions and how to reach us',
    route: '/(support)/faq',
  },
  {
    icon: BookOpen,
    title: 'Glossary',
    description: 'Plain English definitions of crypto and Tenda terms',
    route: '/(support)/glossary',
  },
]

function TopicCard({ icon: Icon, title, description, route }: Topic) {
  const { theme } = useUnistyles()
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push(route as Parameters<typeof router.push>[0])}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[s.iconBox, { backgroundColor: theme.colors.primaryTint }]}>
        <Icon size={20} color={theme.colors.primary} />
      </View>
      <View style={s.cardContent}>
        <Text variant="label" weight="semibold">{title}</Text>
        <Spacer size={2} />
        <Text variant="caption" color={theme.colors.textSub}>{description}</Text>
      </View>
      <ChevronRight size={16} color={theme.colors.textFaint} />
    </Pressable>
  )
}

export default function SupportIndexScreen() {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? TOPICS.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase()),
      )
    : TOPICS

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Help & Guide" showBack />
      <Spacer size={spacing.md} />

      <Input
        placeholder="Search topics..."
        value={query}
        onChangeText={setQuery}
      />
      <Spacer size={spacing.md} />

      {filtered.map((topic) => (
        <View key={topic.route}>
          <TopicCard {...topic} />
          <Spacer size={spacing.sm} />
        </View>
      ))}

      {filtered.length === 0 && (
        <Text variant="body" color="textSub" align="center">
          No topics match "{query}"
        </Text>
      )}
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
})
