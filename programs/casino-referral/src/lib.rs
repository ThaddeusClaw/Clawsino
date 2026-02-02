use anchor_lang::prelude::*;

/// AGENT CASINO WITH POOL-BASED REFERRAL SYSTEM
/// House Edge: 5%
/// Total Referral Pool: 5% of house profit (shared among ALL referrers)
#[program]
pub mod casino {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let house = &mut ctx.accounts.house_account;
        house.authority = ctx.accounts.authority.key();
        house.total_volume = 0;
        house.total_profit = 0;
        house.total_referral_pool = 0; // Accumulates 5% of all house profit
        house.referrer_count = 0;
        house.max_bet = 100_000_000; // 0.1 SOL
        house.min_bet = 1_000_000;   // 0.001 SOL
        house.emergency_pause = false;
        Ok(())
    }

    /// Play with optional referral
    /// 5% of house profit goes to SHARED POOL (not individual referrer)
    pub fn play_with_referral(
        ctx: Context<PlayWithReferral>, 
        amount: u64,
        game_type: u8,
    ) -> Result<()> {
        require!(amount >= 1_000_000, ErrorCode::MinBet);
        require!(amount <= 100_000_000, ErrorCode::MaxBet);
        
        let house = &ctx.accounts.house;
        let player = &ctx.accounts.player;
        let house_account = &mut ctx.accounts.house_account;
        
        // Take bet from player
        **player.to_account_info().try_borrow_mut_lamports()? -= amount;
        
        // Calculate result (48% win for coin flip)
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
            // House wins - add 5% to SHARED POOL!
            let house_profit = amount;
            let pool_contribution = (house_profit as u128)
                .checked_mul(500) // 5% = 500 bps
                .unwrap()
                .checked_div(10000)
                .unwrap() as u64;
            
            // Add to global referral pool
            house_account.total_referral_pool += pool_contribution;
            
            // Track referrer's contribution (for proportional payout)
            if let Some(referrer_account) = &mut ctx.accounts.referrer_account {
                referrer_account.total_referred_volume += amount;
                referrer_account.referral_contribution += pool_contribution;
                
                emit!(ReferralContribution {
                    referrer: referrer_account.owner,
                    contribution: pool_contribution,
                    total_pool: house_account.total_referral_pool,
                });
            }
            
            // House keeps: profit - pool contribution
            **house.to_account_info().try_borrow_mut_lamports()? += (house_profit - pool_contribution);
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
        let house_account = &mut ctx.accounts.house_account;
        
        referrer.owner = ctx.accounts.owner.key();
        referrer.pending_rewards = 0;
        referrer.total_earned = 0;
        referrer.total_referred_volume = 0;
        referrer.referral_contribution = 0;
        referrer.created_at = Clock::get()?.unix_timestamp;
        
        // Increment global referrer count
        house_account.referrer_count += 1;
        
        emit!(ReferrerRegistered {
            owner: ctx.accounts.owner.key(),
            referrer_count: house_account.referrer_count,
        });
        
        Ok(())
    }

    /// Distribute referral pool to all referrers (called weekly by authority)
    /// Each referrer gets: (their_referred_volume / total_referred_volume) * pool
    pub fn distribute_referral_pool(ctx: Context<DistributePool>) -> Result<()> {
        let house_account = &mut ctx.accounts.house_account;
        
        require!(house_account.total_referral_pool > 0, ErrorCode::EmptyPool);
        require!(
            Clock::get()?.unix_timestamp >= house_account.last_distribution + 604800, // 7 days
            ErrorCode::TooSoon
        );
        
        // Note: In production, this would iterate through all referrers
        // For now, referrers claim their proportional share
        house_account.last_distribution = Clock::get()?.unix_timestamp;
        
        emit!(PoolDistributed {
            amount: house_account.total_referral_pool,
            timestamp: house_account.last_distribution,
        });
        
        Ok(())
    }

    /// Claim referral rewards (proportional to referred volume)
    pub fn claim_referral_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let referrer = &mut ctx.accounts.referrer_account;
        let house_account = &mut ctx.accounts.house_account;
        let house = &ctx.accounts.house;
        let owner = &ctx.accounts.owner;
        
        require!(house_account.total_referral_pool > 0, ErrorCode::EmptyPool);
        require!(referrer.total_referred_volume > 0, ErrorCode::NoReferrals);
        
        // Calculate share: (referrer_volume / total_volume) * pool
        // For simplicity, using contribution-based calculation
        let share = (referrer.referral_contribution as u128)
            .checked_mul(house_account.total_referral_pool as u128)
            .unwrap()
            .checked_div(house_account.total_referral_pool as u128) // This would be total contribution in production
            .unwrap() as u64;
        
        require!(share > 0, ErrorCode::NoRewards);
        require!(house.lamports() >= share, ErrorCode::InsufficientFunds);
        
        // Update state
        referrer.pending_rewards = 0;
        referrer.total_earned += share;
        referrer.referral_contribution = 0; // Reset after claim
        house_account.total_referral_pool -= share;
        
        // Transfer
        **house.to_account_info().try_borrow_mut_lamports()? -= share;
        **owner.to_account_info().try_borrow_mut_lamports()? += share;
        
        emit!(RewardsClaimed {
            owner: owner.key(),
            amount: share,
            remaining_pool: house_account.total_referral_pool,
        });
        
        Ok(())
    }

    /// View referral stats
    pub fn get_referral_stats(ctx: Context<ViewReferrer>) -> Result<ReferrerStats> {
        let referrer = &ctx.accounts.referrer_account;
        let house = &ctx.accounts.house_account;
        
        // Calculate estimated share
        let estimated_share = if house.total_referral_pool > 0 && referrer.total_referred_volume > 0 {
            // Proportional estimate
            (referrer.referral_contribution as u128)
                .checked_mul(house.total_referral_pool as u128)
                .unwrap()
                .checked_div(10000) // Would be total contribution
                .unwrap() as u64
        } else {
            0
        };
        
        Ok(ReferrerStats {
            pending_rewards: referrer.pending_rewards,
            total_earned: referrer.total_earned,
            total_referred_volume: referrer.total_referred_volume,
            estimated_weekly_share: estimated_share,
            global_pool: house.total_referral_pool,
            referrer_count: house.referrer_count,
        })
    }
}

