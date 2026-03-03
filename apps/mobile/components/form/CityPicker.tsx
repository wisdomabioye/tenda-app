import { useState } from 'react'
import {
  View,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native'
import * as Location from 'expo-location'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, Search, ChevronDown, Check, LocateFixed } from 'lucide-react-native'
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
  const [detecting, setDetecting] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const filtered = query.trim()
    ? SUPPORTED_CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : SUPPORTED_CITIES

  function select(city: string) {
    onChange(city)
    setOpen(false)
    setQuery('')
    setGpsError(null)
  }

  async function detectLocation() {
    setDetecting(true)
    setGpsError(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setGpsError('Location permission denied — please select manually.')
        return
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const [result] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })

      // Reverse geocode returns neighborhood-level data in `city` for Nigerian addresses.
      // Walk through fields from broadest to narrowest: a supported city name is more
      // likely to appear in `subregion` or `region` than in `city`/`district`.
      const candidates = [
        result?.subregion,
        result?.region,
        result?.city,
        result?.district,
      ].filter(Boolean) as string[]

      function fuzzyMatch(candidate: string) {
        return SUPPORTED_CITIES.find(
          (c) =>
            c.toLowerCase() === candidate.toLowerCase() ||
            candidate.toLowerCase().includes(c.toLowerCase()) ||
            c.toLowerCase().includes(candidate.toLowerCase()),
        )
      }

      const match = candidates.reduce<string | undefined>(
        (found, candidate) => found ?? fuzzyMatch(candidate),
        undefined,
      )

      if (match) {
        select(match)
      } else {
        const detected = candidates[0] ?? 'your location'
        setGpsError(`"${detected}" is not in our supported cities yet — please select manually.`)
      }
    } catch {
      setGpsError('Could not detect location — please select manually.')
    } finally {
      setDetecting(false)
    }
  }

  return (
    <>
      <View style={s.container}>
        {label ? <Text variant="label" style={s.label}>{label}</Text> : null}
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

            <View style={s.titleRow}>
              <Text variant="subheading">Select City</Text>
              <Pressable
                onPress={detectLocation}
                disabled={detecting}
                style={[s.gpsBtn, { backgroundColor: theme.colors.primaryTint }]}
              >
                <LocateFixed size={14} color={theme.colors.primary} />
                <Text size={13} weight="semibold" color={theme.colors.primary}>
                  {detecting ? 'Detecting…' : 'Use my location'}
                </Text>
              </Pressable>
            </View>

            {gpsError && (
              <Text size={12} color={theme.colors.warning} style={s.gpsError}>{gpsError}</Text>
            )}

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  gpsError: {
    marginBottom: spacing.sm,
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
