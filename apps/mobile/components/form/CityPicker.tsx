import { useState } from 'react'
import {
  View,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, Search, ChevronDown, Check } from 'lucide-react-native'
import { radius, spacing, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { SUPPORTED_CITIES } from '@tenda/shared'

interface CityPickerProps {
  value: string | null
  onChange: (city: string) => void
  label?: string
}

export function CityPicker({ value, onChange, label = 'City' }: CityPickerProps) {
  const { theme } = useUnistyles()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? SUPPORTED_CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : SUPPORTED_CITIES

  function select(city: string) {
    onChange(city)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <View style={s.container}>
        <Text variant="label" style={s.label}>{label}</Text>
        <Pressable
          onPress={() => setOpen(true)}
          style={[
            s.trigger,
            {
              backgroundColor: theme.colors.input,
              borderColor: open ? theme.colors.focusRing : 'transparent',
            },
          ]}
        >
          <MapPin size={16} color={value ? theme.colors.primary : theme.colors.textFaint} />
          <Text
            style={s.triggerText}
            color={value ? theme.colors.text : theme.colors.textFaint}
          >
            {value ?? 'Select city'}
          </Text>
          <ChevronDown size={16} color={theme.colors.textFaint} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: theme.colors.surface }]}>
            <View style={[s.handle, { backgroundColor: theme.colors.borderFaint }]} />
            <Text variant="subheading" style={s.sheetTitle}>Select City</Text>

            {/* Search */}
            <View style={[s.searchRow, { backgroundColor: theme.colors.input }]}>
              <Search size={16} color={theme.colors.textFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search city..."
                placeholderTextColor={theme.colors.textFaint}
                style={[s.searchInput, { color: theme.colors.text }]}
                autoFocus
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              style={s.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item === value
                return (
                  <Pressable
                    onPress={() => select(item)}
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
                    <Text
                      variant="body"
                      weight={selected ? 'semibold' : 'regular'}
                      color={selected ? theme.colors.primary : theme.colors.text}
                    >
                      {item}
                    </Text>
                    {selected && <Check size={16} color={theme.colors.primary} />}
                  </Pressable>
                )
              }}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text variant="body" color={theme.colors.textFaint}>No cities match "{query}"</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  container: { gap: 6 },
  label: { marginBottom: 2 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  triggerText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: typography.sizes.base,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: typography.sizes.base,
    paddingVertical: 0,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
})
