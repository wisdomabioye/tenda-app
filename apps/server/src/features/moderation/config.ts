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
  /** LLM call timeout. */
  timeoutMs: 10_000,
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
