export const SUPPORTED_CURRENCIES = ['NGN', 'GHS', 'KES', 'ZAR', 'PHP', 'USD', 'GBP', 'EUR'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const CURRENCY_META: Record<
  SupportedCurrency,
  { symbol: string; name: string; locale: string; coingeckoKey: string }
> = {
  NGN: { symbol: '₦',   name: 'Nigerian Naira',    locale: 'en-NG', coingeckoKey: 'ngn' },
  GHS: { symbol: '₵',   name: 'Ghanaian Cedi',      locale: 'en-GH', coingeckoKey: 'ghs' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling',    locale: 'en-KE', coingeckoKey: 'kes' },
  ZAR: { symbol: 'R',   name: 'South African Rand', locale: 'en-ZA', coingeckoKey: 'zar' },
  PHP: { symbol: '₱',   name: 'Philippine Peso',    locale: 'en-PH', coingeckoKey: 'php' },
  USD: { symbol: '$',   name: 'US Dollar',          locale: 'en-US', coingeckoKey: 'usd' },
  GBP: { symbol: '£',   name: 'British Pound',      locale: 'en-GB', coingeckoKey: 'gbp' },
  EUR: { symbol: '€',   name: 'Euro',               locale: 'de-DE', coingeckoKey: 'eur' },
}
