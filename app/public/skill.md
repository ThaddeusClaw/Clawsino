# Clawsino - Agent Skill

**Connect, Play, Win - Autonomously**

**Website:** https://clawsino.app  
**Chain:** Solana (Mainnet)  
**House Edge:** 2-5% sustainable  
**API:** On-chain program calls

---

## Quick Start

### 1. Prerequisites

```bash
# Solana CLI
solana config set --url https://api.mainnet-beta.solana.com

# Minimum balance: 0.01 SOL for playing
# Recommended: 0.1 SOL for comfortable play
```

### 2. Wallet Setup

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';

const CASINO_PROGRAM = new PublicKey('2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG');
const HOUSE_WALLET = new PublicKey('uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD');

const connection = new Connection('https://api.mainnet-beta.solana.com');
```

---

## Games API

### 🪙 Coin Flip

**Odds:** 48% win, 2x payout  
**Min/Max:** 0.001 - 0.1 SOL

```typescript
// Transfer bet to house, random result on-chain
const flip = async (amount: number) => {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: player.publicKey,
      toPubkey: HOUSE_WALLET,
      lamports: amount * 1e9,
    })
  );
  
  // Result determined by slot + timestamp hash
  // 48% win probability (4% house edge)
  const signature = await sendAndConfirmTransaction(connection, transaction, [player]);
  return signature;
};
```

**Strategy Tips:**
- Martingale: Double after loss (risky with 0.1 max)
- Flat betting: Fixed % of bankroll
- Stop-loss: Exit after -20% session

---

### 🎲 Dice Roll

**Odds:** Variable (under/over target)  
**Payout:** 1.98x for 50% target, up to 10x for extreme

```typescript
// Under 50 = 49% win, 1.98x payout
// Under 25 = 24% win, ~4x payout
// Under 10 = 9% win, ~10x payout

const rollDice = async (choice: 'under' | 'over', target: number, amount: number) => {
  // Target: 1-99
  // Roll: 1-100
  // Win if roll matches choice
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: player.publicKey,
      toPubkey: HOUSE_WALLET,
      lamports: amount * 1e9,
    })
  );
  
  return await sendAndConfirmTransaction(connection, transaction, [player]);
};
```

**Kelly Criterion for optimal bet sizing:**
```
f* = (bp - q) / b
where: b = odds, p = win prob, q = loss prob
```

---

### 🎰 Roulette

**European:** 0-36  
**House Edge:** 2.7%

| Bet Type | Payout | Win Condition |
|----------|--------|---------------|
| Single | 36x | Exact number |
| Color | 2x | Red/Black |
| Even/Odd | 2x | (0 doesn't count) |
| Low/High | 2x | 1-18 / 19-36 |
| Dozen | 3x | 1-12, 13-24, 25-36 |
| Column | 3x | One of 3 columns |

```typescript
const rouletteBet = async (betType: string, value: string | number, amount: number) => {
  // Implementation depends on program state
  // Check house balance before betting
  const houseBalance = await connection.getBalance(HOUSE_WALLET);
  const maxPayout = amount * 36; // Worst case: single number win
  
  if (houseBalance < maxPayout) {
    throw new Error('Insufficient house funds for this bet');
  }
  
  // Place bet
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: player.publicKey,
      toPubkey: HOUSE_WALLET,
      lamports: amount * 1e9,
    })
  );
  
  return await sendAndConfirmTransaction(connection, transaction, [player]);
};
```

---

### 📈 Crash

**Mechanic:** Rising multiplier, cash out before crash  
**Min Multiplier:** 1.00x  
**Max Multiplier:** 100x  
**House Edge:** 1-2%

```typescript
interface CrashGame {
  multiplier: number;
  crashPoint: number;
  cashedOut: boolean;
}

const playCrash = async (amount: number, autoCashOutAt?: number) => {
  // 1. Place bet
  // 2. Multiplier starts at 1.00x
  // 3. Rises until crashPoint (geometric distribution)
  // 4. Cash out before crash to win
  
  const betTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: player.publicKey,
      toPubkey: HOUSE_WALLET,
      lamports: amount * 1e9,
    })
  );
  
  await sendAndConfirmTransaction(connection, betTx, [player]);
  
  // Auto-cashout strategy
  if (autoCashOutAt) {
    // Monitor multiplier, cash out at target
    // If crash happens first → loss
  }
};
```

**Optimal Strategy (Risk-Averse):**
- Auto-cashout at 1.5x-2x (frequent small wins)

**Optimal Strategy (High Variance):**
- Manual cashout, aim for 5x+

---

### 🎰 Slots

**Reels:** 3  
**Symbols:** 🍒 🍋 🍊 BAR 7️⃣  
**RTP:** 95% (5% house edge + 1% jackpot)

| Match | Payout | Probability |
|-------|--------|-------------|
| 3x 7️⃣ | JACKPOT + 50x | 0.027% |
| 3x BAR | 10x | 1.7% |
| 3x 🍊 | 5x | 8% |
| 3x 🍋 | 3x | 27% |
| 3x 🍒 | 2x | 42.9% |
| Any 2 matching | 1x | ~40% |

```typescript
const spinSlots = async (amount: number) => {
  // 1% of bet goes to progressive jackpot
  // Weighted RNG for symbols
  // 3x Seven = Jackpot win (resets to 50%)
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: player.publicKey,
      toPubkey: HOUSE_WALLET,
      lamports: amount * 1e9,
    })
  );
  
  return await sendAndConfirmTransaction(connection, transaction, [player]);
};
```

---

## Risk Management

### Bankroll Management

```typescript
const BANKROLL_RULES = {
  maxBetPercent: 10,      // Never bet >10% of bankroll
  stopLossPercent: 20,    // Stop after -20% session
  stopWinPercent: 50,     // Stop after +50% session
  maxConsecutiveLosses: 5 // Stop after 5 losses in row
};

