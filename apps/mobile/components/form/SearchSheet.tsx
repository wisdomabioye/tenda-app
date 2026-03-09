import { useState } from 'react'
import {
  View,
  Modal,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  type ListRenderItemInfo,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Search, Check } from 'lucide-react-native'
import { radius, spacing, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

export interface SearchSheetItem {
  key: string
  label: string
  sublabel?: string   // displayed dimly to the right of label (e.g. flag, city count)
}

interface SearchSheetProps {
  visible: boolean
  onClose: () => void
  title: string
  items: SearchSheetItem[]
  value: string | null
  onSelect: (key: string) => void
  searchPlaceholder?: string
  /** Extra element rendered to the right of the title (e.g. GPS button). */
  headerRight?: React.ReactNode
}

export function SearchSheet({
  visible,
  onClose,
  title,
  items,
  value,
  onSelect,
  searchPlaceholder = 'Search…',
  headerRight,
}: SearchSheetProps) {
  const { theme } = useUnistyles()
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : items

  function handleSelect(key: string) {
    onSelect(key)
    setQuery('')
    onClose()
  }

  function handleClose() {
    setQuery('')
    onClose()
  }

  function renderItem({ item }: ListRenderItemInfo<SearchSheetItem>) {
    const selected = item.key === value
    return (
      <Pressable
        onPress={() => handleSelect(item.key)}
        style={({ pressed }) => [
          s.option,
          {
            backgroundColor: pressed
              ? theme.colors.surfacePressed
              : selected
                ? theme.colors.primaryTint
                : 'transparent',
          },
        ]}
      >
        <View style={s.optionLeft}>
          <Text
            variant="body"
            weight={selected ? 'semibold' : 'regular'}
            color={selected ? theme.colors.primary : theme.colors.text}
          >
            {item.label}
          </Text>
          {item.sublabel ? (
            <Text size={13} color={theme.colors.textFaint} style={s.sublabel}>
              {item.sublabel}
            </Text>
          ) : null}
        </View>
        {selected && <Check size={16} color={theme.colors.primary} />}
      </Pressable>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[s.sheet, { backgroundColor: theme.colors.surface }]}>
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: theme.colors.borderFaint }]} />

          {/* Title row */}
          <View style={s.titleRow}>
            <Text variant="subheading">{title}</Text>
            {headerRight}
          </View>

          {/* Search */}
          <View style={[s.searchRow, { backgroundColor: theme.colors.input }]}>
            <Search size={16} color={theme.colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.colors.textFaint}
              style={[s.searchInput, { color: theme.colors.text }]}
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            style={s.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={s.empty}>
                <Text variant="body" color={theme.colors.textFaint}>
                  No results for "{query}"
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: typography.sizes.base,
    paddingVertical: 0,
  },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  optionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sublabel: { marginLeft: 2 },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
})
