import { useState } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Spacer } from '@/components/ui/Spacer'
import { CATEGORY_META } from '@/data/mock'
import { SUPPORTED_CITIES } from '@tenda/shared'
import type { ColorScheme } from '@/theme/tokens'

export default function PostGigScreen() {
  const { theme } = useUnistyles()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [payment, setPayment] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    payment.trim().length > 0 &&
    selectedCategory !== null &&
    selectedCity !== null

  const handlePost = () => {
    // TODO: wire up to API
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
          <Text variant="heading">Post a gig</Text>
          <Text variant="body" color={theme.colors.textSub}>
            Describe the task you need done
          </Text>

          <Spacer size={spacing.lg} />

          {/* Title */}
          <Input
            label="Title"
            placeholder="e.g. Deliver package to Victoria Island"
            value={title}
            onChangeText={setTitle}
          />

          <Spacer size={spacing.md} />

          {/* Description */}
          <Input
            label="Description"
            placeholder="Describe the gig in detail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={s.multiline}
          />

          <Spacer size={spacing.md} />

          {/* Payment */}
          <Input
            label="Payment (Naira)"
            placeholder="e.g. 5000"
            value={payment}
            onChangeText={setPayment}
            keyboardType="numeric"
          />

          <Spacer size={spacing.lg} />

          {/* Category */}
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

          {/* City */}
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

          <Spacer size={spacing['2xl']} />

          {/* Submit */}
          <Button
            variant="primary"
            size="xl"
            fullWidth
            disabled={!isValid}
            onPress={handlePost}
          >
            Post Gig
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
