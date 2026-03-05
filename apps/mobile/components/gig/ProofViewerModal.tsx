import { useState } from 'react'
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import { X, Download, FileText } from 'lucide-react-native'
import { File, Paths } from 'expo-file-system/next'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { Text } from '@/components/ui/Text'
import { spacing, radius } from '@/theme/tokens'

export type ProofItem = {
  id: string
  url: string
  type: 'image' | 'video' | 'document'
}

// Separate component so useVideoPlayer hook is always called unconditionally
function InAppVideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p: VideoPlayer) => {
    p.loop = false
    p.play()
  })
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls
    />
  )
}

interface Props {
  proof: ProofItem | null
  onClose: () => void
}

export function ProofViewerModal({ proof, onClose }: Props) {
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const [downloading, setDownloading] = useState(false)

  if (!proof) return null

  async function handleDownload() {
    if (!proof) return
    setDownloading(true)
    try {
      const ext =
        proof.url.split('?')[0].split('.').pop() ??
        (proof.type === 'image' ? 'jpg' : proof.type === 'video' ? 'mp4' : 'pdf')
      const filename = `tenda_proof_${proof.id}.${ext}`
      const file = new File(Paths.cache, filename)

      const response = await fetch(proof.url)
      if (!response.ok) throw new Error(`Server returned ${response.status}`)
      const buffer = await response.arrayBuffer()
      file.write(new Uint8Array(buffer))

      if (proof.type === 'image' || proof.type === 'video') {
        const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync()
        if (status !== 'granted') {
          if (!canAskAgain) {
            Alert.alert(
              'Permission required',
              'Gallery access was denied. Enable it in your device settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            )
          }
          return
        }
        await MediaLibrary.saveToLibraryAsync(file.uri)
        Alert.alert('Saved', `${proof.type === 'image' ? 'Image' : 'Video'} saved to your gallery.`)
      } else {
        await Sharing.shareAsync(file.uri)
      }
    } catch (e) {
      Alert.alert('Download failed', (e as Error).message ?? 'Could not download the file.')
    } finally {
      setDownloading(false)
    }
  }

  const typeLabel =
    proof.type === 'image' ? 'IMAGE' : proof.type === 'video' ? 'VIDEO' : 'DOCUMENT'

  // Black background is intentional — matches system gallery/camera UX.
  // Overlays are relative to that fixed black bg, not theme-dependent.
  const OVERLAY_DIM = 'rgba(255,255,255,0.12)'
  const OVERLAY_TEXT = 'rgba(255,255,255,0.5)'

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.container}>

        {/* ── Top bar ── */}
        <View style={[s.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={[s.typeBadge, { backgroundColor: OVERLAY_DIM }]}>
            <Text variant="caption" color="#fff" weight="semibold" style={s.typeLabel}>
              {typeLabel}
            </Text>
          </View>
          <View style={s.topBarActions}>
            {downloading ? (
              <ActivityIndicator color="#fff" style={s.iconBtn} />
            ) : (
              <Pressable onPress={handleDownload} style={s.iconBtn} hitSlop={12}>
                <Download size={22} color="#fff" />
              </Pressable>
            )}
            <Pressable onPress={onClose} style={s.iconBtn} hitSlop={12}>
              <X size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ── Content ── */}
        {proof.type === 'image' && (
          <ScrollView
            style={s.flex}
            contentContainerStyle={s.imageContainer}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: proof.url }}
              style={s.fullImage}
              contentFit="contain"
              transition={200}
            />
          </ScrollView>
        )}

        {proof.type === 'video' && (
          <View style={s.flex}>
            <InAppVideoPlayer url={proof.url} />
          </View>
        )}

        {proof.type === 'document' && (
          <View style={s.mediaCenter}>
            <View style={[s.iconCircle, { backgroundColor: OVERLAY_DIM }]}>
              <FileText size={52} color="#fff" />
            </View>
            <Text variant="subheading" color="#fff" style={s.centred}>
              Document proof
            </Text>
            <Text variant="caption" color={OVERLAY_TEXT} style={s.centred}>
              Opens in your browser
            </Text>
            <Pressable
              style={[s.openBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => Linking.openURL(proof.url)}
            >
              <Text variant="body" weight="semibold" color={theme.colors.onPrimary}>
                Open document
              </Text>
            </Pressable>
          </View>
        )}

      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  typeLabel: {
    letterSpacing: 0.8,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    padding: 8,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    flex: 1,
  },
  mediaCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  centred: {
    textAlign: 'center',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
})
