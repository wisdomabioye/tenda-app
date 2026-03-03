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
  showCounter?: boolean
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
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  inputWithIcon: { paddingLeft: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  footerLeft: { flex: 1 },
})

export function Input({
  label,
  error,
  helper,
  icon,
  showCounter,
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

  const charCount = typeof props.value === 'string' ? props.value.length : 0
  const max = props.maxLength
  const nearLimit = max !== undefined && charCount >= max * 0.9
  const atLimit = max !== undefined && charCount >= max

  return (
    <View style={s.container}>
      {label && <Text variant="label" style={s.label}>{label}</Text>}
      <View style={[s.inputWrapper, { backgroundColor: theme.colors.input, borderColor }]}>
        {icon && <View style={s.icon}>{icon}</View>}
        <TextInput
          maxFontSizeMultiplier={1}
          placeholderTextColor={theme.colors.textFaint}
          style={[s.input, { color: theme.colors.text }, icon ? s.inputWithIcon : undefined, style]}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
          {...props}
        />
      </View>
      <View style={s.footer}>
        <View style={s.footerLeft}>
          {error && (
            <Text size={12} color={theme.colors.danger}>{error}</Text>
          )}
          {!error && helper && (
            <Text variant="caption">{helper}</Text>
          )}
        </View>
        {showCounter && max !== undefined && (
          <Text
            size={12}
            color={atLimit ? theme.colors.danger : nearLimit ? theme.colors.warning : theme.colors.textFaint}
          >
            {charCount}/{max}
          </Text>
        )}
      </View>
    </View>
  )
}
