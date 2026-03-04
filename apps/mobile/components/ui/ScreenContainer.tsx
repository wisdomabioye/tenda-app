import { type ReactNode, useRef } from 'react'
import { ScrollView, View, StyleSheet } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'

interface ScreenContainerProps {
  scroll?: boolean
  padding?: boolean
  edges?: Edge[]
  children: ReactNode
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.md },
})

export function ScreenContainer({
  scroll = true,
  padding = true,
  edges = ['top', 'left', 'right'],
  children,
}: ScreenContainerProps) {
  const { theme } = useUnistyles()
  const router = useRouter()
  const navigation = useNavigation()
  const startX = useRef(0)

  const swipeBack = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([20, Infinity])
    .failOffsetY([-12, 12])
    .onBegin((e) => { startX.current = e.x })
    .onEnd((e) => {
      if (e.translationX > 60 && startX.current < 48 && navigation.canGoBack()) {
        router.back()
      }
    })

  const content = padding ? <View style={s.padded}>{children}</View> : children

  return (
    <GestureDetector gesture={swipeBack}>
      <SafeAreaView style={[s.flex, { backgroundColor: theme.colors.background }]} edges={edges}>
        {scroll ? (
          <ScrollView
            style={s.flex}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {content}
          </ScrollView>
        ) : (
          <View style={s.flex}>{content}</View>
        )}
      </SafeAreaView>
    </GestureDetector>
  )
}
