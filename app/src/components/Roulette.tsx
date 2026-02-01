import React, { useState, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './Roulette.css';

const HOUSE_WALLET = new PublicKey('uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD');

const NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0-36
const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

type BetType = 'number' | 'color' | 'even_odd' | 'low_high' | 'dozen' | 'column';

export const Roulette: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [betAmount, setBetAmount] = useState<number>(0.01);
  const [betType, setBetType] = useState<BetType>('color');
  const [betValue, setBetValue] = useState<string>('red');
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ number: number; win: boolean; payout: number } | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    const bal = await connection.getBalance(publicKey);
    setBalance(bal / 1e9);
  }, [connection, publicKey]);

  React.useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const getColor = (n: number) => {
    if (n === 0) return 'green';
    return REDS.includes(n) ? 'red' : 'black';
  };

  const calculatePayout = (number: number) => {
    const color = getColor(number);
    
    switch (betType) {
      case 'number':
        return parseInt(betValue) === number ? 36 : 0;
      case 'color':
        return (betValue === 'red' && color === 'red') || (betValue === 'black' && color === 'black') ? 2 : 0;
      case 'even_odd':
        if (number === 0) return 0;
        const isEven = number % 2 === 0;
        return (betValue === 'even' && isEven) || (betValue === 'odd' && !isEven) ? 2 : 0;
      case 'low_high':
        if (number === 0) return 0;
        return (betValue === 'low' && number <= 18) || (betValue === 'high' && number > 18) ? 2 : 0;
      default:
        return 0;
    }
  };

  const handleSpin = async () => {
    if (!publicKey || !sendTransaction) return;
    if (betAmount > balance || betAmount > 0.1) {
      alert('Invalid bet amount (Max: 0.1 SOL)');
      return;
    }

    setIsSpinning(true);
    
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: betAmount * 1e9,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      const result = Math.floor(Math.random() * 37);
      const payoutMultiplier = calculatePayout(result);
      const payout = payoutMultiplier > 0 ? betAmount * payoutMultiplier : 0;
      const isWin = payout > 0;
      
      setTimeout(() => {
        setLastResult({ number: result, win: isWin, payout });
        setIsSpinning(false);
        fetchBalance();
      }, 3000);
      
    } catch (err) {
      console.error('Spin failed:', err);
      setIsSpinning(false);
    }
  };

  const renderWheel = () => (
    <div className="roulette-wheel">
      {isSpinning ? (
        <div className="wheel-spinning">🎰</div>
      ) : lastResult ? (
        <div className={`result-number ${getColor(lastResult.number)}`}>
          {lastResult.number}
        </div>
      ) : (
        <div className="wheel-placeholder">?</div>
      )}
    </div>
  );

  return (
    <div className="roulette-container">
      <div className="header">
        <h1>🎰 Roulette</h1>
        <p>European Roulette - 0 to 36</p>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span>Balance</span>
          <strong>{balance.toFixed(4)} SOL</strong>
        </div>
      </div>

      <div className="wallet-section">
        <WalletMultiButton className="wallet-button" />
      </div>

      {publicKey && (
        <div className="game-section">
          {renderWheel()}

          <div className="bet-panel">
            <div className="bet-type-selector">
              {['color', 'even_odd', 'low_high', 'number'].map((type) => (
                <button
                  key={type}
                  className={betType === type ? 'active' : ''}
                  onClick={() => { setBetType(type as BetType); setBetValue(''); }}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>

            {betType === 'color' && (
              <div className="bet-options">
                <button className={`color-btn red ${betValue === 'red' ? 'active' : ''}`} onClick={() => setBetValue('red')}>Red</button>
                <button className={`color-btn black ${betValue === 'black' ? 'active' : ''}`} onClick={() => setBetValue('black')}>Black</button>
              </div>
            )}

            {betType === 'even_odd' && (
              <div className="bet-options">
                <button className={betValue === 'even' ? 'active' : ''} onClick={() => setBetValue('even')}>Even</button>
                <button className={betValue === 'odd' ? 'active' : ''} onClick={() => setBetValue('odd')}>Odd</button>
              </div>
            )}

            {betType === 'low_high' && (
              <div className="bet-options">
                <button className={betValue === 'low' ? 'active' : ''} onClick={() => setBetValue('low')}>1-18</button>
                <button className={betValue === 'high' ? 'active' : ''} onClick={() => setBetValue('high')}>19-36</button>
              </div>
            )}

            {betType === 'number' && (
              <div className="number-grid">
                {NUMBERS.map((n) => (
                  <button
                    key={n}
                    className={`number-btn ${getColor(n)} ${betValue === n.toString() ? 'active' : ''}`}
                    onClick={() => setBetValue(n.toString())}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            <div className="bet-amount">
              <label>Bet Amount (Max: 0.1 SOL)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                max="0.1"
                value={betAmount}
                onChange={(e) => setBetAmount(parseFloat(e.target.value))}
              />
            </div>

            <button
              className={`spin-button ${isSpinning ? 'spinning' : ''}`}
              onClick={handleSpin}
              disabled={isSpinning || !betValue || betAmount > balance}
            >
              {isSpinning ? '🎰 SPINNING...' : '🎰 SPIN!'}
            </button>

            {lastResult && !isSpinning && (
              <div className={`result ${lastResult.win ? 'win' : 'loss'}`}>
                <h3>{lastResult.win ? '🎉 WIN!' : '😢 LOSS!'}</h3>
                <p>Number: {lastResult.number} ({getColor(lastResult.number)})</p>
                {lastResult.win && <p>Payout: +{lastResult.payout.toFixed(4)} SOL</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {!publicKey && (
        <div className="connect-prompt">
          <h2>Connect to Play Roulette</h2>
          <p>Bet on numbers, colors, or ranges</p>
        </div>
      )}
    </div>
  );
};