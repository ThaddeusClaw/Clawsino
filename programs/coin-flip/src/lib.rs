use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG");

/// AUTOMATED HOUSE CONFIGURATION
const MAX_BET_PERCENTAGE: u64 = 10; // 10% of house balance
const MIN_BET: u64 = 1_000_000; // 0.001 SOL
const MAX_BET_ABSOLUTE: u64 = 100_000_000; // 0.1 SOL hard cap

#[program]
pub mod coin_flip {
    use super::*;

    /// Initialize with house parameters
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let house = &ctx.accounts.house;
        
        game.house = house.key();
        game.authority = ctx.accounts.authority.key();
        game.total_flips = 0;
        game.total_wins = 0;
        game.total_losses = 0;
        game.total_volume = 0;
        game.total_profit = 0;
        game.max_bet = MAX_BET_ABSOLUTE;
        game.min_bet = MIN_BET;
        game.emergency_pause = false;
        
        msg!("House initialized with {} lamports", house.lamports());
        Ok(())
    }

    /// AUTOMATED FLIP - No manual approval needed
    pub fn flip(ctx: Context<Flip>, amount: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let house = &ctx.accounts.house;
        let player = &ctx.accounts.player;
        
        // === SAFETY CHECKS (Auto-enforced) ===
        require!(!game.emergency_pause, ErrorCode::GamePaused);
        require!(amount >= game.min_bet, ErrorCode::BelowMinBet);
        require!(amount <= game.max_bet, ErrorCode::AboveMaxBet);
        require!(amount <= house.lamports() / 10, ErrorCode::ExceedsHouseLimit); // 10% rule
        require!(house.lamports() >= amount * 2, ErrorCode::InsufficientHouseFunds);
        
        // === RANDOMNESS ===
        let slot = Clock::get()?.slot;
        let timestamp = Clock::get()?.unix_timestamp;
        let random_value = generate_random(&player.key(), slot, timestamp, game.total_flips);
        let is_win = random_value % 2 == 0;
        
        // === UPDATE STATS ===
        game.total_flips += 1;
        game.total_volume += amount;
        
        // === AUTOMATED PAYOUT ===
        if is_win {
            // Player wins: House pays 2x
            let payout = amount * 2;
            **house.to_account_info().try_borrow_mut_lamports()? -= payout;
            **player.to_account_info().try_borrow_mut_lamports()? += payout;
            game.total_losses += 1;
            game.total_profit -= amount as i64;
            
            msg!("WIN: Player {} won {} lamports", player.key(), payout);
        } else {
            // Player loses: House keeps bet
            **player.to_account_info().try_borrow_mut_lamports()? -= amount;
            **house.to_account_info().try_borrow_mut_lamports()? += amount;
            game.total_wins += 1;
            game.total_profit += amount as i64;
            
            msg!("LOSS: House gained {} lamports", amount);
        }
        
        // === EMERGENCY CHECKS ===
        if house.lamports() < 200_000_000 { // < 0.2 SOL
            msg!("WARNING: House balance low!");
        }
        
        emit!(FlipResult {
            player: player.key(),
            amount,
            is_win,
            house_balance: house.lamports(),
            slot,
            timestamp,
        });
        
        Ok(())
    }
    
    /// Update max bet (authority only) - For scaling up
    pub fn update_max_bet(ctx: Context<AuthorityAction>, new_max_bet: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game.authority,
            ErrorCode::Unauthorized
        );
        require!(new_max_bet <= 500_000_000, ErrorCode::MaxBetTooHigh); // Max 0.5 SOL
        
        ctx.accounts.game.max_bet = new_max_bet;
        msg!("Max bet updated to {} lamports", new_max_bet);
        Ok(())
    }
    
    /// Emergency pause (authority only)
    pub fn toggle_pause(ctx: Context<AuthorityAction>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game.authority,
            ErrorCode::Unauthorized
        );
        ctx.accounts.game.emergency_pause = !ctx.accounts.game.emergency_pause;
        msg!("Game pause: {}", ctx.accounts.game.emergency_pause);
        Ok(())
    }
    
    /// Deposit to house (anyone can add liquidity)
    pub fn deposit_to_house(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.house.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;
        
        msg!("Deposited {} lamports to house", amount);
        Ok(())
    }
    
    /// Withdraw profits (authority only, max 50% of profit)
    pub fn withdraw_profits(ctx: Context<AuthorityAction>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.game.authority,
            ErrorCode::Unauthorized
        );
        require!(ctx.accounts.game.total_profit > 0, ErrorCode::NoProfits);
        
        let max_withdraw = (ctx.accounts.game.total_profit as u64) / 2;
        require!(amount <= max_withdraw, ErrorCode::WithdrawTooHigh);
        require!(ctx.accounts.house.lamports() >= amount + 500_000_000, ErrorCode::HouseTooLow);
        
        **ctx.accounts.house.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;
        
        msg!("Withdrew {} lamports profit", amount);
        Ok(())
    }
}

/// Deterministic random using multiple entropy sources
fn generate_random(player: &Pubkey, slot: u64, timestamp: i64, nonce: u64) -> u64 {
    let mut hash_input = Vec::new();
    hash_input.extend_from_slice(&player.to_bytes());
    hash_input.extend_from_slice(&slot.to_le_bytes());
    hash_input.extend_from_slice(&timestamp.to_le_bytes());
    hash_input.extend_from_slice(&nonce.to_le_bytes());
    
    // FNV-1a hash
    let mut hash: u64 = 14695981039346656037;
    for byte in &hash_input {
        hash = hash.wrapping_mul(1099511628211);
        hash ^= *byte as u64;
    }
    hash
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Game::SIZE)]
    pub game: Account<'info, Game>,
    /// CHECK: House wallet - funded separately
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Flip<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthorityAction<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Game {
    pub house: Pubkey,
    pub authority: Pubkey,
    pub total_flips: u64,
    pub total_wins: u64,
    pub total_losses: u64,
    pub total_volume: u64,
    pub total_profit: i64,
    pub max_bet: u64,
    pub min_bet: u64,
    pub emergency_pause: bool,
}

impl Game {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[event]
pub struct FlipResult {
    pub player: Pubkey,
    pub amount: u64,
    pub is_win: bool,
    pub house_balance: u64,
    pub slot: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Game is paused")]
    GamePaused,
    #[msg("Below minimum bet")]
    BelowMinBet,
    #[msg("Above maximum bet")]
    AboveMaxBet,
    #[msg("Bet exceeds 10% of house")]
    ExceedsHouseLimit,
    #[msg("Insufficient house funds")]
    InsufficientHouseFunds,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Max bet too high")]
    MaxBetTooHigh,
    #[msg("No profits to withdraw")]
    NoProfits,
    #[msg("Withdraw amount too high")]
    WithdrawTooHigh,
    #[msg("House balance too low for withdrawal")]
    HouseTooLow,
}