use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Crash8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8");

/// Crash Game: Multiplier rises, cash out before crash
/// House edge: ~1% (configurable)
#[program]
pub mod crash {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.house = ctx.accounts.house.key();
        game.authority = ctx.accounts.authority.key();
        game.total_rounds = 0;
        game.total_volume = 0;
        game.total_profit = 0;
        game.max_bet = 100_000_000; // 0.1 SOL
        game.min_bet = 1_000_000;
        game.house_edge = 100; // 1% (basis points)
        game.max_multiplier = 10000; // 100x
        game.emergency_pause = false;
        Ok(())
    }

    /// Start a new game round (creates game state)
    pub fn start_round(ctx: Context<StartRound>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        round.game = ctx.accounts.game.key();
        round.round_id = ctx.accounts.game.total_rounds + 1;
        round.status = 0; // Pending
        round.crash_point = generate_crash_point(&ctx.accounts.game)?;
        round.total_bets = 0;
        round.total_players = 0;
        
        ctx.accounts.game.total_rounds += 1;
        
        emit!(RoundStarted {
            round_id: round.round_id,
            crash_point: round.crash_point,
        });
        
        Ok(())
    }

    /// Place bet for current round
    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
        let game = &ctx.accounts.game;
        let round = &ctx.accounts.round;
        
        require!(!game.emergency_pause, ErrorCode::GamePaused);
        require!(round.status == 0, ErrorCode::RoundInProgress);
        require!(amount >= game.min_bet, ErrorCode::BelowMinBet);
        require!(amount <= game.max_bet, ErrorCode::AboveMaxBet);
        require!(amount <= ctx.accounts.house.lamports() / 10, ErrorCode::ExceedsHouseLimit);
        
        // Check if player already bet
        require!(!ctx.accounts.player_bet.has_bet, ErrorCode::AlreadyBet);
        
        // Transfer bet to house
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.house.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;
        
        // Record player bet
        let player_bet = &mut ctx.accounts.player_bet;
        player_bet.player = ctx.accounts.player.key();
        player_bet.round = round.key();
        player_bet.amount = amount;
        player_bet.has_bet = true;
        player_bet.cashed_out = false;
        player_bet.cash_out_multiplier = 0;
        
        let round = &mut ctx.accounts.round;
        round.total_bets += amount;
        round.total_players += 1;
        
        emit!(BetPlaced {
            round_id: round.round_id,
            player: ctx.accounts.player.key(),
            amount,
        });
        
        Ok(())
    }

    /// Cash out at current multiplier (called by player when they want to exit)
    pub fn cash_out(ctx: Context<CashOut>, current_multiplier: u64) -> Result<()> {
        let round = &ctx.accounts.round;
        let player_bet = &mut ctx.accounts.player_bet;
        
        require!(round.status == 1, ErrorCode::RoundNotActive); // Round must be active
        require!(player_bet.has_bet, ErrorCode::NoBetPlaced);
        require!(!player_bet.cashed_out, ErrorCode::AlreadyCashedOut);
        require!(current_multiplier > 100, ErrorCode::InvalidMultiplier); // Min 1.00x
        require!(current_multiplier <= round.crash_point, ErrorCode::AlreadyCrashed);
        
        let payout = (player_bet.amount as u128)
            .checked_mul(current_multiplier as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;
        
        require!(ctx.accounts.house.lamports() >= payout, ErrorCode::InsufficientHouseFunds);
        
        // Pay player
        **ctx.accounts.house.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += payout;
        
        player_bet.cashed_out = true;
        player_bet.cash_out_multiplier = current_multiplier;
        
        let profit = payout as i64 - player_bet.amount as i64;
        let game = &mut ctx.accounts.game;
        game.total_profit -= profit;
        
        emit!(CashOutEvent {
            round_id: round.round_id,
            player: ctx.accounts.player.key(),
            multiplier: current_multiplier,
            payout,
        });
        
        Ok(())
    }

    /// End round (called when crash happens or manually)
    pub fn end_round(ctx: Context<EndRound>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(round.status == 1, ErrorCode::RoundNotActive);
        
        round.status = 2; // Ended
        
        // House keeps all uncashed bets
        let game = &mut ctx.accounts.game;
        game.total_volume += round.total_bets;
        // Profit already calculated on cashouts, remaining is house profit
        
        emit!(RoundEnded {
            round_id: round.round_id,
            crash_point: round.crash_point,
            total_bets: round.total_bets,
        });
        
        Ok(())
    }

    /// Start the round (activate betting)
    pub fn activate_round(ctx: Context<AuthorityAction>) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        ctx.accounts.round.status = 1; // Active
        Ok(())
    }

    pub fn update_max_bet(ctx: Context<AuthorityAction>, new_max: u64) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        ctx.accounts.game.max_bet = new_max;
        Ok(())
    }

    pub fn toggle_pause(ctx: Context<AuthorityAction>) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        ctx.accounts.game.emergency_pause = !ctx.accounts.game.emergency_pause;
        Ok(())
    }
}

