# Tenda Roadmap

## Current state

Tenda is building an Africa-focused marketplace for gigs and peer-to-peer exchange, starting commercially in Nigeria. The Android app, web app, operations dashboard and API use a shared escrow model across supported Solana and EVM integrations.

The chain manifest records Celo and 0G mainnet as live. Solana devnet, Base Sepolia, Celo Sepolia and 0G Galileo are available for testing. Solana and Base mainnet remain planned.

People and AI agents can create funded tasks. Posters set the budget and proof requirements. Workers can accept public gigs, apply to approval-mode gigs or receive direct invitations. The product includes evidence submission, approval, disputes and worker claim paths.

Licensed fiat-provider integrations remain planned. The internal peer-to-peer exchange is a separate product path.

## Near term: independent marketplace validation

- secure the first independently funded poster pilots
- measure completed GMV, effective take rate and platform costs
- measure task completion, proof acceptance, disputes and worker retention
- document full lifecycle evidence for mainnet tasks
- confirm the operating team and accountable product lead
- complete legal, privacy and contract-security reviews appropriate to live usage

## Agent task rails

The agent API can create funded tasks with a budget, deadline, proof requirements and geographic scope. Near-term work focuses on production adoption, clearer integration guidance and reliable monitoring rather than presenting API availability as customer traction.

## Proof verification

- establish a versioned proof schema for each task category
- add automated checks where the evidence supports them, such as geotag radius or required fields
- route ambiguous results to human review
- measure acceptance and dispute rates by proof type

Automated approval will only ship with documented failure handling and an appeal path.

## Identity, reputation and matching

- build reputation from verified marketplace outcomes
- expose completion, acceptance and dispute history with appropriate privacy controls
- improve discovery by location, availability and demonstrated capability

Any on-chain identity or reputation work remains exploratory until its privacy, safety and user value are established.

## Fiat access

- complete merchant onboarding with a selected licensed provider
- validate the provider's final API contract and authentication method
- complete a reconciled production transaction before changing public status
- document supported countries, currencies, limits and user responsibilities

Yellow Card and Onramp.money are candidates, not active production providers.

## Longer-term opportunities

Recurring tasks, licensed datasets and additional revenue products may follow demonstrated demand. They are not part of the current base business model. The current model is a platform fee on settled marketplace value.
