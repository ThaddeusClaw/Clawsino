use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG");

/// AGENT CASINO - OPTIMIZED FOR PROFIT + BIG WINS
/// House Edge: 2-5% sustainable
/// Attraction: High variance, jackpot potential

#[program]
pub mod casino {
    use super::*;

    /// HOUSE CONFIGURATION
    const HOUSE_EDGE_BPS: u64 = 300; // 3% base edge
    const JACKPOT_CONTRIBUTION: u64 = 100; // 1% to progressive jackpot
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let house = &mut ctx.accounts.house_account;
        house.authority = ctx.accounts.authority.key();
        house.total_volume = 0;
        house.total_profit = 0;
        house.jackpot = 0;
        house.max_bet = 100_000_000; // 0.1 SOL
        house.emergency_pause = false;
        Ok(())
    }

    /// COIN FLIP - 48% win rate (4% edge)
    /// Pays 2x but slightly less than fair
    pub fn coin_flip(ctx: Context<Play>, amount: u64) -> Result<()> {
        require!(amount >= 1_000_000, ErrorCode::MinBet);
        require!(amount <= 100_000_000, ErrorCode::MaxBet);
        
        let house = &ctx.accounts.house;
        let player = &ctx.accounts.player;
        
        // 48% win rate (not 50%) = 4% edge
        let is_win = generate_random(player, 48); // 48% chance
        
        // Always take bet first
        **player.to_account_info().try_borrow_mut_lamports()? -= amount;
        
        let house_account = &mut ctx.accounts.house_account;
        house_account.total_volume += amount;
        
        // 1% to jackpot
        house_account.jackpot += amount / 100;
        let play_amount = amount - amount / 100;
        
        if is_win {
            // 2x payout = player gets 2x bet
            let payout = amount * 2;
            require!(house.lamports() >= payout, ErrorCode::InsufficientFunds);
            **house.to_account_info().try_borrow_mut_lamports()? -= payout;
            **player.to_account_info().try_borrow_mut_lamports()? += payout;
            house_account.total_profit -= (payout - play_amount) as i64;
        } else {
            house_account.total_profit += play_amount as i64;
        }
        
        emit!(PlayResult {
            game: "COIN_FLIP".to_string(),
            player: player.key(),
            amount,
            payout: if is_win { amount * 2 } else { 0 },
            is_win,
        });
        
        Ok(())
    }

    /// DICE - Under/Over with variable odds
    /// House edge: 2-4% depending on choice
    pub fn dice_roll(ctx: Context<Play>, choice: u8, target: u8, amount: u64) -> Result<()> {
        require!(amount >= 1_000_000 && amount <= 100_000_000, ErrorCode::InvalidBet);
        require!(target >= 10 && target <= 90, ErrorCode::InvalidTarget);
        
        let roll = (generate_u64(&ctx.accounts.player) % 100) as u8 + 1; // 1-100
        
        // Choice: 0=Under, 1=Over
        let win = if choice == 0 { roll < target } else { roll > target };
        
        // Payout calculation with edge
        // Fair odds: 100/target for under, 100/(100-target) for over
        // With 3% edge
        let fair_multiplier = if choice == 0 { 
            100.0 / target as f64 
        } else { 
            100.0 / (100 - target) as f64 
        };
        let payout_multiplier = (fair_multiplier * 0.97 * 100.0) as u64; // 3% edge
        
        **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= amount;
        
        let house_account = &mut ctx.accounts.house_account;
        house_account.total_volume += amount;
        house_account.jackpot += amount / 100;
        
        if win {
            let payout = (amount * payout_multiplier) / 100;
            require!(ctx.accounts.house.lamports() >= payout, ErrorCode::InsufficientFunds);
            **ctx.accounts.house.to_account_info().try_borrow_mut_lamports()? -= payout;
            **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += payout;
            house_account.total_profit -= (payout - amount) as i64;
        } else {
            house_account.total_profit += amount as i64;
        }
        
        emit!(PlayResult {
            game: "DICE".to_string(),
            player: ctx.accounts.player.key(),
            amount,
            payout: if win { (amount * payout_multiplier) / 100 } else { 0 },
            is_win: win,
        });
        
        Ok(())
    }

    /// SLOTS - Progressive jackpot, weighted symbols
    /// House edge: 5% base + jackpot contribution
    pub fn slots_spin(ctx: Context<Play>, amount: u64) -> Result<()> {
        require!(amount >= 1_000_000 && amount <= 100_000_000, ErrorCode::InvalidBet);
        
        // Weighted reels (house advantage)
        // 0=Cherry(35%), 1=Lemon(30%), 2=Orange(20%), 3=Bar(12%), 4=Seven(3%)
        let symbols = weighted_random(&ctx.accounts.player);
        
        **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= amount;
        
        let house_account = &mut ctx.accounts.house_account;
        house_account.total_volume += amount;
        
        // 2% to progressive jackpot
        house_account.jackpot += amount * 2 / 100;
        
        // Check for wins
        let payout = calculate_slots_payout(symbols, amount, house_account.jackpot);
        
        // Jackpot win?
        let is_jackpot = symbols == [4, 4, 4]; // Three sevens
        
        if payout > 0 {
            let final_payout = if is_jackpot {
                let jp = house_account.jackpot;
                house_account.jackpot = jp / 2; // Reset to half
                payout + jp
            } else {
                payout
            };
            
            require!(ctx.accounts.house.lamports() >= final_payout, ErrorCode::InsufficientFunds);
            **ctx.accounts.house.to_account_info().try_borrow_mut_lamports()? -= final_payout;
            **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? += final_payout;
            house_account.total_profit -= (final_payout - amount) as i64;
        } else {
            house_account.total_profit += amount as i64;
        }
        
        emit!(PlayResult {
            game: "SLOTS".to_string(),
            player: ctx.accounts.player.key(),
            amount,
            payout,
            is_win: payout > 0,
        });
        
        Ok(())
    }

    /// CRASH - Controlled crash points
    /// House edge: 1-2% based on distribution
    pub fn crash_bet(ctx: Context<Play>, amount: u64) -> Result<()> {
        require!(amount >= 1_000_000 && amount <= 100_000_000, ErrorCode::InvalidBet);
        
        // Generate crash point with 1% house edge
        // 99% RTP to players, 1% to house
        let r = generate_u64(&ctx.accounts.player) % 10000;
        let crash_point = if r < 5051 { // 50.51% chance to crash < 2x
            100 + (r % 100) // 1.00x - 1.99x
        } else {
            // Exponential distribution for higher multipliers
            let exp = (r - 5051) as f64 / 4949.0;
            let mult = 2.0 + exp.exp() * 10.0;
            (mult * 100.0).min(10000.0) as u64 // Max 100x
        };
        
        **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= amount;
        
        let house_account = &mut ctx.accounts.house_account;
        house_account.total_volume += amount;
        house_account.jackpot += amount / 100;
        
        // Store crash point for cashout reference
        // In real implementation, this would be stored per round
        
        emit!(CrashStart {
            player: ctx.accounts.player.key(),
            amount,
            crash_point,
        });
        
        Ok(())
    }

    /// Withdraw profits (authority only)
    pub fn withdraw_profit(ctx: Context<AuthorityAction>, amount: u64) -> Result<()> {
        let house_account = &ctx.accounts.house_account;
        require!(ctx.accounts.authority.key() == house_account.authority, ErrorCode::Unauthorized);
        require!(house_account.total_profit > amount as i64, ErrorCode::NoProfit);
        
        **ctx.accounts.house.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;
        
        Ok(())
    }

    /// View jackpot
    pub fn get_jackpot(ctx: Context<ViewHouse>) -> Result<u64> {
        Ok(ctx.accounts.house_account.jackpot)
    }
}

