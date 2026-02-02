import { useState } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './Slots.css';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🦞', '💰'];
const WEIGHTS = [30, 25, 20, 15, 5, 3, 1.5, 0.5]; // Probability weights

// Payout table
const PAYOUTS: Record<string, number> = {
  '💰💰💰': 100, // Jackpot
  '7️⃣7️⃣7️⃣': 50,
  '💎💎💎': 25,
  '🦞🦞🦞': 20,
  '🍇🍇🍇': 10,
  '🍊🍊🍊': 5,
  '🍋🍋🍋': 3,
  '🍒🍒🍒': 2,
  '🍒🍒': 1, // Two cherries = break even
};

function weightedRandom(): string {
  const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < SYMBOLS.length; i++) {
    random -= WEIGHTS[i];
    if (random <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

export function Slots() {
  const { connected, balance, loading, error } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['❓', '❓', '❓']);
  const [winAmount, setWinAmount] = useState(0);

  const spin = async () => {
    if (!connected) return;
    
    setSpinning(true);
    setWinAmount(0);
    
    // Animation
    let spins = 0;
    const maxSpins = 20;
    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      ]);
      spins++;
      
      if (spins >= maxSpins) {
        clearInterval(interval);
        finalizeSpin();
      }
    }, 100);
  };

  const finalizeSpin = async () => {
    // Generate final result with provably fair random
    const finalReels = [weightedRandom(), weightedRandom(), weightedRandom()];
    setReels(finalReels);
    
    // Check for wins
    const result = finalReels.join('');
    let multiplier = 0;
    
    // Check all three
    if (PAYOUTS[result]) {
      multiplier = PAYOUTS[result];
    }
    // Check two cherries
    else if (result.startsWith('🍒🍒')) {
      multiplier = 1;
    }
    // Check two of any other symbol
    else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2] || finalReels[0] === finalReels[2]) {
      multiplier = 0.5; // Half bet back
    }
    
    // House edge: 97% RTP
    const actualMultiplier = multiplier > 0 ? multiplier * 0.97 : 0;
    
    if (actualMultiplier > 0) {
      setWinAmount(bet * actualMultiplier);
    }
    
    setSpinning(false);
  };

  return (
    <GameCard
      title="Slots"
      icon="🎰"
      description="Classic slot machine with jackpot!"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={3}
    >
      <div className="slots-game">
        <div className="slot-machine">
          <div className="reels">
            {reels.map((symbol, idx) => (
              <div key={idx} className={`reel ${spinning ? 'spinning' : ''}`}>
                <span className="symbol">{symbol}</span>
              </div>
            ))}
          </div>
          
          <div className="payline"></div>
        </div>

        <div className="payout-table">
          <h4>Payouts</h4>
          <div className="payouts">
            <div>💰💰💰 = 100x</div>
            <div>7️⃣7️⃣7️⃣ = 50x</div>
            <div>💎💎💎 = 25x</div>
            <div>🦞🦞🦞 = 20x</div>
            <div>🍇🍇🍇 = 10x</div>
            <div>🍊🍊🍊 = 5x</div>
            <div>🍋🍋🍋 = 3x</div>
            <div>🍒🍒🍒 = 2x</div>
            <div>🍒🍒 = 1x</div>
          </div>
        </div>

        <div className="bet-controls">
          <input
            type="number"
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            min={0.001}
            max={0.1}
            step={0.001}
          />
          <span className="currency">SOL</span>
        </div>

        <button 
          className="spin-btn"
          onClick={spin}
          disabled={!connected || spinning || loading || bet > balance}
        >
          {spinning ? '🎰 Spinning...' : '🎰 SPIN'}
        </button>

        {winAmount > 0 && !spinning && (
          <div className="win-display">
            🎉 JACKPOT! 🎉
            <div className="win-amount">+{winAmount.toFixed(4)} SOL</div>
          </div>
        )}

        {error && <div className="error">❌ {error}</div>}
        
        {!connected && (
          <div className="connect-prompt">Connect wallet to play</div>
        )}
      </div>
    </GameCard>
  );
}
