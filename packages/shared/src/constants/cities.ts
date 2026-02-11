export const SUPPORTED_CITIES = [
  'Lagos',
  'Abuja',
  'Port Harcourt',
  'Ibadan',
  'Kano',
] as const

export type SupportedCity = (typeof SUPPORTED_CITIES)[number]