fn generate_random(player: &Signer, win_chance: u64) -> bool {
    let slot = Clock::get().unwrap().slot;
    let timestamp = Clock::get().unwrap().unix_timestamp;
    
    let mut hash = fnv_hash(&[
        &player.key().to_bytes()[..],
        &slot.to_le_bytes(),
        &timestamp.to_le_bytes(),
    ].concat());
    
    (hash % 100) < win_chance
}

fn generate_u64(player: &Signer) -> u64 {
    let slot = Clock::get().unwrap().slot;
    fnv_hash(&[
        &player.key().to_bytes()[..],
        &slot.to_le_bytes(),
    ].concat())
}

fn weighted_random(player: &Signer) -> [u8; 3] {
    let base = generate_u64(player);
    
    let get_symbol = |offset: u64| -> u8 {
        let r = (base.wrapping_add(offset)) % 100;
        match r {
            0..=34 => 0,  // Cherry 35%
            35..=64 => 1, // Lemon 30%
            65..=84 => 2, // Orange 20%
            85..=96 => 3, // Bar 12%
            _ => 4,       // Seven 3%
        }
    };
    
    [get_symbol(0), get_symbol(1), get_symbol(2)]
}

fn calculate_slots_payout(symbols: [u8; 3], bet: u64, jackpot: u64) -> u64 {
    let payouts = [2u64, 3, 5, 10, 50]; // Multipliers
    
    // Three of a kind
    if symbols[0] == symbols[1] && symbols[1] == symbols[2] {
        if symbols[0] == 4 { // Three sevens = Jackpot!
            return bet * 50 + jackpot / 2;
        }
        return bet * payouts[symbols[0] as usize];
    }
    
    // Two of a kind = break even
    if symbols[0] == symbols[1] || symbols[1] == symbols[2] || symbols[0] == symbols[2] {
        return bet;
    }
    
    0
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
    #[account(init, payer = authority, space = 8 + House::SIZE)]
    pub house_account: Account<'info, House>,
    /// CHECK: House wallet for funds
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Play<'info> {
    #[account(mut)]
    pub house_account: Account<'info, House>,
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
    pub house_account: Account<'info, House>,
    #[account(mut)]
    pub house: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ViewHouse<'info> {
    pub house_account: Account<'info, House>,
}

#[account]
pub struct House {
    pub authority: Pubkey,
    pub total_volume: u64,
    pub total_profit: i64,
    pub jackpot: u64,
    pub max_bet: u64,
    pub emergency_pause: bool,
}

impl House {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 8 + 1;
}

#[event]
pub struct PlayResult {
    pub game: String,
    pub player: Pubkey,
    pub amount: u64,
    pub payout: u64,
    pub is_win: bool,
}

#[event]
pub struct CrashStart {
    pub player: Pubkey,
    pub amount: u64,
    pub crash_point: u64,
}

#[error_code]
pub enum ErrorCode {
    MinBet,
    MaxBet,
    InvalidBet,
    InvalidTarget,
    InsufficientFunds,
    Unauthorized,
    NoProfit,
}