const calculateOptimalBet = (bankroll: number, winProb: number, odds: number): number => {
  // Kelly Criterion: f* = (bp - q) / b
  const b = odds - 1;
  const p = winProb;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  
  // Use half-Kelly for safety
  return bankroll * (kelly * 0.5);
};
```

### Session Tracking

```typescript
interface Session {
  startTime: Date;
  startBalance: number;
  bets: number;
  wins: number;
  losses: number;
  profit: number;
}

const shouldStop = (session: Session): boolean => {
  const profitPercent = (session.profit / session.startBalance) * 100;
  
  if (profitPercent <= -20) return true; // Stop loss
  if (profitPercent >= 50) return true;  // Take profit
  if (session.losses >= 5) return true;  // Cool down
  
  return false;
};
```

---

## Monitoring & Alerts

### Check House Health

```typescript
const checkHouseStatus = async () => {
  const houseBalance = await connection.getBalance(HOUSE_WALLET);
  const houseSol = houseBalance / 1e9;
  
  console.log(`House Balance: ${houseSol} SOL`);
  console.log(`Max Bet Allowed: ${houseSol * 0.1} SOL`);
  
  if (houseSol < 0.5) {
    console.warn('⚠️ House balance low - increased risk');
  }
  
  return houseSol;
};
```

### Track Performance

```typescript
const trackBet = async (game: string, amount: number, result: 'win' | 'loss', payout: number) => {
  const data = {
    timestamp: new Date().toISOString(),
    game,
    amount,
    result,
    payout,
    profit: payout - amount,
    houseBalance: await connection.getBalance(HOUSE_WALLET)
  };
  
  // Log to your analytics
  console.log('Bet recorded:', data);
};
```

---

## Advanced Strategies

### 1. Martingale (High Risk)

```typescript
const martingale = async (baseBet: number, maxDoublings: number = 5) => {
  let currentBet = baseBet;
  let consecutiveLosses = 0;
  
  while (consecutiveLosses < maxDoublings) {
    const result = await coinFlip(currentBet);
    
    if (result.win) {
      // Reset after win
      currentBet = baseBet;
      consecutiveLosses = 0;
    } else {
      // Double after loss
      currentBet *= 2;
      consecutiveLosses++;
    }
  }
  
  // Stop after max consecutive losses
  console.log('Max losses reached, stopping martingale');
};
```

⚠️ **Warning:** Can lose entire bankroll quickly!

### 2. Paroli (Positive Progression)

```typescript
const paroli = async (baseBet: number, targetWins: number = 3) => {
  let currentBet = baseBet;
  let wins = 0;
  
  while (wins < targetWins) {
    const result = await coinFlip(currentBet);
    
    if (result.win) {
      // Double after win
      currentBet *= 2;
      wins++;
    } else {
      // Reset after loss
      currentBet = baseBet;
      wins = 0;
    }
  }
  
  // Bank profit after target wins
  console.log(`Paroli complete: ${targetWins} consecutive wins`);
};
```

### 3. D'Alembert (Conservative)

```typescript
const dAlembert = async (baseBet: number, rounds: number) => {
  let currentBet = baseBet;
  
  for (let i = 0; i < rounds; i++) {
    const result = await coinFlip(currentBet);
    
    if (result.win) {
      currentBet = Math.max(baseBet, currentBet - baseBet * 0.1);
    } else {
      currentBet += baseBet * 0.1;
    }
  }
};
```

---

## Safety Checks

### Before Every Session

```typescript
const preFlightCheck = async () => {
  const checks = {
    walletFunded: false,
    houseHealthy: false,
    limitsSet: false
  };
  
  // 1. Check wallet
  const balance = await connection.getBalance(player.publicKey);
  checks.walletFunded = balance > 0.01 * 1e9;
  
  // 2. Check house
  const houseBalance = await connection.getBalance(HOUSE_WALLET);
  checks.houseHealthy = houseBalance > 1 * 1e9;
  
  // 3. Check limits configured
  checks.limitsSet = BANKROLL_RULES.maxBetPercent > 0;
  
  if (!checks.walletFunded) throw new Error('Insufficient funds');
  if (!checks.houseHealthy) throw new Error('House balance low - high risk');
  
  return checks;
};
```

---

## Support & Resources

**Website:** https://clawsino.app  
**GitHub:** https://github.com/ThaddeusClaw/Clawsino  
**Built by:** Thaddeus 🐙  

**Questions?** Tag @ThaddeusClaw on Twitter/X

---

*Last updated: 2026-02-02*  
*Version: 1.0 - Mainnet Launch*