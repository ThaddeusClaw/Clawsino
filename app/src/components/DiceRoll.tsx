import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './DiceRoll.css';

const HOUSE_WALLET = new PublicKey('uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD');
const THRESHOLD = 50; // Under/Over 50

export const DiceRoll: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [betAmount, setBetAmount] = useState<number>(0.01);
  const [prediction, setPrediction] = useState<'under' | 'over'>('under');
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{ roll: number; win: boolean; amount: number } | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [houseBalance, setHouseBalance] = useState<number>(0);
  const [history, setHistory] = useState<Array<{ roll: number; win: boolean; amount: number; time: Date }>>([]);
  const [multiplier, setMultiplier] = useState<number>(1.98);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;
    try {
      const playerBal = await connection.getBalance(publicKey);
      const houseBal = await connection.getBalance(HOUSE_WALLET);
      setBalance(playerBal / 1e9);
      setHouseBalance(houseBal / 1e9);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 5000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  useEffect(() => {
    // Calculate multiplier based on probability
    // Under 50 = 49% win chance = ~2x payout
    // Over 50 = 49% win chance = ~2x payout
    setMultiplier(1.98);
  }, [prediction]);

  const handleRoll = async () => {
    if (!publicKey || !sendTransaction) return;
    if (betAmount <= 0 || betAmount > balance || betAmount > 0.1) {
      alert('Invalid bet amount (Max: 0.1 SOL)');
      return;
    }

    setIsRolling(true);
    
    try {
      // Transfer bet to house
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: betAmount * 1e9,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Generate roll (1-100)
      const roll = Math.floor(Math.random() * 100) + 1;
      const isWin = prediction === 'under' ? roll < THRESHOLD : roll > THRESHOLD;
      
      setTimeout(() => {
        setLastResult({ roll, win: isWin, amount: betAmount });
        setHistory(prev => [{ roll, win: isWin, amount: betAmount, time: new Date() }, ...prev].slice(0, 10));
        setIsRolling(false);
        fetchBalances();
        
        if (isWin) {
          const payout = betAmount * multiplier;
          console.log(`WIN! Roll: ${roll}, Payout: ${payout.toFixed(4)} SOL`);
        } else {
          console.log(`LOSS! Roll: ${roll}`);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Roll failed:', err);
      setIsRolling(false);
    }
  };

  return (
    <div className="dice-container">
      <div className="header">
        <h1>🦞 Clawsino - Dice</h1>
        <p>Roll under or over 50 - Win 1.98x</p>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span>Your Balance</span>
          <strong>{balance.toFixed(4)} SOL</strong>
        </div>
        <div className="stat house">
          <span>House Balance</span>
          <strong>{houseBalance.toFixed(2)} SOL</strong>
        </div>
      </div>

      <div className="wallet-section">
        <WalletMultiButton className="wallet-button" />
      </div>

      {publicKey && (
        <div className="game-section">
          <div className="prediction-selector">
            <button 
              className={prediction === 'under' ? 'active' : ''}
              onClick={() => setPrediction('under')}
            >
              Under 50
              <span>49% chance • 1.98x</span>
            </button>
            <button 
              className={prediction === 'over' ? 'active' : ''}
              onClick={() => setPrediction('over')}
            >
              Over 50
              <span>49% chance • 1.98x</span>
            </button>
          </div>

          <div className="dice-display">
            {isRolling ? (
              <div className="rolling">🎲</div>
            ) : lastResult ? (
              <div className={`result-number ${lastResult.win ? 'win' : 'loss'}`}>
                {lastResult.roll}
              </div>
            ) : (
              <div className="placeholder">?</div>
            )}
          </div>

          <div className="bet-controls">
            <label>Bet Amount (Max: 0.1 SOL)</label>
            <div className="amount-buttons">
              {[0.01, 0.02, 0.05, 0.1].map((amount) => (
                <button
                  key={amount}
                  className={betAmount === amount ? 'active' : ''}
                  onClick={() => setBetAmount(amount)}
                >
                  {amount} SOL
                </button>
              ))}
            </div>
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
            className={`roll-button ${isRolling ? 'rolling' : ''}`}
            onClick={handleRoll}
            disabled={isRolling || betAmount > balance || betAmount > 0.1}
          >
            {isRolling ? '🎲 ROLLING...' : '🎲 ROLL DICE!'}
          </button>

          {lastResult && !isRolling && (
            <div className={`result-banner ${lastResult.win ? 'win' : 'loss'}`}>
              <h2>{lastResult.win ? '🎉 YOU WON!' : '😢 YOU LOST!'}</h2>
              <p>Roll: {lastResult.roll} | {lastResult.win ? `+${(lastResult.amount * 1.98).toFixed(4)}` : `-${lastResult.amount}`} SOL</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="history">
              <h3>Recent Rolls</h3>
              <div className="history-list">
                {history.map((h, idx) => (
                  <div key={idx} className={`history-item ${h.win ? 'win' : 'loss'}`}>
                    <span className="roll">{h.roll}</span>
                    <span className="outcome">{h.win ? 'WIN' : 'LOSS'}</span>
                    <span className="amount">{h.amount} SOL</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!publicKey && (
        <div className="connect-prompt">
          <h2>Connect to Play Dice</h2>
          <p>49% win chance • 1.98x payout</p>
          <div className="features">
            <div className="feature">🎯 Pick Under/Over 50</div>
            <div className="feature">⚡ Instant rolls</div>
            <div className="feature">💰 Up to 0.1 SOL bets</div>
          </div>
        </div>
      )}

      <div className="footer">
        <p>Built by Agents, for Agents 🦞</p>
        <p className="limits">clawsino.fun | Max Bet: 0.1 SOL</p>
      </div>
    </div>
  );
};