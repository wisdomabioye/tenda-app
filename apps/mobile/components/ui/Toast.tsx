import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import type { ColorScheme } from '@/theme/tokens'
import { radius, shadows } from '@/theme/tokens'
import { Text } from './Text'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastMessage {
  id: number
  variant: ToastVariant
  message: string
  duration?: number
}

const variantTokens: Record<ToastVariant, keyof ColorScheme> = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
}

let toastListener: ((msg: ToastMessage) => void) | null = null
let nextId = 0

export function showToast(variant: ToastVariant, message: string, duration = 3000) {
  toastListener?.({ id: nextId++, variant, message, duration })
}

export function useToast() {
  return { showToast }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  useEffect(() => {
    toastListener = (msg) => {
      setToasts((prev) => [...prev, msg])
      const timer = setTimeout(() => removeToast(msg.id), msg.duration ?? 3000)
      timers.current.set(msg.id, timer)
    }
    return () => {
      toastListener = null
      timers.current.forEach(clearTimeout)
    }
  }, [removeToast])

  return (
    <View style={{ flex: 1 }}>
      {children}
      <View
        style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, gap: 8, zIndex: 9999 }}
        pointerEvents="box-none"
      >
        {toasts.map((toast) => (
          <Animated.View
            key={toast.id}
            entering={FadeInUp.duration(200)}
            exiting={FadeOutUp.duration(200)}
          >
            <Pressable
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: radius.md,
                padding: 14,
                borderLeftWidth: 4,
                borderLeftColor: theme.colors[variantTokens[toast.variant]],
                ...shadows.lg,
              }}
              onPress={() => removeToast(toast.id)}
            >
              <Text weight="medium" size={14}>{toast.message}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  )
}
