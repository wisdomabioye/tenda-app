import { useEffect, useState } from 'react'
import {
  isValidGigAmountRaw,
  MIN_COMPLETION_DURATION_SECONDS,
  ASSET_META,
  GIG_ASSET_BY_CHAIN,
  solanaChainId,
} from '@tenda/shared'
import type { GigCategory, ChainRegistryEntry } from '@tenda/shared'
import { getDeviceCountry } from '@/lib/device'
import { api } from '@/api/client'
import { SOLANA_NETWORK } from '@/wallet/config'
import { useAuthStore } from '@/stores/auth.store'
import { useModerationPreview } from '@/hooks/useModerationPreview'
import { CATEGORY_HINTS } from './constants'
import type { GigFormValues } from './constants'

export interface ChainOption {
  id: string
  label: string
  enabled: boolean
}

/**
 * Controller for the gig create/edit form, owns all field state, the
 * server chain registry, the live moderation preview, and submit/validation.
 * The screen stays presentational and just wires the returned values to the UI.
 */
export function useGigForm(
  initialValues: Partial<GigFormValues> | undefined,
  onSubmit: (values: GigFormValues) => Promise<void>,
) {
  const homeCountry = useAuthStore((s) => s.user?.country ?? null)
  const wallets = useAuthStore((s) => s.wallets)

  const defaultChainId = solanaChainId(SOLANA_NETWORK)
  const [title, setTitle]                         = useState(initialValues?.title ?? '')
  const [description, setDescription]             = useState(initialValues?.description ?? '')
  const [chainId, setChainId]                     = useState(initialValues?.chainId ?? defaultChainId)
  const [paymentRaw, setPaymentRaw]               = useState(initialValues?.paymentRaw ?? 0)
  const [registry, setRegistry]                   = useState<ChainRegistryEntry[]>([])
  const [completionDuration, setCompletionDuration] = useState(initialValues?.completionDuration ?? 86_400)
  const [selectedCategory, setSelectedCategory]   = useState<GigCategory | null>(initialValues?.category ?? null)
  // Prefer the user's account country; fall back to the device locale region
  // (often the phone's language, not where the user actually is) only when the
  // account has none.
  const [selectedCountry, setSelectedCountry]     = useState<string | null>(initialValues?.country ?? homeCountry ?? getDeviceCountry())
  const [isRemote, setIsRemote]                   = useState(initialValues?.remote ?? false)
  const [selectedCity, setSelectedCity]           = useState<string | null>(initialValues?.city ?? null)
  const [acceptDeadlineHours, setAcceptDeadlineHours] = useState<number>(initialValues?.acceptDeadlineHours ?? 168)
  const [warnSheetOpen, setWarnSheetOpen] = useState(false)

  // CO5: chain options come from the server registry; a chain is gig-
  // eligible when the shared GIG_ASSET_BY_CHAIN policy names an asset the
  // registry actually carries. EVM chains stay disabled until the user
  // links an eip155 wallet.
  useEffect(() => {
    api.platform
      .chains()
      .then(({ data }) => setRegistry(data))
      .catch(() => setRegistry([])) // silent: the Solana default still works
  }, [])

  const hasEvmWallet = wallets.some((w) => w.chain_ns === 'eip155' && w.verified_at !== null)
  const chainOptions: ChainOption[] = registry
    .filter((c) => {
      const gigAsset = GIG_ASSET_BY_CHAIN[c.id]
      return gigAsset !== undefined && c.assets.some((a) => a.id === gigAsset)
    })
    .map((c) => ({
      id: c.id,
      label: c.display_name,
      enabled: c.namespace !== 'eip155' || hasEvmWallet,
    }))

  // The asset is POLICY-derived, never user-picked: gigs are USDC-only.
  const asset = GIG_ASSET_BY_CHAIN[chainId] ?? GIG_ASSET_BY_CHAIN[defaultChainId] ?? 'USDC_SOL'
  const assetSymbol = ASSET_META[asset]?.symbol ?? asset

  // Stage-6 live moderation hints, debounced, advisory only; the server
  // re-runs the same pipeline on create and stays authoritative.
  const moderation = useModerationPreview({
    title,
    description,
    category: selectedCategory,
    country: selectedCountry,
    asset,
    paymentRaw,
  })

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    isValidGigAmountRaw(asset, paymentRaw) &&
    selectedCategory !== null &&
    (isRemote || (selectedCountry !== null && selectedCity !== null)) &&
    completionDuration >= MIN_COMPLETION_DURATION_SECONDS

  async function submitValues() {
    await onSubmit({
      title,
      description,
      chainId,
      asset,
      paymentRaw,
      completionDuration,
      category: selectedCategory,
      country: selectedCountry,
      remote: isRemote,
      city: isRemote ? null : selectedCity,
      acceptDeadlineHours,
    })
  }

  async function handleSubmit() {
    if (!isValid) return
    // Warn verdicts get one explicit confirmation before publishing.
    if (moderation?.decision === 'warn' && !warnSheetOpen) {
      setWarnSheetOpen(true)
      return
    }
    setWarnSheetOpen(false)
    await submitValues()
  }

  const descriptionHint = selectedCategory
    ? CATEGORY_HINTS[selectedCategory]
    : 'Include scope, requirements, and expectations.'

  return {
    title, setTitle,
    description, setDescription,
    chainId, setChainId,
    paymentRaw, setPaymentRaw,
    completionDuration, setCompletionDuration,
    selectedCategory, setSelectedCategory,
    selectedCountry, setSelectedCountry,
    isRemote, setIsRemote,
    selectedCity, setSelectedCity,
    acceptDeadlineHours, setAcceptDeadlineHours,
    warnSheetOpen, setWarnSheetOpen,
    homeCountry,
    chainOptions,
    asset,
    assetSymbol,
    moderation,
    isValid,
    descriptionHint,
    handleSubmit,
    submitValues,
  }
}
