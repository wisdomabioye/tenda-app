import { View, Pressable, StyleSheet, Image, ScrollView } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Plus, X, FileText, Film } from 'lucide-react-native'
import { radius, spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

export interface PickedFile {
  uri: string
  type: 'image' | 'video' | 'document'
  name: string
  mimeType: string
}

type AcceptType = 'image' | 'video' | 'document' | 'any'

interface FilePickerProps {
  files: PickedFile[]
  onChange: (files: PickedFile[]) => void
  accept?: AcceptType
  max?: number
}

async function pickImage(): Promise<PickedFile | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImagePicker = require('expo-image-picker')
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return null
    const asset = result.assets[0]
    return {
      uri: asset.uri,
      type: 'image',
      name: asset.fileName ?? `photo_${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    }
  } catch {
    return null
  }
}

async function pickVideo(): Promise<PickedFile | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImagePicker = require('expo-image-picker')
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.length) return null
    const asset = result.assets[0]
    return {
      uri: asset.uri,
      type: 'video',
      name: asset.fileName ?? `video_${Date.now()}.mp4`,
      mimeType: asset.mimeType ?? 'video/mp4',
    }
  } catch {
    return null
  }
}

async function pickDocument(): Promise<PickedFile | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DocumentPicker = require('expo-document-picker')
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
    if (result.canceled || !result.assets?.length) return null
    const asset = result.assets[0]
    return {
      uri: asset.uri,
      type: 'document',
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
    }
  } catch {
    return null
  }
}

export function FilePicker({ files, onChange, accept = 'any', max = 5 }: FilePickerProps) {
  const { theme } = useUnistyles()
  const canAdd = files.length < max

  function remove(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  async function addFile(picker: () => Promise<PickedFile | null>) {
    if (!canAdd) return
    const picked = await picker()
    if (picked) onChange([...files, picked])
  }

  const showImage = accept === 'image' || accept === 'any'
  const showVideo = accept === 'video' || accept === 'any'
  const showDocument = accept === 'document' || accept === 'any'

  return (
    <View style={s.container}>
      {/* Action buttons */}
      {canAdd && (
        <View style={s.actions}>
          {showImage && (
            <Pressable
              onPress={() => addFile(pickImage)}
              style={[s.actionBtn, { backgroundColor: theme.colors.muted }]}
            >
              <Plus size={16} color={theme.colors.primary} />
              <Text size={13} weight="medium" color={theme.colors.primary}>Photo</Text>
            </Pressable>
          )}
          {showVideo && (
            <Pressable
              onPress={() => addFile(pickVideo)}
              style={[s.actionBtn, { backgroundColor: theme.colors.muted }]}
            >
              <Film size={16} color={theme.colors.primary} />
              <Text size={13} weight="medium" color={theme.colors.primary}>Video</Text>
            </Pressable>
          )}
          {showDocument && (
            <Pressable
              onPress={() => addFile(pickDocument)}
              style={[s.actionBtn, { backgroundColor: theme.colors.muted }]}
            >
              <FileText size={16} color={theme.colors.primary} />
              <Text size={13} weight="medium" color={theme.colors.primary}>Document</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Preview */}
      {files.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.preview}>
          {files.map((file, index) => (
            <View key={`${file.uri}-${index}`} style={s.fileItem}>
              {file.type === 'image' ? (
                <Image source={{ uri: file.uri }} style={s.thumbnail} />
              ) : (
                <View style={[s.filePlaceholder, { backgroundColor: theme.colors.muted }]}>
                  {file.type === 'video'
                    ? <Film size={24} color={theme.colors.textSub} />
                    : <FileText size={24} color={theme.colors.textSub} />
                  }
                  <Text size={10} color={theme.colors.textSub} numberOfLines={2} style={s.fileName}>
                    {file.name}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => remove(index)}
                style={[s.removeBtn, { backgroundColor: theme.colors.danger }]}
              >
                <X size={10} color="#fff" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Text variant="caption" color={theme.colors.textFaint}>
        {files.length}/{max} files selected
      </Text>
    </View>
  )
}

const THUMB_SIZE = 80

const s = StyleSheet.create({
  container: { gap: spacing.sm },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  preview: {
    flexDirection: 'row',
  },
  fileItem: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.sm,
  },
  filePlaceholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  fileName: {
    textAlign: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
