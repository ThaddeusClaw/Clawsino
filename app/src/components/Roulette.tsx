import { useState } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './Roulette.css';

const NUMBERS = [
  { num: 0, color: 'green' },
  { num: 32, color: 'red' }, { num: 15, color: 'black' },
  { num: 19, color: 'red' }, { num: 4, color: 'black' },
  { num: 21, color: 'red' }, { num: 2, color: 'black' },
  { num: 25, color: 'red' }, { num: 17, color: 'black' },
  { num: 34, color: 'red' }, { num: 6, color: 'black' },
  { num: 27, color: 'red' }, { num: 13, color: 'black' },
  { num: 36, color: 'red' }, { num: 11, color: 'black' },
  { num: 30, color: 'red' }, { num: 8, color: 'black' },
  { num: 23, color: 'red' }, { num: 10, color: 'black' },
  { num: 5, color: 'red' }, { num: 24, color: 'black' },
  { num: 16, color: 'red' }, { num: 33, color: 'black' },
  { num: 1, color: 'red' }, { num: 20, color: 'black' },
  { num: 14, color: 'red' }, { num: 31, color: 'black' },
  { num: 9, color: 'red' }, { num: 22, color: 'black' },
  { num: 18, color: 'red' }, { num: 29, color: 'black' },
  { num: 7, color: 'red' }, { num: 28, color: 'black' },
  { num: 12, color: 'red' }, { num: 35, color: 'black' },
  { num: 3, color: 'red' }, { num: 26, color: 'black' }
];

type BetType = 'number' | 'color' | 'evenodd' | 'range';

export function Roulette() {
  const { connected, balance, loading, error, placeBet } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [spinning, setSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [selectedBet, setSelectedBet] = useState<{ type: BetType; value: string | number } | null>(null);

  const spin = async () => {
    if (!connected || !selectedBet) return;
    
    setSpinning(true);
    
    // Calculate win probability based on bet type
    let winProb = 0;
    let multiplier = 0;
    
    switch (selectedBet.type) {
      case 'number':
        winProb = 1 / 37; // Single number
        multiplier = 35;
        break;
      case 'color':
        winProb = 18 / 37; // Red or black
        multiplier = 2;
        break;
      case 'evenodd':
        winProb = 18 / 37;
        multiplier = 2;
        break;
      case 'range':
        winProb = 12 / 37; // 1-12, 13-24, 25-36
        multiplier = 3;
        break;
    }
    
    try {
      await placeBet(bet, winProb * 100, multiplier);
      
      // Generate winning number
      const winningIdx = Math.floor(Math.random() * 37);
      const winningNum = NUMBERS[winningIdx].num;
      setWinningNumber(winningNum);
      
      setTimeout(() => {
        setSpinning(false);
      }, 3000);
    } catch (err) {
      setSpinning(false);
    }
  };

  const checkWin = (num: number) => {
    if (!selectedBet) return false;
    
    const numberData = NUMBERS.find(n => n.num === num);
    if (!numberData) return false;
    
    switch (selectedBet.type) {
      case 'number':
        return num === selectedBet.value;
      case 'color':
        return numberData.color === selectedBet.value;
      case 'evenodd':
        if (num === 0) return false;
        return selectedBet.value === 'even' ? num % 2 === 0 : num % 2 === 1;
      case 'range':
        if (num === 0) return false;
        if (selectedBet.value === '1-12') return num >= 1 && num <= 12;
        if (selectedBet.value === '13-24') return num >= 13 && num <= 24;
        if (selectedBet.value === '25-36') return num >= 25 && num <= 36;
        return false;
    }
    return false;
  };

  return (
    <GameCard
      title="Roulette"
      icon="🎰"
      description="Classic casino roulette"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={2.7}
    >
      <div className="roulette-game">
        <div className={`roulette-wheel ${spinning ? 'spinning' : ''}`}>
          <div className="wheel-center">
            {winningNumber !== null && !spinning ? (
              <span className={`number ${NUMBERS.find(n => n.num === winningNumber)?.color}`}>
                {winningNumber}
              </span>
            ) : (
              <span className="placeholder">?</span>
            )}
          </div>
        </div>

        <div className="betting-options">
          <div className="bet-section">
            <h4>Number (35x)</h4>
            <div className="numbers-grid">
              {NUMBERS.map((n) => (
                <button
                  key={n.num}
                  className={`number-btn ${n.color} ${selectedBet?.type === 'number' && selectedBet.value === n.num ? 'selected' : ''}`}
                  onClick={() => setSelectedBet({ type: 'number', value: n.num })}
                >
                  {n.num}
                </button>
              ))}
            </div>
          </div>

          <div className="bet-section">
            <h4>Color (2x)</h4>
            <div className="color-bets">
              <button 
                className={`color-btn red ${selectedBet?.type === 'color' && selectedBet.value === 'red' ? 'selected' : ''}`}
                onClick={() => setSelectedBet({ type: 'color', value: 'red' })}
              >
                🔴 Red
              </button>
              <button 
                className={`color-btn black ${selectedBet?.type === 'color' && selectedBet.value === 'black' ? 'selected' : ''}`}
                onClick={() => setSelectedBet({ type: 'color', value: 'black' })}
              >
                ⚫ Black
              </button>
            </div>
          </div>

          <div className="bet-section">
            <h4>Even/Odd (2x)</h4>
            <div className="evenodd-bets">
              <button 
                className={selectedBet?.type === 'evenodd' && selectedBet.value === 'even' ? 'selected' : ''}
                onClick={() => setSelectedBet({ type: 'evenodd', value: 'even' })}
              >
                Even
              </button>
              <button 
                className={selectedBet?.type === 'evenodd' && selectedBet.value === 'odd' ? 'selected' : ''}
                onClick={() => setSelectedBet({ type: 'evenodd', value: 'odd' })}
              >
                Odd
              </button>
            </div>
          </div>

          <div className="bet-section">
            <h4>Range (3x)</h4>
            <div className="range-bets">
              {['1-12', '13-24', '25-36'].map((range) => (
                <button
                  key={range}
                  className={selectedBet?.type === 'range' && selectedBet.value === range ? 'selected' : ''}
                  onClick={() => setSelectedBet({ type: 'range', value: range })}
                >
                  {range}
                </button>
              ))}
            </div>
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
          disabled={!connected || spinning || loading || !selectedBet || bet > balance}
        >
          {spinning ? '🎰 Spinning...' : '🎰 Spin'}
        </button>

        {winningNumber !== null && !spinning && (
          <div className={`spin-result ${checkWin(winningNumber) ? 'win' : 'loss'}`}>
            <p>{checkWin(winningNumber) ? '✅ You won!' : '❌ You lost!'}</p>
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
