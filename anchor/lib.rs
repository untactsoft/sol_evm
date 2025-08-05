use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("HQ24JdiocERDsdbnKxc5YM6Chr2wX4QDPWGYDhzsitcm");

#[program]
pub mod voting_program {
    use super::*;

    pub fn create_poll(
        ctx: Context<CreatePoll>,
        title: String,
        candidates: Vec<String>,
        deadline: i64,
        required_mint: Pubkey,
    ) -> Result<()> {
        require!(
            candidates.len() >= 2 && candidates.len() <= Poll::MAX_CANDIDATES,
            VotingError::InvalidCandidate
        );
        let poll = &mut ctx.accounts.poll;
        poll.title = title;
        poll.candidates = candidates;
        poll.votes = vec![0; poll.candidates.len()];
        poll.owner = ctx.accounts.authority.key();
        poll.deadline = deadline;
        poll.required_mint = required_mint;
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, candidate_index: u8, amount: u64) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        let now = Clock::get()?.unix_timestamp;
        require!(now < poll.deadline, VotingError::PollClosed);
        require!(
            (candidate_index as usize) < poll.candidates.len(),
            VotingError::InvalidCandidate
        );
        require!(
            ctx.accounts.voter_token_account.mint == poll.required_mint,
            VotingError::WrongMint
        );
        require!(
            ctx.accounts.voter_token_account.owner == ctx.accounts.voter.key(),
            VotingError::NoTokenAccount
        );
        require!(
            ctx.accounts.voter_token_account.amount >= amount,
            VotingError::InsufficientToken
        );
        let cpi_accounts = Transfer {
            from: ctx.accounts.voter_token_account.to_account_info(),
            to: ctx.accounts.poll_vault.to_account_info(),
            authority: ctx.accounts.voter.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        poll.votes[candidate_index as usize] += amount;
        Ok(())
    }

    pub fn reset_poll(ctx: Context<ResetPoll>) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        poll.is_closed = true;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreatePoll<'info> {
    #[account(init, payer = authority, space = Poll::MAX_SIZE)]
    pub poll: Account<'info, Poll>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub poll: Account<'info, Poll>,
    pub voter: Signer<'info>,
    #[account(mut)]
    pub voter_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub poll_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResetPoll<'info> {
    #[account(mut, has_one = owner)]
    pub poll: Account<'info, Poll>,
    pub owner: Signer<'info>,
}

#[account]
pub struct Poll {
    pub title: String,
    pub candidates: Vec<String>,
    pub votes: Vec<u64>,
    pub owner: Pubkey,
    pub deadline: i64,
    pub required_mint: Pubkey,
    pub is_closed: bool,
}

impl Poll {
    pub const MAX_CANDIDATES: usize = 5;
    pub const MAX_TITLE_LEN: usize = 40;
    pub const MAX_CANDIDATE_LEN: usize = 20;
    pub const MAX_SIZE: usize = 8
        + 4
        + Self::MAX_TITLE_LEN
        + 4
        + Self::MAX_CANDIDATES * (4 + Self::MAX_CANDIDATE_LEN)
        + 4
        + Self::MAX_CANDIDATES * 8
        + 32
        + 8
        + 32;
}

#[error_code]
pub enum VotingError {
    #[msg("투표 마감")]
    PollClosed,
    #[msg("잘못된 후보")]
    InvalidCandidate,
    #[msg("투표권 토큰 부족")]
    InsufficientToken,
    #[msg("잘못된 Mint")]
    WrongMint,
    #[msg("TokenAccount 불일치")]
    NoTokenAccount,
}
