import { useState, useEffect } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, ChevronDown, LocateFixed } from 'lucide-react-native'
import { radius, spacing, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { SearchSheet, type SearchSheetItem } from './SearchSheet'
import { useLocationDetect } from '@/hooks/useLocationDetect'
import { LOCATIONS, type CountryCode } from '@tenda/shared'

interface LocationPickerProps {
  country: string | null
  city: string | null
  onChange: (country: string, city: string | null) => void
  label?: string
}

// Build static item lists once (module level — no re-creation on render)
const COUNTRY_ITEMS: SearchSheetItem[] = Object.entries(LOCATIONS).map(([code, entry]) => ({
  key: code,
  label: entry.name,
  sublabel: entry.flag,
}))

function cityItems(countryCode: string): SearchSheetItem[] {
  const entry = LOCATIONS[countryCode as CountryCode]
  if (!entry) return []
  return entry.cities.map((c) => ({ key: c, label: c }))
}

export function LocationPicker({ country, city, onChange, label = 'Location' }: LocationPickerProps) {
  const { theme } = useUnistyles()
  const [countryOpen, setCountryOpen] = useState(false)
  const [cityOpen, setCityOpen]       = useState(false)

  // Tracks which country's cities to show during the two-step flow.
  // Stays in sync with the `country` prop once a selection is committed.
  const [pendingCountry, setPendingCountry] = useState<string | null>(country)
  useEffect(() => { setPendingCountry(country) }, [country])

  const { detect, detecting, error, clearError } = useLocationDetect({
    onDetected: (detectedCountry, detectedCity) => {
      setCityOpen(false)
      onChange(detectedCountry, detectedCity)
    },
  })

  function handleCountrySelect(code: string) {
    setPendingCountry(code)
    setCountryOpen(false)
    // Reset city when country changes, then immediately open city picker
    if (code !== country) onChange(code, null)
    setCityOpen(true)
  }

  function handleCitySelect(selectedCity: string) {
    setCityOpen(false)
    onChange(pendingCountry!, selectedCity)
  }

  function handleCityClose() {
    setCityOpen(false)
    clearError()
  }

  const countryEntry = country ? LOCATIONS[country as CountryCode] : null
  const triggerLabel = countryEntry
    ? city
      ? `${countryEntry.flag} ${countryEntry.name} · ${city}`
      : `${countryEntry.flag} ${countryEntry.name}`
    : 'Select location'

  const gpsButton = (
    <Pressable
      onPress={detect}
      disabled={detecting}
      style={[s.gpsBtn, { backgroundColor: theme.colors.primaryTint }]}
    >
      <LocateFixed size={14} color={theme.colors.primary} />
      <Text size={typography.sizes.xs} weight="semibold" color={theme.colors.primary}>
        {detecting ? 'Detecting…' : 'Use my location'}
      </Text>
    </Pressable>
  )

  return (
    <>
      <View style={s.container}>
        {label ? <Text variant="label" style={s.label}>{label}</Text> : null}
        <Pressable
          onPress={() => setCountryOpen(true)}
          style={[
            s.trigger,
            {
              backgroundColor: theme.colors.input,
              borderColor: countryOpen || cityOpen ? theme.colors.focusRing : 'transparent',
            },
          ]}
        >
          <MapPin size={16} color={country ? theme.colors.primary : theme.colors.textFaint} />
          <Text
            style={s.triggerText}
            color={country ? theme.colors.text : theme.colors.textFaint}
          >
            {triggerLabel}
          </Text>
          <ChevronDown size={16} color={theme.colors.textFaint} />
        </Pressable>
        {error ? (
          <Text size={12} color={theme.colors.warning}>{error}</Text>
        ) : null}
      </View>

      {/* Step 1 — pick country */}
      <SearchSheet
        visible={countryOpen}
        onClose={() => setCountryOpen(false)}
        title="Select Country"
        items={COUNTRY_ITEMS}
        value={country}
        onSelect={handleCountrySelect}
        searchPlaceholder="Search country…"
      />

      {/* Step 2 — pick city within selected country */}
      <SearchSheet
        visible={cityOpen}
        onClose={handleCityClose}
        title={`Select City${pendingCountry ? ` in ${LOCATIONS[pendingCountry as CountryCode]?.name ?? ''}` : ''}`}
        items={pendingCountry ? cityItems(pendingCountry) : []}
        value={city}
        onSelect={handleCitySelect}
        searchPlaceholder="Search city…"
        headerRight={gpsButton}
      />
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  triggerText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: typography.sizes.base,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
})
