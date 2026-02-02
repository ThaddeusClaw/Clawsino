use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG");

/// AGENT CASINO WITH REFERRAL SYSTEM
/// House Edge: 5%
/// Referral Share: 5% of house edge (0.25% of total volume)
#[program]
pub mod casino {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let house = &mut ctx.accounts.house_account;
        house.authority = ctx.accounts.authority.key();
        house.total_volume = 0;
        house.total_profit = 0;
        house.referral_share_bps = 500; // 5% of house profit = 0.25% of volume
        house.max_bet = 100_000_000; // 0.1 SOL
        house.min_bet = 1_000_000;   // 0.001 SOL
        house.emergency_pause = false;
        Ok(())
    }

    /// Play with optional referral
    /// If referrer is provided, they earn 5% of house profit
    pub fn play_with_referral(
        ctx: Context<PlayWithReferral>, 
        amount: u64,
        game_type: u8, // 0=CoinFlip, 1=Dice, 2=Slots, etc.
    ) -> Result<()> {
        require!(amount >= 1_000_000, ErrorCode::MinBet);
        require!(amount <= 100_000_000, ErrorCode::MaxBet);
        
        let house = &ctx.accounts.house;
        let player = &ctx.accounts.player;
        let house_account = &mut ctx.accounts.house_account;
        
        // Take bet from player
        **player.to_account_info().try_borrow_mut_lamports()? -= amount;
        
        // Calculate result (simplified - 48% win for coin flip)
        let is_win = generate_win(player, 48);
        
        house_account.total_volume += amount;
        
        if is_win {
            // Player wins 2x
            let payout = amount * 2;
            require!(house.lamports() >= payout, ErrorCode::InsufficientFunds);
            **house.to_account_info().try_borrow_mut_lamports()? -= payout;
            **player.to_account_info().try_borrow_mut_lamports()? += payout;
            house_account.total_profit -= amount as i64;
        } else {
            // House wins - calculate referral share!
            let house_profit = amount;
            
            // 5% of house profit goes to referrer (if exists)
            if let Some(referrer_account) = &mut ctx.accounts.referrer_account {
                let referral_share = (house_profit as u128)
                    .checked_mul(house_account.referral_share_bps as u128)
                    .unwrap()
                    .checked_div(10000)
                    .unwrap() as u64;
                
                // Track referral earnings (paid out on claim)
                referrer_account.pending_rewards += referral_share;
                referrer_account.total_earned += referral_share;
                referrer_account.referred_players += 1;
                referrer_account.total_volume += amount;
                
                // House keeps rest
                **house.to_account_info().try_borrow_mut_lamports()? += (house_profit - referral_share);
            } else {
                // No referrer - house keeps all
                **house.to_account_info().try_borrow_mut_lamports()? += house_profit;
            }
            
            house_account.total_profit += house_profit as i64;
        }
        
        emit!(PlayResult {
            player: player.key(),
            amount,
            is_win,
            referrer: ctx.accounts.referrer.as_ref().map(|r| r.key()),
        });
        
        Ok(())
    }

    /// Register as referrer (one-time)
    pub fn register_referrer(ctx: Context<RegisterReferrer>) -> Result<()> {
        let referrer = &mut ctx.accounts.referrer_account;
        referrer.owner = ctx.accounts.owner.key();
        referrer.pending_rewards = 0;
        referrer.total_earned = 0;
        referrer.referred_players = 0;
        referrer.total_volume = 0;
        referrer.created_at = Clock::get()?.unix_timestamp;
        
        emit!(ReferrerRegistered {
            owner: ctx.accounts.owner.key(),
        });
        
        Ok(())
    }

    /// Claim referral rewards
    pub fn claim_referral_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let referrer = &mut ctx.accounts.referrer_account;
        let house = &ctx.accounts.house;
        let owner = &ctx.accounts.owner;
        
        require!(referrer.pending_rewards > 0, ErrorCode::NoRewards);
        require!(house.lamports() >= referrer.pending_rewards, ErrorCode::InsufficientFunds);
        
        let amount = referrer.pending_rewards;
        referrer.pending_rewards = 0;
        
        **house.to_account_info().try_borrow_mut_lamports()? -= amount;
        **owner.to_account_info().try_borrow_mut_lamports()? += amount;
        
        emit!(RewardsClaimed {
            owner: owner.key(),
            amount,
        });
        
        Ok(())
    }

    /// View referral stats
    pub fn get_referral_stats(ctx: Context<ViewReferrer>) -> Result<ReferrerStats> {
        let referrer = &ctx.accounts.referrer_account;
        Ok(ReferrerStats {
            pending_rewards: referrer.pending_rewards,
            total_earned: referrer.total_earned,
            referred_players: referrer.referred_players,
            total_volume: referrer.total_volume,
        })
    }
}

fn generate_win(player: &Signer, win_chance: u64) -> bool {
    let slot = Clock::get().unwrap().slot;
    let timestamp = Clock::get().unwrap().unix_timestamp;
    
    let mut hash = fnv_hash(&[
        &player.key().to_bytes()[..],
        &slot.to_le_bytes(),
        &timestamp.to_le_bytes(),
    ].concat());
    
    (hash % 100) < win_chance
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
    /// CHECK: House wallet
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlayWithReferral<'info> {
    #[account(mut)]
    pub house_account: Account<'info, House>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    /// CHECK: Optional referrer wallet
    pub referrer: Option<AccountInfo<'info>>,
    #[account(mut, constraint = referrer_account.owner == referrer.as_ref().unwrap().key())]
    pub referrer_account: Option<Account<'info, Referrer>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterReferrer<'info> {
    #[account(init, payer = owner, space = 8 + Referrer::SIZE)]
    pub referrer_account: Account<'info, Referrer>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut, constraint = referrer_account.owner == owner.key())]
    pub referrer_account: Account<'info, Referrer>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ViewReferrer<'info> {
    pub referrer_account: Account<'info, Referrer>,
}

#[account]
pub struct House {
    pub authority: Pubkey,
    pub total_volume: u64,
    pub total_profit: i64,
    pub referral_share_bps: u64, // 500 = 5%
    pub max_bet: u64,
    pub min_bet: u64,
    pub emergency_pause: bool,
}

impl House {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Referrer {
    pub owner: Pubkey,
    pub pending_rewards: u64,
    pub total_earned: u64,
    pub referred_players: u64,
    pub total_volume: u64,
    pub created_at: i64,
}

impl Referrer {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ReferrerStats {
    pub pending_rewards: u64,
    pub total_earned: u64,
    pub referred_players: u64,
    pub total_volume: u64,
}

#[event]
pub struct PlayResult {
    pub player: Pubkey,
    pub amount: u64,
    pub is_win: bool,
    pub referrer: Option<Pubkey>,
}

#[event]
pub struct ReferrerRegistered {
    pub owner: Pubkey,
}

#[event]
pub struct RewardsClaimed {
    pub owner: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum ErrorCode {
    MinBet,
    MaxBet,
    InsufficientFunds,
    NoRewards,
}