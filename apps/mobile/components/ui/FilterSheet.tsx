import { useEffect, useRef } from 'react'
import {
  View,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { X, Search as SearchIcon } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { Text } from './Text'
import { Input } from './Input'
import { Chip } from './Chip'
import { IconButton } from './IconButton'
import { LocationPicker } from '@/components/form/LocationPicker'
import { CATEGORY_META } from '@/data/mock'
import type { ColorScheme } from '@/theme/tokens'

const SHEET_HEIGHT = 580

interface FilterSheetProps {
  visible: boolean
  onClose: () => void
  query: string
  onQueryChange: (q: string) => void
  selectedCategory: string | null
  onCategoryChange: (cat: string | null) => void
  country: string | null
  city: string | null
  onLocationChange: (country: string, city: string | null) => void
  remote: boolean | null        // null = show all, true = remote only, false = local only
  onRemoteChange: (remote: boolean | null) => void
  crossBorder: boolean | null   // null = show all, true = cross-border only
  onCrossBorderChange: (v: boolean | null) => void
  onClearAll: () => void
}

export function FilterSheet({
  visible,
  onClose,
  query,
  onQueryChange,
  selectedCategory,
  onCategoryChange,
  country,
  city,
  onLocationChange,
  remote,
  onRemoteChange,
  crossBorder,
  onCrossBorderChange,
  onClearAll,
}: FilterSheetProps) {
  const { theme } = useUnistyles()
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start()
    } else {
      translateY.setValue(SHEET_HEIGHT)
    }
  }, [visible, translateY])

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose())
  }

  const handleCategoryPress = (key: string) => {
    onCategoryChange(selectedCategory === key ? null : key)
  }

  const hasFilters = query.trim().length > 0 || selectedCategory !== null || country !== null || city !== null || remote !== null || crossBorder !== null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={handleClose} />

        {/* Sheet */}
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: theme.colors.background,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Handle */}
          <View style={s.handleRow}>
            <View style={[s.handle, { backgroundColor: theme.colors.borderFaint }]} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text variant="subheading">Filter gigs</Text>
            <IconButton
              icon={<X size={20} color={theme.colors.text} />}
              onPress={handleClose}
              variant="ghost"
            />
          </View>

          {/* Search input */}
          <View style={s.section}>
            <Input
              placeholder="Search by title, city..."
              value={query}
              onChangeText={onQueryChange}
              icon={<SearchIcon size={18} color={theme.colors.textFaint} />}
              autoFocus={false}
            />
          </View>

          {/* Category chips */}
          <View style={s.section}>
            <Text variant="caption" color={theme.colors.textSub} style={s.chipLabel}>
              Category
            </Text>
            <View style={s.chips}>
              {CATEGORY_META.map((cat) => {
                const colorKey = `category${cat.label}` as keyof ColorScheme
                return (
                  <Chip
                    key={cat.key}
                    label={cat.label}
                    selected={selectedCategory === cat.key}
                    color={theme.colors[colorKey]}
                    onPress={() => handleCategoryPress(cat.key)}
                  />
                )
              })}
            </View>
          </View>

          {/* Remote / Local / Cross-border filter */}
          <View style={s.section}>
            <Text variant="caption" color={theme.colors.textSub} style={s.chipLabel}>
              Gig type
            </Text>
            <View style={s.chips}>
              {([null, false, true] as const).map((val) => (
                <Chip
                  key={String(val)}
                  label={val === null ? 'All' : val ? 'Remote' : 'Local'}
                  selected={remote === val && crossBorder === null}
                  onPress={() => { onRemoteChange(val); onCrossBorderChange(null) }}
                />
              ))}
              <Chip
                label="Cross-border"
                selected={crossBorder === true}
                onPress={() => { onCrossBorderChange(crossBorder === true ? null : true); onRemoteChange(null) }}
              />
            </View>
          </View>

          {/* Location picker */}
          <View style={s.section}>
            <LocationPicker
              country={country}
              city={city}
              onChange={onLocationChange}
              label="Location"
            />
          </View>

          {/* Clear filters */}
          {hasFilters && (
            <Pressable style={s.clearRow} onPress={onClearAll}>
              <Text variant="caption" color={theme.colors.textFaint}>
                Clear all filters
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing['2xl'],
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  chipLabel: {
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  clearRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
})
