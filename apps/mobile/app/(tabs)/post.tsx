import { useState } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Spacer } from '@/components/ui/Spacer'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui'
import { showToast } from '@/components/ui/Toast'
import { PaymentInput } from '@/components/form/PaymentInput'
import { DurationPicker } from '@/components/form/DurationPicker'
import { CATEGORY_META } from '@/data/mock'
import { SUPPORTED_CITIES, isValidPaymentLamports, MIN_COMPLETION_DURATION_SECONDS } from '@tenda/shared'
import { api } from '@/api/client'
import type { ColorScheme } from '@/theme/tokens'
import type { GigCategory } from '@tenda/shared'

export default function PostGigScreen() {
  const { theme } = useUnistyles()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [paymentLamports, setPaymentLamports] = useState(0)
  const [completionDuration, setCompletionDuration] = useState(86_400) // 1 day default
  const [address, setAddress] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<GigCategory | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    isValidPaymentLamports(paymentLamports) &&
    selectedCategory !== null &&
    selectedCity !== null &&
    completionDuration >= MIN_COMPLETION_DURATION_SECONDS

  async function handlePost() {
    if (!isValid || !selectedCategory || !selectedCity) return

    setIsLoading(true)
    try {
      const gig = await api.gigs.create({
        title: title.trim(),
        description: description.trim(),
        payment_lamports: paymentLamports,
        category: selectedCategory,
        city: selectedCity,
        address: address.trim() || undefined,
        completion_duration_seconds: completionDuration,
      })
      showToast('success', 'Draft saved! Publish it from the gig page.')
      router.push(`/gig/${gig.id}` as any)
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to create gig')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Header title="Post a gig" showBack />
          <Spacer size={spacing.sm} />
          <Text variant="body" color={theme.colors.textSub}>
            Describe the task you need done
          </Text>

          <Spacer size={spacing.lg} />

          {/* Details */}
          <Card variant="outlined" padding={spacing.md}>
            <Text variant="label" weight="semibold">Gig details</Text>
            <Spacer size={spacing.sm} />

            <Input
              label="Title"
              placeholder="e.g. Deliver package to Victoria Island"
              helper="Make it short and clear"
              value={title}
              onChangeText={setTitle}
            />

            <Spacer size={spacing.md} />

            <Input
              label="Description"
              placeholder="Describe the gig in detail..."
              helper="Include scope, timeline, and expectations"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={s.multiline}
            />

            <Spacer size={spacing.md} />

            <PaymentInput value={paymentLamports} onChange={setPaymentLamports} />

            <Spacer size={spacing.md} />

            <DurationPicker value={completionDuration} onChange={setCompletionDuration} />

            <Spacer size={spacing.md} />

            <Input
              label="Address (optional)"
              placeholder="e.g. 12 Broad Street, Lagos Island"
              helper="Physical location if the gig requires in-person work"
              value={address}
              onChangeText={setAddress}
            />
          </Card>

          <Spacer size={spacing.lg} />

          {/* Category & City */}
          <Card variant="outlined" padding={spacing.md}>
            <Text variant="label" weight="semibold">Category</Text>
            <Spacer size={spacing.sm} />
            <View style={s.chipGroup}>
              {CATEGORY_META.map((cat) => {
                const colorKey = `category${cat.label}` as keyof ColorScheme
                return (
                  <Chip
                    key={cat.key}
                    label={cat.label}
                    selected={selectedCategory === cat.key}
                    color={theme.colors[colorKey]}
                    onPress={() => setSelectedCategory(cat.key)}
                  />
                )
              })}
            </View>

            <Spacer size={spacing.lg} />

            <Text variant="label" weight="semibold">City</Text>
            <Spacer size={spacing.sm} />
            <View style={s.chipGroup}>
              {SUPPORTED_CITIES.map((city) => (
                <Chip
                  key={city}
                  label={city}
                  selected={selectedCity === city}
                  onPress={() => setSelectedCity(city)}
                />
              ))}
            </View>
          </Card>

          <Spacer size={spacing['2xl']} />

          {/* Submit */}
          <Button
            variant="primary"
            size="xl"
            fullWidth
            disabled={!isValid}
            loading={isLoading}
            onPress={handlePost}
          >
            Save Draft
          </Button>

          <Spacer size={spacing.xl} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
})
