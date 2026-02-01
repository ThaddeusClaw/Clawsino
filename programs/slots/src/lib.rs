use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Slots8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8");

/// Slot Machine: 3 reels, 5 symbols
/// Paylines: Center row (default), configurable
#[program]
pub mod slots {
    use super::*;

    const SYMBOLS: [u8; 5] = [0, 1, 2, 3, 4]; // Cherry, Lemon, Orange, Bar, Seven
    const PAYOUTS: [u64; 5] = [2, 3, 5, 10, 50]; // Multipliers for 3-of-a-kind
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.house = ctx.accounts.house.key();
        game.authority = ctx.accounts.authority.key();
        game.total_spins = 0;
        game.total_volume = 0;
        game.total_profit = 0;
        game.max_bet = 100_000_000; // 0.1 SOL
        game.min_bet = 1_000_000;
        game.jackpot = 0;
        game.jackpot_contribution = 10; // 0.1% of each bet to jackpot
        game.emergency_pause = false;
        Ok(())
    }

    /// Spin the slots
    pub fn spin(ctx: Context<Spin>, amount: u64) -> Result<()> {
        let game = &ctx.accounts.game;
        let house = &ctx.accounts.house;
        let player = &ctx.accounts.player;
        
        require!(!game.emergency_pause, ErrorCode::GamePaused);
        require!(amount >= game.min_bet, ErrorCode::BelowMinBet);
        require!(amount <= game.max_bet, ErrorCode::AboveMaxBet);
        require!(amount <= house.lamports() / 10, ErrorCode::ExceedsHouseLimit);
        
        // Generate 3 reel results
        let reels = generate_reels(player, game)?;
        
        // Calculate win
        let (is_win, payout_multiplier) = calculate_payout(reels);
        let payout = if is_win {
            amount * payout_multiplier
        } else {
            0
        };
        
        // Handle jackpot contribution
        let jackpot_add = amount * game.jackpot_contribution / 10000;
        let game = &mut ctx.accounts.game;
        game.jackpot += jackpot_add;
        
        // Check for jackpot win (3 Sevens = Jackpot!)
        let is_jackpot = reels[0] == 4 && reels[1] == 4 && reels[2] == 4;
        let final_payout = if is_jackpot {
            let jackpot_payout = game.jackpot;
            game.jackpot = 0; // Reset jackpot
            payout + jackpot_payout
        } else {
            payout
        };
        
        // Transfer bet to house
        **player.to_account_info().try_borrow_mut_lamports()? -= amount;
        **house.to_account_info().try_borrow_mut_lamports()? += amount;
        
        game.total_spins += 1;
        game.total_volume += amount;
        
        if final_payout > 0 {
            require!(house.lamports() >= final_payout, ErrorCode::InsufficientHouseFunds);
            **house.to_account_info().try_borrow_mut_lamports()? -= final_payout;
            **player.to_account_info().try_borrow_mut_lamports()? += final_payout;
            game.total_profit -= (final_payout - amount) as i64;
        } else {
            game.total_profit += amount as i64;
        }
        
        emit!(SpinResult {
            player: player.key(),
            reels,
            bet_amount: amount,
            payout: final_payout,
            is_win: final_payout > 0,
            is_jackpot,
            jackpot_amount: if is_jackpot { game.jackpot + payout } else { 0 },
        });
        
        Ok(())
    }

    /// Update settings (authority only)
    pub fn update_settings(
        ctx: Context<AuthorityAction>,
        new_max_bet: u64,
        jackpot_contribution: u64,
    ) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        require!(jackpot_contribution <= 1000, ErrorCode::InvalidContribution); // Max 10%
        
        ctx.accounts.game.max_bet = new_max_bet;
        ctx.accounts.game.jackpot_contribution = jackpot_contribution;
        Ok(())
    }

    /// Toggle pause (authority only)
    pub fn toggle_pause(ctx: Context<AuthorityAction>) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        ctx.accounts.game.emergency_pause = !ctx.accounts.game.emergency_pause;
        Ok(())
    }

    /// Seed jackpot (authority can add initial funds)
    pub fn seed_jackpot(ctx: Context<AuthorityAction>, amount: u64) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.house.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;
        
        ctx.accounts.game.jackpot += amount;
        Ok(())
    }
}

fn generate_reels(player: &Pubkey, game: &Account<Game>) -> Result<[u8; 3]> {
    let slot = Clock::get()?.slot;
    let timestamp = Clock::get()?.unix_timestamp;
    
    let mut hash_input = Vec::new();
    hash_input.extend_from_slice(&player.to_bytes());
    hash_input.extend_from_slice(&slot.to_le_bytes());
    hash_input.extend_from_slice(&timestamp.to_le_bytes());
    hash_input.extend_from_slice(&game.total_spins.to_le_bytes());
    
    let hash = fnv_hash(&hash_input);
    
    // Weighted distribution for house edge
    // Lower symbols appear more frequently
    let reel1 = weighted_symbol((hash >> 0) & 0xFF);
    let reel2 = weighted_symbol((hash >> 8) & 0xFF);
    let reel3 = weighted_symbol((hash >> 16) & 0xFF);
    
    Ok([reel1, reel2, reel3])
}

fn weighted_symbol(random: u64) -> u8 {
    // Weighted distribution:
    // Cherry (0): 40% - Lowest payout
    // Lemon (1): 25%
    // Orange (2): 20%
    // Bar (3): 12%
    // Seven (4): 3% - Highest payout
    match random % 100 {
        0..=39 => 0,   // Cherry
        40..=64 => 1,  // Lemon
        65..=84 => 2,  // Orange
        85..=96 => 3,  // Bar
        _ => 4,        // Seven
    }
}

fn calculate_payout(reels: [u8; 3]) -> (bool, u64) {
    // 3 of a kind
    if reels[0] == reels[1] && reels[1] == reels[2] {
        return (true, PAYOUTS[reels[0] as usize]);
    }
    
    // Any 2 matching (small consolation)
    if reels[0] == reels[1] || reels[1] == reels[2] || reels[0] == reels[2] {
        return (true, 1); // 1x (break even)
    }
    
    (false, 0)
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
pub struct Spin<'info> {
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
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Game {
    pub house: Pubkey,
    pub authority: Pubkey,
    pub total_spins: u64,
    pub total_volume: u64,
    pub total_profit: i64,
    pub max_bet: u64,
    pub min_bet: u64,
    pub jackpot: u64,
    pub jackpot_contribution: u64, // basis points
    pub emergency_pause: bool,
}

impl Game {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[event]
pub struct SpinResult {
    pub player: Pubkey,
    pub reels: [u8; 3],
    pub bet_amount: u64,
    pub payout: u64,
    pub is_win: bool,
    pub is_jackpot: bool,
    pub jackpot_amount: u64,
}

#[error_code]
pub enum ErrorCode {
    GamePaused,
    BelowMinBet,
    AboveMaxBet,
    ExceedsHouseLimit,
    InsufficientHouseFunds,
    InvalidContribution,
    Unauthorized,
}