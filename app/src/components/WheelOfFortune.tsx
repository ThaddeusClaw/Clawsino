import { useState } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './WheelOfFortune.css';

const SEGMENTS = [
  { multiplier: 0, color: '#ff0040', label: '0x' },
  { multiplier: 0.5, color: '#ff4400', label: '0.5x' },
  { multiplier: 1, color: '#ff8800', label: '1x' },
  { multiplier: 1.5, color: '#ffcc00', label: '1.5x' },
  { multiplier: 2, color: '#88ff00', label: '2x' },
  { multiplier: 3, color: '#00ff44', label: '3x' },
  { multiplier: 5, color: '#00ff88', label: '5x' },
  { multiplier: 10, color: '#00ffff', label: '10x' },
  { multiplier: 25, color: '#0088ff', label: '25x' },
  { multiplier: 50, color: '#4400ff', label: '50x' },
];

export function WheelOfFortune() {
  const { connected, balance, loading, error } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ segment: typeof SEGMENTS[0]; payout: number } | null>(null);

  const spin = async () => {
    if (!connected) return;
    
    setSpinning(true);
    setResult(null);
    
    // Weighted random selection
    const weights = [15, 20, 25, 15, 10, 8, 4, 2, 0.8, 0.2];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    let winningIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        winningIndex = i;
        break;
      }
    }
    
    // Calculate rotation
    const segmentAngle = 360 / SEGMENTS.length;
    const winningAngle = winningIndex * segmentAngle;
    const extraSpins = 5 + Math.floor(Math.random() * 3); // 5-8 full spins
    const finalRotation = rotation + (extraSpins * 360) + (360 - winningAngle) - (segmentAngle / 2);
    
    setRotation(finalRotation);
    
    // Wait for animation
    setTimeout(() => {
      const winningSegment = SEGMENTS[winningIndex];
      const payout = bet * winningSegment.multiplier;
      
      setResult({
        segment: winningSegment,
        payout
      });
      setSpinning(false);
    }, 4000);
  };

  return (
    <GameCard
      title="Wheel of Fortune"
      icon="🎡"
      description="Spin the wheel for big multipliers!"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={4}
    >
      <div className="wheel-game">
        <div className="wheel-container">
          <div 
            className="wheel"
            style={{ 
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.23, 1, 0.32, 1)' : 'none'
            }}
          >
            {SEGMENTS.map((segment, idx) => {
              const angle = (idx * 360) / SEGMENTS.length;
              return (
                <div
                  key={idx}
                  className="wheel-segment"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    background: segment.color,
                  }}
                >
                  <span className="segment-label">{segment.label}</span>
                </div>
              );
            })}
          </div>
          <div className="wheel-pointer">▼</div>
        </div>

        <div className="wheel-legend">
          {SEGMENTS.map((seg, idx) => (
            <div key={idx} className="legend-item">
              <span className="color-dot" style={{ background: seg.color }} />
              <span>{seg.label}</span>
            </div>
          ))}
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
          {spinning ? '🎡 Spinning...' : '🎡 SPIN THE WHEEL'}
        </button>

        {result && (
          <div className={`wheel-result ${result.payout >= bet ? 'win' : 'loss'}`}>
            <h3 style={{ color: result.segment.color }}>
              {result.segment.label}!
            </h3>
            <p>
              {result.payout >= bet 
                ? `🎉 You won ${result.payout.toFixed(4)} SOL!`
                : '💸 Better luck next time!'}
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
