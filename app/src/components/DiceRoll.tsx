import { useState } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './DiceRoll.css';

export function DiceRoll() {
  const { connected, balance, loading, error, placeBet, result } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [prediction, setPrediction] = useState<'over' | 'under'>('over');
  const [target, setTarget] = useState(50);
  const [rolledNumber, setRolledNumber] = useState<number | null>(null);

  const roll = async () => {
    if (!connected) return;
    
    // Calculate win probability based on target
    const winProb = prediction === 'over' ? 100 - target : target;
    const multiplier = 98 / winProb; // 2% house edge
    
    try {
      const gameResult = await placeBet(bet, winProb, multiplier);
      
      // Generate dice roll (1-100)
      const roll = Math.floor(Math.random() * 100) + 1;
      setRolledNumber(roll);
      
      // Check if prediction was correct
      const predictedCorrectly = prediction === 'over' ? roll > target : roll < target;
      
      if (!predictedCorrectly && gameResult.win) {
        // This shouldn't happen with provably fair, but just in case
        gameResult.win = false;
        gameResult.amount = 0;
        gameResult.message = `Rolled ${roll}. ${prediction === 'over' ? 'Under' : 'Over'} ${target}!`;
      }
    } catch (err) {
      console.error('Roll failed:', err);
    }
  };

  return (
    <GameCard
      title="Dice Roll"
      icon="🎲"
      description="Predict over or under a target number"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={2}
    >
      <div className="dice-game">
        <div className="prediction-toggle">
          <button 
            className={prediction === 'under' ? 'active' : ''}
            onClick={() => setPrediction('under')}
          >
            Under {target}
          </button>
          <button 
            className={prediction === 'over' ? 'active' : ''}
            onClick={() => setPrediction('over')}
          >
            Over {target}
          </button>
        </div>

        <div className="target-slider">
          <input
            type="range"
            min="2"
            max="98"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
          <div className="target-display">Target: {target}</div>
        </div>

        <div className="multiplier-display">
          Multiplier: {((98 / (prediction === 'over' ? 100 - target : target))).toFixed(2)}x
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
          className="roll-btn"
          onClick={roll}
          disabled={!connected || loading || bet > balance}
        >
          {loading ? '🎲 Rolling...' : `🎲 Roll ${prediction.toUpperCase()} ${target}`}
        </button>

        {rolledNumber && (
          <div className={`roll-result ${result?.win ? 'win' : 'loss'}`}>
            <div className="dice-number">{rolledNumber}</div>
            <p>{result?.message}</p>
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
