/**
 * Moderation configuration (stage-6-moderation.md § Configuration).
 *
 * LLM access goes through OpenRouter (project decision, one gateway/key,
 * OpenAI-compatible API): the doc's separate claude/openai providers
 * collapse into ONE gateway provider with different model ids here, so an
 * alt-vendor incident response is a config change, not new code.
 */

export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const moderationConfig = {
  /** Default model for both pipelines, cheap + fast Haiku class. */
  model: 'anthropic/claude-haiku-4.5',
  /** Escalation model for low-confidence content verdicts. */
  escalationModel: 'anthropic/claude-sonnet-4.5',
  /** Confidence below which the content pipeline escalates models. */
  escalationConfidenceBelow: 0.7,
  /**
   * Per-LLM-call timeout. Gig creation blocks the client on this synchronously
   * (POST /v1/gigs → moderateGig), and a low-confidence content verdict spends
   * a SECOND call on the escalation model — so the worst case the client waits
   * is ~2 × timeoutMs. Kept at 6s (worst case ~12s) to stay clear of the
   * mobile client's per-request moderation budget (MODERATION_TIMEOUT_MS = 20s
   * in apps/mobile/api/client.ts); a longer budget here re-opens the "Aborted"
   * gig-create abort. Haiku/Sonnet moderation of a short gig returns well
   * inside 6s in practice, so this rarely truncates a real verdict (and a
   * timeout degrades to the keyword-only fallback, gigs stay publishable).
   */
  timeoutMs: 6_000,
  thresholds: {
    /** amount < p10 × this → trigger the price-sanity LLM check. */
    priceLowMultiplier: 0.3,
    /** amount > p90 × this → trigger the price-sanity LLM check. */
    priceHighMultiplier: 3.0,
    /** Skip price sanity entirely when stats are thinner than this. */
    minSampleSize: 20,
  },
  cache: {
    ttlSeconds: 86_400,
  },
} as const
