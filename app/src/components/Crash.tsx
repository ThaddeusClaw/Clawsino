import { useState, useEffect, useRef } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './Crash.css';

export function Crash() {
  const { connected, balance, loading, error } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [gameState, setGameState] = useState<'idle' | 'running' | 'crashed'>('idle');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(1.0);
  const [cashedOut, setCashedOut] = useState(false);
  const [finalMultiplier, setFinalMultiplier] = useState(1.0);
  const animationRef = useRef<number | undefined>(undefined);

  // Generate crash point (provably fair)
  const generateCrashPoint = () => {
    const r = Math.random();
    // 1% chance of instant crash at 1.0
    if (r < 0.01) return 1.0;
    // Exponential distribution with 2% house edge
    return Math.max(1.0, 0.99 / (1 - r));
  };

  const startGame = async () => {
    if (!connected || bet > balance) return;
    
    const targetCrash = generateCrashPoint();
    setCrashPoint(targetCrash);
    setGameState('running');
    setMultiplier(1.0);
    setCashedOut(false);
    setFinalMultiplier(1.0);

    // Deduct bet from balance (it was already sent in placeBet)
    // Animation loop
    let currentMultiplier = 1.0;
    const speed = 0.01;
    
    const animate = () => {
      currentMultiplier += speed * (currentMultiplier * 0.5);
      setMultiplier(currentMultiplier);
      
      if (currentMultiplier >= targetCrash) {
        // Crashed!
        setGameState('crashed');
        setFinalMultiplier(targetCrash);
        if (!cashedOut) {
          // Player lost
        }
      } else {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  const cashOut = () => {
    if (gameState !== 'running' || cashedOut) return;
    
    setCashedOut(true);
    setFinalMultiplier(multiplier);
    setGameState('idle');
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Player wins bet * multiplier
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <GameCard
      title="Crash"
      icon="📈"
      description="Cash out before the crash!"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={2}
    >
      <div className="crash-game">
        <div className={`crash-graph ${gameState}`}>
          <div className="multiplier-display">
            {gameState === 'crashed' ? (
              <span className="crashed">CRASHED @ {crashPoint.toFixed(2)}x</span>
            ) : cashedOut ? (
              <span className="cashed">CASHED @ {finalMultiplier.toFixed(2)}x</span>
            ) : (
              <span className={multiplier > 2 ? 'high' : multiplier > 1.5 ? 'medium' : 'low'}>
                {multiplier.toFixed(2)}x
              </span>
            )}
          </div>
          
          <div className="graph-line" style={{ 
            height: `${Math.min((multiplier - 1) * 50, 200)}px`,
            background: gameState === 'crashed' ? '#ff0040' : cashedOut ? '#00ff88' : '#ff0040'
          }} />
        </div>

        <div className="bet-controls">
          <input
            type="number"
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            min={0.001}
            max={0.1}
            step={0.001}
            disabled={gameState === 'running'}
          />
          <span className="currency">SOL</span>
        </div>

        {gameState === 'idle' && (
          <button 
            className="start-btn"
            onClick={startGame}
            disabled={!connected || loading || bet > balance}
          >
            🚀 Start
          </button>
        )}

        {gameState === 'running' && (
          <button 
            className="cashout-btn"
            onClick={cashOut}
          >
            💰 Cash Out @ {multiplier.toFixed(2)}x
          </button>
        )}

        {gameState === 'crashed' && (
          <div className="crash-result loss">
            <p>💥 Crashed at {crashPoint.toFixed(2)}x</p>
            <button className="restart-btn" onClick={() => setGameState('idle')}>
              Play Again
            </button>
          </div>
        )}

        {cashedOut && (
          <div className="crash-result win">
            <p>✅ Cashed out at {finalMultiplier.toFixed(2)}x</p>
            <p>Win: {(bet * finalMultiplier).toFixed(4)} SOL</p>
            <button className="restart-btn" onClick={() => setGameState('idle')}>
              Play Again
            </button>
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
