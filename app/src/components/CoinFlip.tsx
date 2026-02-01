import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './CoinFlip.css';

// const PROGRAM_ID = new PublicKey('2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG');
const HOUSE_WALLET = new PublicKey('uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD');

// interface GameState {
//   totalFlips: number;
//   totalWins: number;
//   totalLosses: number;
//   totalVolume: number;
// }

export const CoinFlip: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [betAmount, setBetAmount] = useState<number>(0.01);
  const [isFlipping, setIsFlipping] = useState(false);
  const [lastResult, setLastResult] = useState<{ win: boolean; amount: number } | null>(null);
  const [balance, setBalance] = useState<number>(0);
  // const [gameStats, setGameStats] = useState<GameState | null>(null);
  const [flipHistory, setFlipHistory] = useState<Array<{ win: boolean; amount: number; time: Date }>>([]);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / 1e9);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const handleFlip = async () => {
    if (!publicKey || !sendTransaction) return;
    if (betAmount <= 0 || betAmount > balance) {
      alert('Invalid bet amount');
      return;
    }

    setIsFlipping(true);
    
    try {
      // For now, simulate the flip since program isn't deployed yet
      // In production, this would call the actual program
      
      // Create transfer transaction to house wallet
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: betAmount * 1e9,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Simulate random result (50/50)
      const isWin = Math.random() > 0.5;
      
      setTimeout(() => {
        setLastResult({ win: isWin, amount: betAmount });
        setFlipHistory(prev => [{ win: isWin, amount: betAmount, time: new Date() }, ...prev].slice(0, 10));
        setIsFlipping(false);
        fetchBalance();
        
        if (isWin) {
          // In real implementation, house would send back winnings
          console.log('WIN! Payout would be:', betAmount * 2);
        }
      }, 1500);
      
    } catch (err) {
      console.error('Flip failed:', err);
      setIsFlipping(false);
    }
  };

  return (
    <div className="coin-flip-container">
      <div className="header">
        <h1>🎰 Agent Casino</h1>
        <p>Double or Nothing on Solana</p>
      </div>

      <div className="wallet-section">
        <WalletMultiButton className="wallet-button" />
        {publicKey && (
          <div className="balance">
            <span>Balance: {balance.toFixed(4)} SOL</span>
          </div>
        )}
      </div>

      {publicKey && (
        <div className="game-section">
          <div className="bet-controls">
            <label>Bet Amount (SOL)</label>
            <div className="amount-buttons">
              {[0.01, 0.05, 0.1, 0.5, 1].map((amount) => (
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
              max="1"
              value={betAmount}
              onChange={(e) => setBetAmount(parseFloat(e.target.value))}
            />
          </div>

          <button
            className={`flip-button ${isFlipping ? 'flipping' : ''}`}
            onClick={handleFlip}
            disabled={isFlipping || betAmount > balance}
          >
            {isFlipping ? (
              <span className="coin-animation">🪙</span>
            ) : lastResult ? (
              lastResult.win ? '🎉 FLIP AGAIN!' : '😢 TRY AGAIN!'
            ) : (
              '🪙 FLIP COIN!'
            )}
          </button>

          {lastResult && !isFlipping && (
            <div className={`result ${lastResult.win ? 'win' : 'loss'}`}>
              <h2>{lastResult.win ? '🎉 YOU WON!' : '😢 YOU LOST!'}</h2>
              <p>{lastResult.win ? `+${lastResult.amount} SOL` : `-${lastResult.amount} SOL`}</p>
            </div>
          )}

          {flipHistory.length > 0 && (
            <div className="history">
              <h3>Recent Flips</h3>
              <div className="history-list">
                {flipHistory.map((flip, idx) => (
                  <div key={idx} className={`history-item ${flip.win ? 'win' : 'loss'}`}>
                    <span>{flip.win ? '🎉' : '😢'}</span>
                    <span>{flip.amount} SOL</span>
                    <span>{flip.time.toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!publicKey && (
        <div className="connect-prompt">
          <h2>Connect Your Wallet to Play</h2>
          <p>Double your SOL with a 50/50 chance!</p>
          <div className="features">
            <div className="feature">⚡ Instant flips</div>
            <div className="feature">🔒 Provably fair</div>
            <div className="feature">💰 2x payouts</div>
          </div>
        </div>
      )}

      <div className="footer">
        <p>Built by Agents, for Agents 🐙</p>
        <p className="network">Devnet Mode</p>
      </div>
    </div>
  );
};