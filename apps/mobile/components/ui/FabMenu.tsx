import { useEffect, useRef } from 'react'
import {
  Animated, Modal, Pressable, StyleSheet, View,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius, shadows } from '@/theme/tokens'
import { Text } from './Text'

export interface FabAction {
  icon:    React.ReactNode
  label:   string
  onPress: () => void
}

interface FabMenuProps {
  visible:     boolean
  onClose:     () => void
  actions:     FabAction[]
  bottomInset: number   // tab bar height — cards float just above it
}

const STAGGER_MS = 60

export function FabMenu({ visible, onClose, actions, bottomInset }: FabMenuProps) {
  const { theme } = useUnistyles()

  const backdrop = useRef(new Animated.Value(0)).current
  const cards    = useRef(actions.map(() => ({
    scale:      new Animated.Value(0),
    translateY: new Animated.Value(12),
  }))).current

  useEffect(() => {
    if (visible) {
      Animated.timing(backdrop, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start()

      // Stagger cards in — bottom card first
      const animations = [...cards].reverse().map((c, i) =>
        Animated.sequence([
          Animated.delay(i * STAGGER_MS),
          Animated.parallel([
            Animated.spring(c.scale,      { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
            Animated.spring(c.translateY, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 200 }),
          ]),
        ]),
      )
      Animated.parallel(animations).start()
    } else {
      Animated.timing(backdrop, {
        toValue: 0, duration: 150, useNativeDriver: true,
      }).start()
      cards.forEach((c) => {
        c.scale.setValue(0)
        c.translateY.setValue(12)
      })
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdrop }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Action cards */}
      <View
        style={[s.container, { bottom: bottomInset + spacing.sm }]}
        pointerEvents="box-none"
      >
        {actions.map((action, i) => (
          <Animated.View
            key={action.label}
            style={{
              transform: [
                { scale:      cards[i]!.scale },
                { translateY: cards[i]!.translateY },
              ],
              opacity: cards[i]!.scale,
            }}
          >
            <Pressable
              style={[s.card, { backgroundColor: theme.colors.surface, ...shadows.md }]}
              onPress={() => { onClose(); action.onPress() }}
            >
              <View style={[s.iconWrap, { backgroundColor: theme.colors.primaryTint }]}>
                {action.icon}
              </View>
              <Text weight="semibold" size={15} color={theme.colors.text}>
                {action.label}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: {
    position:   'absolute',
    left:       0,
    right:      0,
    alignItems: 'center',
    gap:        spacing.sm,
  },
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.sm,
    paddingVertical:   8,
    paddingHorizontal: 12,
    borderRadius:   radius.xl,
    minWidth:       200,
  },
  iconWrap: {
    width:          30,
    height:         30,
    borderRadius:   radius.full,
    alignItems:     'center',
    justifyContent: 'center',
  },
})
