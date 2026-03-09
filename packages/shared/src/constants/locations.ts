export const LOCATIONS = {
  NG: {
    name: 'Nigeria',
    flag: '🇳🇬',
    currency: 'NGN',
    cities: [
      'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Benin City',
      'Kaduna', 'Enugu', 'Aba', 'Onitsha', 'Warri', 'Ilorin', 'Abeokuta',
      'Owerri', 'Uyo', 'Calabar', 'Asaba', 'Akure', 'Osogbo', 'Jos',
      'Maiduguri', 'Sokoto', 'Zaria', 'Makurdi', 'Awka',
    ],
  },
  GH: {
    name: 'Ghana',
    flag: '🇬🇭',
    currency: 'GHS',
    cities: ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast'],
  },
  KE: {
    name: 'Kenya',
    flag: '🇰🇪',
    currency: 'KES',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
  },
  ZA: {
    name: 'South Africa',
    flag: '🇿🇦',
    currency: 'ZAR',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth'],
  },
  PH: {
    name: 'Philippines',
    flag: '🇵🇭',
    currency: 'PHP',
    cities: ['Manila', 'Cebu City', 'Davao', 'Quezon City', 'Makati'],
  },
} as const

export type CountryCode = keyof typeof LOCATIONS
export type LocationEntry = (typeof LOCATIONS)[CountryCode]

/** All city strings across every supported country. */
export const ALL_CITIES: string[] = Object.values(LOCATIONS).flatMap((l) => [...l.cities])

/** Look up which country a city belongs to. Returns undefined if not found. */
export function findCountryForCity(city: string): CountryCode | undefined {
  for (const [code, entry] of Object.entries(LOCATIONS)) {
    if ((entry.cities as readonly string[]).includes(city)) {
      return code as CountryCode
    }
  }
  return undefined
}
