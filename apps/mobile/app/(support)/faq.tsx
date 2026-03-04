import { Linking, View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { MessageCircle, Mail, Globe, XIcon, ExternalLink } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Header, Text, Spacer, Card, AccordionItem } from '@/components/ui'
import { APP_INFO } from '@/lib/app-info'

interface ContactRowProps {
  icon: React.ReactNode
  label: string
  value: string
  url: string
}

function ContactRow({ icon, label, value, url }: ContactRowProps) {
  const { theme } = useUnistyles()

  return (
    <Card variant="outlined" padding={spacing.sm} onPress={() => Linking.openURL(url)}>
      <View style={s.contactRow}>
        <View style={[s.contactIcon, { backgroundColor: theme.colors.primaryTint }]}>
          {icon}
        </View>
        <View style={s.contactText}>
          <Text variant="caption" color={theme.colors.textSub}>{label}</Text>
          <Text variant="label" weight="medium" color={theme.colors.textLink}>{value}</Text>
        </View>
      </View>
    </Card>
  )
}

const FAQS = [
  {
    question: 'Will my money be safe?',
    answer: "Yes. Payment is locked in a smart contract on the Solana blockchain, not held by Tenda. We can't touch your money. It's released only when you (the poster) approve the work, or returned to you if the gig expires or a dispute is resolved in your favour.",
  },
  {
    question: 'What if the client never approves?',
    answer: "If a poster doesn't approve or raise a dispute within the gig's time limit, the gig expires and you can raise a dispute through the app. For ongoing issues, contact our support team.",
  },
  {
    question: 'Can I lose my money as a poster?',
    answer: "Only if you approve work you're not satisfied with. If the work isn't done correctly, raise a dispute before approving. Never tap Approve unless you're satisfied; it cannot be undone.",
  },
  {
    question: 'How do I withdraw to my bank account?',
    answer: "SOL in your wallet can be exchanged for Naira through Nigerian crypto exchanges such as Bybit P2P. You send SOL and receive Naira in your bank account from the buyer.",
  },
  {
    question: 'What is SOL?',
    answer: "SOL is the digital currency of the Solana blockchain, the network Tenda runs on. Think of it like airtime units, but for a financial network. Tenda shows SOL amounts alongside their Naira equivalent so you always know what you're paying or earning.",
  },
  {
    question: 'Can I both post gigs and work on gigs?',
    answer: 'Yes, there are no restrictions. You can post a gig as a client and also apply to work on other gigs as a worker. Use both sides of the marketplace.',
  },
  {
    question: 'Is Tenda available outside Nigeria?',
    answer: 'Tenda is currently focused on the Nigerian market. Anyone with a Solana wallet can use the app, but city-based features and pricing are optimised for Nigeria.',
  },
] as const

export default function FaqScreen() {
  const { theme } = useUnistyles()

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <Header title="FAQ & Support" showBack />
      <Spacer size={spacing.md} />

      <Card variant="outlined" padding={0}>
        {FAQS.map((faq, index) => (
          <AccordionItem
            key={faq.question}
            title={faq.question}
            last={index === FAQS.length - 1}
          >
            <Spacer size={spacing.xs} />
            <Text variant="caption" color={theme.colors.textSub}>{faq.answer}</Text>
          </AccordionItem>
        ))}
      </Card>

      <Spacer size={spacing.md} />

      <Text variant="label" weight="semibold" color={theme.colors.textSub} style={s.sectionLabel}>
        CONTACT US
      </Text>
      <Spacer size={spacing.sm} />

      <View style={s.contacts}>
        <ContactRow
          icon={<MessageCircle size={18} color={theme.colors.primary} />}
          label="WhatsApp"
          value="Chat with us"
          url={APP_INFO.support.whatsapp}
        />
        <ContactRow
          icon={<Mail size={18} color={theme.colors.primary} />}
          label="Email"
          value={APP_INFO.support.email}
          url={`mailto:${APP_INFO.support.email}`}
        />
        <ContactRow
          icon={<Globe size={18} color={theme.colors.primary} />}
          label="Website"
          value={APP_INFO.external.website}
          url={APP_INFO.external.website}
        />
        <ContactRow
          icon={<XIcon size={18} color={theme.colors.primary} />}
          label="Twitter / X"
          value="@tendaapp"
          url={APP_INFO.social.twitter}
        />
        <ContactRow
          icon={<ExternalLink size={18} color={theme.colors.primary} />}
          label="Instagram"
          value="@tendaapp"
          url={APP_INFO.social.instagram}
        />
      </View>

      <Spacer size={spacing.md} />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    paddingHorizontal: 4,
    letterSpacing: 0.8,
  },
  contacts: {
    gap: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    gap: 2,
  },
})
