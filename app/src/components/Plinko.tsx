import { useState, useRef } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './Plinko.css';

const ROWS = 12;
const MULTIPLIERS = [0.2, 0.4, 0.6, 1, 2, 5, 10, 5, 2, 1, 0.6, 0.4, 0.2];

interface Ball {
  id: number;
  x: number;
  y: number;
  path: number[];
}

export function Plinko() {
  const { connected, balance, loading, error } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [dropping, setDropping] = useState(false);
  const [lastResult, setLastResult] = useState<{ multiplier: number; win: number } | null>(null);
  const ballIdRef = useRef(0);

  const dropBall = async () => {
    if (!connected || dropping) return;
    
    setDropping(true);
    setLastResult(null);
    
    const ballId = ballIdRef.current++;
    const path: number[] = [];
    let currentX = 6; // Start in middle
    
    // Generate path
    for (let row = 0; row < ROWS; row++) {
      const goRight = Math.random() > 0.5;
      if (goRight && currentX < 12) currentX++;
      else if (!goRight && currentX > 0) currentX--;
      path.push(currentX);
    }
    
    const newBall: Ball = {
      id: ballId,
      x: 6,
      y: 0,
      path
    };
    
    setBalls([newBall]);
    
    // Animate
    let step = 0;
    const animate = () => {
      if (step < ROWS) {
        setBalls([{
          ...newBall,
          y: step,
          x: path[step]
        }]);
        step++;
        setTimeout(animate, 200);
      } else {
        // Ball reached bottom
        const finalX = path[path.length - 1];
        const multiplier = MULTIPLIERS[finalX];
        const win = bet * multiplier;
        
        setLastResult({ multiplier, win });
        setDropping(false);
      }
    };
    
    animate();
  };

  return (
    <GameCard
      title="Plinko"
      icon="🔴"
      description="Drop the ball and watch it fall!"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={3}
    >
      <div className="plinko-game">
        <div className="plinko-board">
          {Array.from({ length: ROWS }).map((_, row) => (
            <div key={row} className="plinko-row">
              {Array.from({ length: 13 }).map((_, col) => {
                const hasPeg = (row + col) % 2 === 0;
                const ball = balls.find(b => b.x === col && b.y === row);
                
                return (
                  <div key={col} className="plinko-cell">
                    {hasPeg && <div className="peg" />}
                    {ball && <div className="ball" />}
                  </div>
                );
              })}
            </div>
          ))}
          
          <div className="multipliers">
            {MULTIPLIERS.map((mult, idx) => (
              <div 
                key={idx} 
                className={`multiplier ${mult >= 5 ? 'high' : mult >= 1 ? 'medium' : 'low'}`}
              >
                {mult}x
              </div>
            ))}
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
          className="drop-btn"
          onClick={dropBall}
          disabled={!connected || dropping || loading || bet > balance}
        >
          {dropping ? '🔴 Dropping...' : '🔴 Drop Ball'}
        </button>

        {lastResult && (
          <div className={`plinko-result ${lastResult.win >= bet ? 'win' : 'loss'}`}>
            <div className="multiplier-display">{lastResult.multiplier}x</div>
            <p>
              {lastResult.win >= bet 
                ? `🎉 Won ${lastResult.win.toFixed(4)} SOL!` 
                : `💸 Lost ${(bet - lastResult.win).toFixed(4)} SOL`}
            </p>
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
