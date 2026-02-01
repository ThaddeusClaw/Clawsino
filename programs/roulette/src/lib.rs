use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Roul8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8");

/// European Roulette: 0-36 (37 numbers)
/// House edge: 2.7% (single zero)
#[program]
pub mod roulette {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.house = ctx.accounts.house.key();
        game.authority = ctx.accounts.authority.key();
        game.total_spins = 0;
        game.total_volume = 0;
        game.total_profit = 0;
        game.max_bet = 100_000_000; // 0.1 SOL
        game.min_bet = 1_000_000;   // 0.001 SOL
        game.emergency_pause = false;
        Ok(())
    }

    /// Bet on a specific number (0-36) - Pays 35:1
    pub fn bet_number(ctx: Context<Bet>, number: u8, amount: u64) -> Result<()> {
        require!(number <= 36, ErrorCode::InvalidNumber);
        require_bets(&ctx, amount)?;
        
        let roll = generate_roll(&ctx.accounts.player, &ctx.accounts.game)?;
        let is_win = roll == number;
        let payout = if is_win { amount * 36 } else { 0 }; // 35:1 + original bet
        
        settle_bet(ctx, amount, payout, is_win, roll, "NUMBER")
    }

    /// Bet on color: 0=Red, 1=Black, 2=Green(0) - Pays 1:1 (or 35:1 for green)
    pub fn bet_color(ctx: Context<Bet>, color: u8, amount: u64) -> Result<()> {
        require!(color <= 2, ErrorCode::InvalidColor);
        require_bets(&ctx, amount)?;
        
        let roll = generate_roll(&ctx.accounts.player, &ctx.accounts.game)?;
        let roll_color = get_color(roll);
        let is_win = roll_color == color;
        let payout = if is_win && color == 2 { amount * 36 } else if is_win { amount * 2 } else { 0 };
        
        settle_bet(ctx, amount, payout, is_win, roll, "COLOR")
    }

    /// Bet on even/odd (0 doesn't count) - Pays 1:1
    pub fn bet_even_odd(ctx: Context<Bet>, is_even: bool, amount: u64) -> Result<()> {
        require_bets(&ctx, amount)?;
        
        let roll = generate_roll(&ctx.accounts.player, &ctx.accounts.game)?;
        let roll_even = roll != 0 && roll % 2 == 0;
        let is_win = roll != 0 && roll_even == is_even;
        let payout = if is_win { amount * 2 } else { 0 };
        
        settle_bet(ctx, amount, payout, is_win, roll, "EVEN_ODD")
    }

    /// Bet on low (1-18) or high (19-36) - Pays 1:1
    pub fn bet_low_high(ctx: Context<Bet>, is_low: bool, amount: u64) -> Result<()> {
        require_bets(&ctx, amount)?;
        
        let roll = generate_roll(&ctx.accounts.player, &ctx.accounts.game)?;
        let is_win = if is_low { roll >= 1 && roll <= 18 } else { roll >= 19 && roll <= 36 };
        let payout = if is_win { amount * 2 } else { 0 };
        
        settle_bet(ctx, amount, payout, is_win, roll, "LOW_HIGH")
    }

    /// Bet on dozen: 0=1-12, 1=13-24, 2=25-36 - Pays 2:1
    pub fn bet_dozen(ctx: Context<Bet>, dozen: u8, amount: u64) -> Result<()> {
        require!(dozen <= 2, ErrorCode::InvalidDozen);
        require_bets(&ctx, amount)?;
        
        let roll = generate_roll(&ctx.accounts.player, &ctx.accounts.game)?;
        let roll_dozen = if roll == 0 { 255 } else { (roll - 1) / 12 };
        let is_win = roll_dozen == dozen;
        let payout = if is_win { amount * 3 } else { 0 };
        
        settle_bet(ctx, amount, payout, is_win, roll, "DOZEN")
    }

    /// Bet on column - Pays 2:1
    pub fn bet_column(ctx: Context<Bet>, column: u8, amount: u64) -> Result<()> {
        require!(column < 3, ErrorCode::InvalidColumn);
        require_bets(&ctx, amount)?;
        
        let roll = generate_roll(&ctx.accounts.player, &ctx.accounts.game)?;
        let roll_column = if roll == 0 { 255 } else { (roll - 1) % 3 };
        let is_win = roll_column == column;
        let payout = if is_win { amount * 3 } else { 0 };
        
        settle_bet(ctx, amount, payout, is_win, roll, "COLUMN")
    }

    /// Update max bet (authority only)
    pub fn update_max_bet(ctx: Context<AuthorityAction>, new_max: u64) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        ctx.accounts.game.max_bet = new_max;
        Ok(())
    }

    /// Toggle pause (authority only)
    pub fn toggle_pause(ctx: Context<AuthorityAction>) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.game.authority, ErrorCode::Unauthorized);
        ctx.accounts.game.emergency_pause = !ctx.accounts.game.emergency_pause;
        Ok(())
    }
}

