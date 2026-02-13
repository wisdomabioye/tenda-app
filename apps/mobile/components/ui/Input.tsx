import { useState } from 'react'
import { TextInput, View, type TextInputProps, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, typography } from '@/theme/tokens'
import { Text } from './Text'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  helper?: string
  icon?: React.ReactNode
}

const s = StyleSheet.create({
  container: { gap: 6 },
  label: { marginBottom: 2 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  icon: { paddingLeft: 12 },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: typography.sizes.base,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  inputWithIcon: { paddingLeft: 8 },
  helperText: { marginTop: 2 },
})

export function Input({
  label,
  error,
  helper,
  icon,
  style,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const { theme } = useUnistyles()

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.focusRing
      : 'transparent'

  return (
    <View style={s.container}>
      {label && <Text variant="label" style={s.label}>{label}</Text>}
      <View style={[s.inputWrapper, { backgroundColor: theme.colors.input, borderColor }]}>
        {icon && <View style={s.icon}>{icon}</View>}
        <TextInput
          placeholderTextColor={theme.colors.textFaint}
          style={[s.input, { color: theme.colors.text }, icon ? s.inputWithIcon : undefined, style]}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
          {...props}
        />
      </View>
      {error && (
        <Text size={12} color={theme.colors.danger} style={s.helperText}>{error}</Text>
      )}
      {!error && helper && (
        <Text variant="caption" style={s.helperText}>{helper}</Text>
      )}
    </View>
  )
}
