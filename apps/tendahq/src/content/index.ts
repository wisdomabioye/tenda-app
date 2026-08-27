/**
 * Central content layer — every cross-section fact and showcased dataset on
 * the landing. Section-specific prose stays in each section's content.ts;
 * everything reusable or editorial (tasks, trades, features, chains) is here.
 */

export { APP_INFO, type AppInfo } from './app-info'
export {
  LANDING_CHAINS,
  CHAIN_NAMES_LINE,
  CHAIN_NAMES_PROSE,
  CHAIN_STRENGTHS_PROSE,
  EXCHANGE_ASSET_SYMBOLS_PROSE,
  EVM_CHAIN_NAMES_PROSE,
  MORE_CHAINS_LABEL,
  chainByFamily,
  displayFor,
  explorerHost,
  transportFor,
  type LandingChain,
} from './chains'
export {
  CURRENCIES,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from './currencies'
export {
  CATEGORIES,
  CATEGORY_LABELS_LINE,
  CATEGORY_LABELS_PROSE,
  GIG_CATEGORIES,
} from './categories'
export {
  TRADE_CURRENCIES,
  TRADE_COUNTRIES_PROSE,
  TRADE_CURRENCIES_PROSE,
  TRADE_MARKET_COUNT,
  DISPLAY_CURRENCY_COUNT,
} from './markets'
export {
  FEE_PCT,
  SEEKER_FEE_PCT,
  APPROVAL_WINDOW_HOURS,
  FEE_EXAMPLE,
} from './fees'
export { EXAMPLE_TASKS, type ExampleTask } from './tasks'
export { EXAMPLE_TRADES, type ExampleTrade, type TradeAssetSymbol } from './trades'
export {
  ONBOARDING_FEATURES,
  ONBOARDING_HEADER,
  GAS_FREE_START_SENTENCE,
  type OnboardingFeature,
  type FeatureStatus,
} from './features'
export { ECOSYSTEM_PANELS, ECOSYSTEMS_HEADER, type EcosystemPanel } from './ecosystems'
