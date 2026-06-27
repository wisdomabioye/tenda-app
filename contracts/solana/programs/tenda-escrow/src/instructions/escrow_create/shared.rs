use anchor_lang::prelude::*;

use crate::constants::{
    MAX_COMPLETION_DURATION_SECONDS, MIN_COMPLETION_DURATION_SECONDS, MIN_ESCROW_AMOUNT,
};
use crate::errors::TendaError;
use crate::state::EscrowKind;

/// Args shared by `create_escrow_sol` and `create_escrow_spl`. Both paths
/// validate identically; the only difference is which account-set the runtime
/// produces (lamport vault vs. SPL token account).
///
/// `accept_deadline` is absolute Unix seconds (matches what the server already
/// produces — no client-side relative-time computation). `completion_duration`
/// is relative because completion_deadline is computed at accept-time, not
/// create-time.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateEscrowArgs {
    pub escrow_id: [u8; 16],
    pub kind: EscrowKind,
    pub amount: u64,
    pub assigned_counterparty: Option<Pubkey>,
    pub accept_deadline: i64,
    pub completion_duration_seconds: i64,
    pub dispute_bond: u64,
    pub is_seeker: bool,
}

impl CreateEscrowArgs {
    /// Caller-side input validation. Runs from both create paths before any
    /// state writes.
    pub fn validate(&self, now: i64) -> Result<()> {
        require!(self.amount >= MIN_ESCROW_AMOUNT, TendaError::AmountTooLow);
        require!(
            self.accept_deadline > now,
            TendaError::AcceptDeadlineInPast
        );
        require!(
            (MIN_COMPLETION_DURATION_SECONDS..=MAX_COMPLETION_DURATION_SECONDS)
                .contains(&self.completion_duration_seconds),
            TendaError::CompletionDurationOutOfRange
        );
        Ok(())
    }
}
