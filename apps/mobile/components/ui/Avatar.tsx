import { View } from 'react-native'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from './Text'

type Size = 'sm' | 'md' | 'lg'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: Size
}

const sizeMap = { sm: 32, md: 40, lg: 56 } as const
const fontSizeMap = { sm: 12, md: 15, lg: 20 } as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const { theme } = useUnistyles()
  const dim = sizeMap[size]
  const r = dim / 2

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: dim, height: dim, borderRadius: r, backgroundColor: theme.colors.muted }}
      />
    )
  }

  return (
    <View style={{
      width: dim,
      height: dim,
      borderRadius: r,
      backgroundColor: theme.colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text size={fontSizeMap[size]} weight="semibold" color={theme.colors.primary}>
        {name ? getInitials(name) : '?'}
      </Text>
    </View>
  )
}
