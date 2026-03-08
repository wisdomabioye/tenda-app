import { useState } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useRouter } from 'expo-router'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Card, Header, Avatar } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CityPicker } from '@/components/form/CityPicker'
import { showToast } from '@/components/ui/Toast'
import { FilePicker } from '@/components/form/FilePicker'
import type { PickedFile } from '@/components/form/FilePicker'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'
import { uploadToCloudinary } from '@/lib/upload'

export default function UpdateProfileScreen() {
  const { theme } = useUnistyles()
  const router = useRouter()
  const { user, updateUser } = useAuthStore()

  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [selectedCity, setSelectedCity] = useState<string | null>(user?.city ?? null)
  const [avatarFile, setAvatarFile] = useState<PickedFile[]>([])
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url ?? null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSave() {
    if (!user) return
    setIsLoading(true)
    try {
      let avatarUrl = user.avatar_url

      // Upload new avatar if picked
      if (avatarFile.length > 0) {
        const file = avatarFile[0]
        avatarUrl = await uploadToCloudinary(file, 'avatar')
        setAvatarPreview(avatarUrl)
      }

      const updated = await api.users.update(
        { id: user.id },
        {
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          bio: bio.trim() || undefined,
          city: selectedCity ?? undefined,
          avatar_url: avatarUrl ?? undefined,
        },
      )
      updateUser(updated)
      showToast('success', 'Profile updated!')
      router.back()
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') || user?.wallet_address?.slice(0, 8) || 'You'

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <Header title="Update Profile" showBack />
          <Spacer size={spacing.md} />

          {/* Avatar */}
          <View style={s.avatarSection}>
            <Avatar size="lg" name={fullName} src={avatarPreview} />
            <Spacer size={spacing.sm} />
            <FilePicker
              files={avatarFile}
              onChange={(files) => {
                setAvatarFile(files)
                setAvatarPreview(files[0]?.uri ?? user?.avatar_url ?? null)
              }}
              accept="image"
              max={1}
              showPreview={false}
            />
          </View>

          <Spacer size={spacing.md} />

          {/* Personal info */}
          <Card variant="outlined" padding={spacing.md}>
            <Text variant="label" weight="semibold">Personal info</Text>
            <Spacer size={spacing.sm} />

            <Input
              label="First name"
              placeholder="e.g. Akin"
              value={firstName}
              onChangeText={setFirstName}
            />
            <Spacer size={spacing.md} />

            <Input
              label="Last name"
              placeholder="e.g. Beela"
              value={lastName}
              onChangeText={setLastName}
            />
            <Spacer size={spacing.md} />

            <Input
              label="Bio"
              placeholder="Tell people about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              style={s.multiline}
            />
          </Card>

          <Spacer size={spacing.md} />

          {/* City */}
          <Card variant="outlined" padding={spacing.md}>
            <Text variant="label" weight="semibold">City</Text>
            <Spacer size={spacing.sm} />
            <CityPicker value={selectedCity} onChange={setSelectedCity} label="" />
          </Card>

          <Spacer size={spacing.lg} />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            onPress={handleSave}
          >
            Save Changes
          </Button>

          <Spacer size={spacing.md} />
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
  avatarSection: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
})