fn require_bets(ctx: &Context<Bet>, amount: u64) -> Result<()> {
    let game = &ctx.accounts.game;
    let house = &ctx.accounts.house;
    
    require!(!game.emergency_pause, ErrorCode::GamePaused);
    require!(amount >= game.min_bet, ErrorCode::BelowMinBet);
    require!(amount <= game.max_bet, ErrorCode::AboveMaxBet);
    require!(amount <= house.lamports() / 10, ErrorCode::ExceedsHouseLimit);
    Ok(())
}

fn generate_roll(player: &Pubkey, game: &Account<Game>) -> Result<u8> {
    let slot = Clock::get()?.slot;
    let timestamp = Clock::get()?.unix_timestamp;
    
    let mut hash_input = Vec::new();
    hash_input.extend_from_slice(&player.to_bytes());
    hash_input.extend_from_slice(&slot.to_le_bytes());
    hash_input.extend_from_slice(&timestamp.to_le_bytes());
    hash_input.extend_from_slice(&game.total_spins.to_le_bytes());
    
    let hash = fnv_hash(&hash_input);
    Ok((hash % 37) as u8) // 0-36
}

fn get_color(number: u8) -> u8 {
    if number == 0 { return 2; } // Green
    let reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    if reds.contains(&number) { 0 } else { 1 } // 0=Red, 1=Black
}

fn fnv_hash(input: &[u8]) -> u64 {
    let mut hash: u64 = 14695981039346656037;
    for byte in input {
        hash = hash.wrapping_mul(1099511628211);
        hash ^= *byte as u64;
    }
    hash
}

fn settle_bet(
    ctx: Context<Bet>,
    amount: u64,
    payout: u64,
    is_win: bool,
    roll: u8,
    bet_type: &str,
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let house = &ctx.accounts.house;
    let player = &ctx.accounts.player;
    
    // Player pays bet
    **player.to_account_info().try_borrow_mut_lamports()? -= amount;
    **house.to_account_info().try_borrow_mut_lamports()? += amount;
    
    game.total_spins += 1;
    game.total_volume += amount;
    
    if is_win && payout > 0 {
        require!(house.lamports() >= payout, ErrorCode::InsufficientHouseFunds);
        **house.to_account_info().try_borrow_mut_lamports()? -= payout;
        **player.to_account_info().try_borrow_mut_lamports()? += payout;
        game.total_profit -= (payout - amount) as i64;
    } else {
        game.total_profit += amount as i64;
    }
    
    emit!(SpinResult {
        player: player.key(),
        roll,
        bet_amount: amount,
        payout,
        is_win,
        bet_type: bet_type.to_string(),
    });
    
    Ok(())
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
pub struct Bet<'info> {
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
    pub authority: Signer<'info>,
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
    pub emergency_pause: bool,
}

impl Game {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[event]
pub struct SpinResult {
    pub player: Pubkey,
    pub roll: u8,
    pub bet_amount: u64,
    pub payout: u64,
    pub is_win: bool,
    pub bet_type: String,
}

#[error_code]
pub enum ErrorCode {
    InvalidNumber,
    InvalidColor,
    InvalidDozen,
    InvalidColumn,
    GamePaused,
    BelowMinBet,
    AboveMaxBet,
    ExceedsHouseLimit,
    InsufficientHouseFunds,
    Unauthorized,
}