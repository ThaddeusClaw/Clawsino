import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './Crash.css';

const HOUSE_WALLET = new PublicKey('uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD');

export const Crash: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [betAmount, setBetAmount] = useState<number>(0.01);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [crashPoint, setCrashPoint] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [lastResult, setLastResult] = useState<{ multiplier: number; win: boolean; payout: number } | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    const bal = await connection.getBalance(publicKey);
    setBalance(bal / 1e9);
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const startGame = async () => {
    if (!publicKey || !sendTransaction) return;
    if (betAmount > balance || betAmount > 0.1) {
      alert('Invalid bet amount');
      return;
    }

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

      setHasBet(true);
      setCashedOut(false);
      setIsPlaying(true);
      setMultiplier(1.0);
      
      // Generate crash point (1.0x to 100x, geometric distribution)
      const r = Math.random();
      const crash = Math.max(1.01, 0.99 / (1 - r));
      setCrashPoint(Math.min(crash, 100));
      
    } catch (err) {
      console.error('Start failed:', err);
    }
  };

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setMultiplier((prev) => {
        const next = prev * 1.03; // 3% growth per tick
        if (next >= crashPoint) {
          // Crashed!
          setIsPlaying(false);
          setHasBet(false);
          setLastResult({ multiplier: crashPoint, win: false, payout: 0 });
          return crashPoint;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, crashPoint]);

  const cashOut = async () => {
    if (!isPlaying || cashedOut || !hasBet) return;
    
    setCashedOut(true);
    setIsPlaying(false);
    setHasBet(false);
    
    const payout = betAmount * multiplier;
    setLastResult({ multiplier, win: true, payout });
    fetchBalance();
  };

  return (
    <div className="crash-container">
      <div className="header">
        <h1>🦞 Clawsino - Crash</h1>
        <p>Cash out before the crash!</p>
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
          <div className="crash-graph">
            {isPlaying || lastResult ? (
              <div className="multiplier-display" style={{ 
                color: isPlaying ? '#2ecc71' : lastResult?.win ? '#2ecc71' : '#e74c3c'
              }}>
                <span className="value">
                  {isPlaying ? multiplier.toFixed(2) : lastResult?.multiplier.toFixed(2)}x
                </span>
                {isPlaying && <span className="pulse">↗</span>}
                {!isPlaying && lastResult && (
                  <span className="result">
                    {lastResult.win ? '🎉 CASHED OUT!' : '💥 CRASHED!'}
                  </span>
                )}
              </div>
            ) : (
              <div className="waiting">Place bet to start</div>
            )}
          </div>

          <div className="bet-controls">
            {!hasBet && !isPlaying && (
              <>
                <label>Bet Amount (Max: 0.1 SOL)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="0.1"
                  value={betAmount}
                  onChange={(e) => setBetAmount(parseFloat(e.target.value))}
                  disabled={isPlaying}
                />
                <button className="start-btn" onClick={startGame} disabled={betAmount > balance}>
                  🚀 START GAME
                </button>
              </>
            )}

            {isPlaying && hasBet && !cashedOut && (
              <button className="cashout-btn" onClick={cashOut}>
                💰 CASH OUT AT {multiplier.toFixed(2)}x
                <span className="potential">({(betAmount * multiplier).toFixed(4)} SOL)</span>
              </button>
            )}

            {lastResult && (
              <div className={`result-banner ${lastResult.win ? 'win' : 'loss'}`}>
                {lastResult.win ? (
                  <>
                    <h3>🎉 YOU WON!</h3>
                    <p>Cashed out at {lastResult.multiplier.toFixed(2)}x</p>
                    <p className="payout">+{lastResult.payout.toFixed(4)} SOL</p>
                  </>
                ) : (
                  <>
                    <h3>💥 CRASHED!</h3>
                    <p>Crashed at {lastResult.multiplier.toFixed(2)}x</p>
                    <p>Lost {betAmount} SOL</p>
                  </>
                )}
                <button className="start-btn" onClick={() => setLastResult(null)}>
                  PLAY AGAIN
                </button>
              </div>
            )}
          </div>

          <div className="instructions">
            <h4>How to Play</h4>
            <ol>
              <li>Place your bet</li>
              <li>Multiplier starts at 1.00x</li>
              <li>Cash out anytime before crash</li>
              <li>If you wait too long → 💥</li>
            </ol>
          </div>
        </div>
      )}

      {!publicKey && (
        <div className="connect-prompt">
          <h2>Connect to Play Crash</h2>
          <p>Hold your nerve and cash out!</p>
        </div>
      )}
    </div>
  );
};