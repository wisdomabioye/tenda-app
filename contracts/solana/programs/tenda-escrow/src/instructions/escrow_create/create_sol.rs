use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::{ESCROW_SEED, ESCROW_VAULT_SEED};
use crate::errors::TendaError;
use crate::events::EscrowCreated;
use crate::instructions::vault::fund_vault_from_signer;
use crate::state::{Escrow, EscrowStatus};

use super::shared::CreateEscrowArgs;

#[derive(Accounts)]
#[instruction(args: CreateEscrowArgs)]
pub struct CreateEscrowSol<'info> {
    #[account(
        init,
        payer = creator,
        space = Escrow::LEN,
        seeds = [ESCROW_SEED, args.escrow_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// System-owned PDA holding escrowed lamports + dispute bond. Created as
    /// a zero-data system account so its lamport balance is the escrow value.
    /// CHECK: enforced by seed derivation; no data layout assumed.
    #[account(
        mut,
        seeds = [ESCROW_VAULT_SEED, args.escrow_id.as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateEscrowSol>, args: CreateEscrowArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    args.validate(now)?;

    // The vault is a 0-data system account; the runtime requires every
    // written account to end the tx rent-exempt or at exactly zero balance.
    // A sub-rent-minimum escrow would fail with an opaque runtime rent error
    // at the end of this tx — reject it here with a typed error instead.
    let vault_rent_min = Rent::get()?.minimum_balance(0);
    require!(
        args.amount >= vault_rent_min,
        TendaError::AmountBelowVaultRentMinimum
    );

    let escrow = &mut ctx.accounts.escrow;
    escrow.escrow_id = args.escrow_id;
    escrow.kind = args.kind;
    escrow.asset = system_program::ID;
    escrow.amount = args.amount;
    escrow.creator = ctx.accounts.creator.key();
    escrow.counterparty = None;
    escrow.assigned_counterparty = args.assigned_counterparty;
    escrow.status = EscrowStatus::Open;
    escrow.accept_deadline = args.accept_deadline;
    escrow.completion_duration_seconds = args.completion_duration_seconds;
    escrow.completion_deadline = 0;
    escrow.approval_deadline = 0;
    escrow.dispute_bond = args.dispute_bond;
    escrow.is_seeker = args.is_seeker;
    escrow.created_at = now;
    escrow.bump = ctx.bumps.escrow;
    escrow.vault_bump = ctx.bumps.vault;

    // Move the escrow amount into the vault. Bond is NOT funded at create;
    // the disputing party funds it inside `dispute_escrow_sol`.
    fund_vault_from_signer(
        &ctx.accounts.creator.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        args.amount,
    )?;

    emit!(EscrowCreated {
        escrow_id: escrow.escrow_id,
        kind: escrow.kind,
        asset: escrow.asset,
        amount: escrow.amount,
        creator: escrow.creator,
        assigned_counterparty: escrow.assigned_counterparty,
        accept_deadline: escrow.accept_deadline,
        completion_duration_seconds: args.completion_duration_seconds,
        dispute_bond: escrow.dispute_bond,
        is_seeker: escrow.is_seeker,
        timestamp: now,
    });
    Ok(())
}
