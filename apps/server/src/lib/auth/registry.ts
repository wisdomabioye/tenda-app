/**
 * Build the per-request auth strategy set from the Fastify context. Methods
 * not yet wired (google/apple land in Stage 9B) are simply absent — the
 * routes answer UNSUPPORTED_AUTH_METHOD for any method without a strategy.
 */

import type { FastifyInstance } from 'fastify'
import { buildOtpDeps } from '@server/lib/onboarding-deps'
import { otpStrategy } from '@server/lib/auth/strategies/otp'
import { walletStrategy } from '@server/lib/auth/strategies/wallet'
import type { AuthStrategyRegistry } from '@server/lib/auth/strategy'

export function buildAuthStrategies(fastify: FastifyInstance): AuthStrategyRegistry {
  const otpDeps = buildOtpDeps(fastify)
  return {
    phone: otpStrategy('phone', otpDeps),
    email: otpStrategy('email', otpDeps),
    wallet: walletStrategy({ chains: fastify.chains, db: fastify.db, now: () => new Date() }),
  }
}