fn generate_crash_point(game: &Account<Game>) -> Result<u64> {
    let slot = Clock::get()?.slot;
    let timestamp = Clock::get()?.unix_timestamp;
    
    let mut hash_input = Vec::new();
    hash_input.extend_from_slice(&slot.to_le_bytes());
    hash_input.extend_from_slice(&timestamp.to_le_bytes());
    hash_input.extend_from_slice(&game.total_rounds.to_le_bytes());
    
    let hash = fnv_hash(&hash_input);
    
    // 1% house edge: 99% chance to continue at each step
    // Use geometric distribution
    let r = (hash % 10000) as f64 / 10000.0; // 0.0 to 0.9999
    let edge = game.house_edge as f64 / 10000.0; // 0.01
    
    // Crash point formula: 0.99 / (1 - r) with max cap
    let crash = (0.99 / (1.0 - r)).min(game.max_multiplier as f64 / 100.0);
    
    Ok((crash * 100.0) as u64) // Return as basis points (1.00x = 100)
}

fn fnv_hash(input: &[u8]) -> u64 {
    let mut hash: u64 = 14695981039346656037;
    for byte in input {
        hash = hash.wrapping_mul(1099511628211);
        hash ^= *byte as u64;
    }
    hash
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Game::SIZE)]
    pub game: Account<'info, Game>,
    /// CHECK: House wallet
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartRound<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(init, payer = authority, space = 8 + Round::SIZE)]
    pub round: Account<'info, Round>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(init, payer = player, space = 8 + PlayerBet::SIZE)]
    pub player_bet: Account<'info, PlayerBet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CashOut<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub player_bet: Account<'info, PlayerBet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndRound<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AuthorityAction<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub round: Account<'info, Round>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Game {
    pub house: Pubkey,
    pub authority: Pubkey,
    pub total_rounds: u64,
    pub total_volume: u64,
    pub total_profit: i64,
    pub max_bet: u64,
    pub min_bet: u64,
    pub house_edge: u64, // basis points (100 = 1%)
    pub max_multiplier: u64,
    pub emergency_pause: bool,
}

impl Game {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Round {
    pub game: Pubkey,
    pub round_id: u64,
    pub status: u8, // 0=Pending, 1=Active, 2=Ended
    pub crash_point: u64, // in basis points (100 = 1.00x)
    pub total_bets: u64,
    pub total_players: u32,
}

impl Round {
    pub const SIZE: usize = 32 + 8 + 1 + 8 + 8 + 4;
}

#[account]
pub struct PlayerBet {
    pub player: Pubkey,
    pub round: Pubkey,
    pub amount: u64,
    pub has_bet: bool,
    pub cashed_out: bool,
    pub cash_out_multiplier: u64,
}

impl PlayerBet {
    pub const SIZE: usize = 32 + 32 + 8 + 1 + 1 + 8;
}

#[event]
pub struct RoundStarted {
    pub round_id: u64,
    pub crash_point: u64,
}

#[event]
pub struct BetPlaced {
    pub round_id: u64,
    pub player: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CashOutEvent {
    pub round_id: u64,
    pub player: Pubkey,
    pub multiplier: u64,
    pub payout: u64,
}

#[event]
pub struct RoundEnded {
    pub round_id: u64,
    pub crash_point: u64,
    pub total_bets: u64,
}

#[error_code]
pub enum ErrorCode {
    GamePaused,
    RoundInProgress,
    RoundNotActive,
    AlreadyBet,
    NoBetPlaced,
    AlreadyCashedOut,
    InvalidMultiplier,
    AlreadyCrashed,
    BelowMinBet,
    AboveMaxBet,
    ExceedsHouseLimit,
    InsufficientHouseFunds,
    Unauthorized,
}