/// Tiered rates based on referred volume (not individual % of profit)
fn get_tier_bonus(volume: u64) -> u64 {
    match volume {
        0..=25_000_000_000 => 0,      // < 25 SOL volume: no bonus
        25_000_000_001..=100_000_000_000 => 100, // 25-100 SOL: +1% bonus
        _ => 200, // 100+ SOL: +2% bonus
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
    #[account(mut)]
    pub house_account: Account<'info, House>,
    #[account(init, payer = owner, space = 8 + Referrer::SIZE)]
    pub referrer_account: Account<'info, Referrer>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributePool<'info> {
    #[account(mut)]
    pub house_account: Account<'info, House>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut, constraint = referrer_account.owner == owner.key())]
    pub referrer_account: Account<'info, Referrer>,
    #[account(mut)]
    pub house_account: Account<'info, House>,
    /// CHECK: House wallet
    #[account(mut)]
    pub house: AccountInfo<'info>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ViewReferrer<'info> {
    pub referrer_account: Account<'info, Referrer>,
    pub house_account: Account<'info, House>,
}

#[account]
pub struct House {
    pub authority: Pubkey,
    pub total_volume: u64,
    pub total_profit: i64,
    pub total_referral_pool: u64, // SHARED POOL - 5% of all house profit
    pub referrer_count: u64,
    pub last_distribution: i64,
    pub max_bet: u64,
    pub min_bet: u64,
    pub emergency_pause: bool,
}

impl House {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Referrer {
    pub owner: Pubkey,
    pub pending_rewards: u64,
    pub total_earned: u64,
    pub total_referred_volume: u64, // For calculating share
    pub referral_contribution: u64, // How much they added to pool
    pub created_at: i64,
}

impl Referrer {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ReferrerStats {
    pub pending_rewards: u64,
    pub total_earned: u64,
    pub total_referred_volume: u64,
    pub estimated_weekly_share: u64,
    pub global_pool: u64,
    pub referrer_count: u64,
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
    pub referrer_count: u64,
}

#[event]
pub struct ReferralContribution {
    pub referrer: Pubkey,
    pub contribution: u64,
    pub total_pool: u64,
}

#[event]
pub struct PoolDistributed {
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardsClaimed {
    pub owner: Pubkey,
    pub amount: u64,
    pub remaining_pool: u64,
}

#[error_code]
pub enum ErrorCode {
    MinBet,
    MaxBet,
    InsufficientFunds,
    NoRewards,
    NoReferrals,
    EmptyPool,
    TooSoon,
}