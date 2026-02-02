import { useState } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './Limbo.css';

export function Limbo() {
  const { connected, balance, loading, error } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [targetMultiplier, setTargetMultiplier] = useState(2.0);
  const [result, setResult] = useState<{ actual: number; win: boolean; payout: number } | null>(null);
  const [rolling, setRolling] = useState(false);

  const roll = async () => {
    if (!connected) return;
    
    setRolling(true);
    setResult(null);
    
    // Win probability: 99 / targetMultiplier (1% house edge)
    
    // Generate random result (0.01 to 100.00)
    const actualMultiplier = Math.pow(Math.random(), 2) * 100 + 0.01;
    const isWin = actualMultiplier >= targetMultiplier;
    
    // Animate rolling
    let displayValue = 1.00;
    const interval = setInterval(() => {
      displayValue += Math.random() * 2;
      if (displayValue >= actualMultiplier) {
        clearInterval(interval);
        
        const payout = isWin ? bet * targetMultiplier * 0.99 : 0; // 1% house edge
        setResult({
          actual: actualMultiplier,
          win: isWin,
          payout
        });
        setRolling(false);
      }
    }, 50);
  };

  return (
    <GameCard
      title="Limbo"
      icon="🎯"
      description="Roll over your target multiplier!"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={1}
    >
      <div className="limbo-game">
        <div className={`limbo-display ${rolling ? 'rolling' : ''} ${result?.win ? 'win' : result ? 'loss' : ''}`}>
          {rolling ? (
            <span className="rolling-number">{Math.random() > 0.5 ? (Math.random() * 10).toFixed(2) : (Math.random() * 100).toFixed(2)}x</span>
          ) : result ? (
            <span className={`result-number ${result.win ? 'win' : 'loss'}`}>
              {result.actual.toFixed(2)}x
            </span>
          ) : (
            <span className="waiting">?</span>
          )}
        </div>

        <div className="target-section">
          <label>Target Multiplier</label>
          <div className="target-buttons">
            {[1.1, 1.5, 2, 3, 5, 10].map((mult) => (
              <button
                key={mult}
                className={targetMultiplier === mult ? 'active' : ''}
                onClick={() => setTargetMultiplier(mult)}
              >
                {mult}x
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1.01"
            max="100"
            step="0.01"
            value={targetMultiplier}
            onChange={(e) => setTargetMultiplier(Number(e.target.value))}
          />
          <div className="target-value">{targetMultiplier.toFixed(2)}x</div>
        </div>

        <div className="probability-display">
          Win Probability: {(99 / targetMultiplier).toFixed(2)}%
          <br />
          Payout: {(targetMultiplier * 0.99).toFixed(2)}x
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
          disabled={!connected || rolling || loading || bet > balance}
        >
          {rolling ? '🎯 Rolling...' : '🎯 Roll Limbo'}
        </button>

        {result && (
          <div className={`limbo-result ${result.win ? 'win' : 'loss'}`}>
            <h3>{result.win ? '🎉 Over Target!' : '💨 Under Target'}</h3>
            <p>Rolled: {result.actual.toFixed(2)}x</p>
            <p>Target: {targetMultiplier.toFixed(2)}x</p>
            {result.win && <p>Win: {result.payout.toFixed(4)} SOL</p>}
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
