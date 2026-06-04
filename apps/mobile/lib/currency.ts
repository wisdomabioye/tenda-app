import { ASSET_META, CURRENCY_META, LAMPORTS_PER_SOL, amountRawToDisplay, type SupportedCurrency } from '@tenda/shared'

export interface PaymentDisplay {
  fiat: number
  sol: number
}

/**
 * Convert payment_lamports to display values (SOL + fiat equivalent).
 * Pass the rate for the user's preferred currency from useExchangeRateStore().
 * Returns fiat = 0 if rate is not yet available (rates = null).
 */
export function toPaymentDisplay(paymentLamports: number, rate: number | null): PaymentDisplay {
  const sol = paymentLamports / LAMPORTS_PER_SOL
  const fiat = rate != null && rate > 0 ? sol * rate : 0
  return { fiat, sol }
}

export interface AssetPaymentDisplay {
  /** Display units (raw / 10^decimals). */
  amount: number
  symbol: string
  /** Fiat equivalent — null when not derivable (rates are SOL-denominated). */
  fiat: number | null
}

/**
 * Asset-aware payment display for v2 escrows. The platform rate cache is
 * fiat-per-SOL, so only SOL-denominated amounts get a fiat equivalent.
 */
export function toAssetPaymentDisplay(
  amount_raw: string,
  asset: string,
  rate: number | null,
): AssetPaymentDisplay {
  const amount = amountRawToDisplay(amount_raw, asset)
  const symbol = ASSET_META[asset]?.symbol ?? asset
  const fiat = symbol === 'SOL' && rate !== null && rate > 0 ? amount * rate : null
  return { amount, symbol, fiat }
}

/** Format lamports as a SOL string, e.g. "0.05 SOL" */
export function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL
  return `${sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`
}

/** Format a SOL amount (already in SOL, not lamports) as a display string, e.g. "0.05 SOL" */
export function formatSolDisplay(sol: number): string {
  return `${sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`
}

/** Format a payment window in seconds as a human-readable string, e.g. "24h" or "30m". */
export function formatPaymentWindow(seconds: number): string {
  const h = seconds / 3600
  if (h < 1) return `${Math.round(seconds / 60)}m`
  if (h === Math.floor(h)) return `${h}h`
  return `${h.toFixed(1)}h`
}

/** Format a fiat amount in the given currency, e.g. formatFiat(85000, 'NGN') → "₦85,000" */
export function formatFiat(amount: number, currency: SupportedCurrency): string {
  const { locale } = CURRENCY_META[currency]
  return amount.toLocaleString(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
}

/**
 * Compact currency display used in card densities — e.g. "₦240k", "$1.5M".
 * Falls back to full formatFiat() for amounts < 1,000.
 */
export function formatFiatShort(amount: number, currency: SupportedCurrency): string {
  const { locale } = CURRENCY_META[currency]
  const symbol = (0).toLocaleString(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
    .replace(/[\d.,\s]/g, '')
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `${symbol}${Math.round(amount / 1_000)}k`
  return formatFiat(amount, currency)
}
