import { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'

/**
 * True while the software keyboard is open. Under SDK 54 edge-to-edge the
 * on-screen keyboard covers the bottom navigation-bar region, so a bottom-
 * anchored bar (e.g. ChatInput) should drop its `insets.bottom` padding while
 * this is true — otherwise a gap the size of the nav bar opens between the bar
 * and the keyboard.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return visible
}
