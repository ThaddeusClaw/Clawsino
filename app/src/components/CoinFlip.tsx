import { useState, useEffect } from 'react';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

const HOUSE_WALLET = new PublicKey('8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ');

interface FlipResult {
  win: boolean;
  amount: number;
  txSignature?: string;
}

export const CoinFlip = () => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  const [betAmount, setBetAmount] = useState(0.01);
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<FlipResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch balance
  useEffect(() => {
    if (!publicKey || !connection) {
      setBalance(0);
      return;
    }

    let active = true;
    
    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        if (active) {
          setBalance(lamports / LAMPORTS_PER_SOL);
        }
      } catch (err) {
        console.error('Balance fetch error:', err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [publicKey, connection]);

  const handleFlip = async () => {
    if (!publicKey || !sendTransaction || !connection) {
      setError('Wallet not connected');
      return;
    }

    if (betAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    setIsFlipping(true);
    setError(null);

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: Math.floor(betAmount * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      const isWin = Math.random() > 0.5;
      const flipResult: FlipResult = {
        win: isWin,
        amount: betAmount,
        txSignature: signature
      };

      setResult(flipResult);
      setHistory(prev => [flipResult, ...prev].slice(0, 10));
      
      // Refresh balance
      const lamports = await connection.getBalance(publicKey, 'confirmed');
      setBalance(lamports / LAMPORTS_PER_SOL);
      
    } catch (err: any) {
      console.error('Flip error:', err);
      setError(err.message || 'Transaction failed');
    } finally {
      setIsFlipping(false);
    }
  };

  if (!connected) {
    return (
      <div className="retro-game-container">
        <div className="game-header">
          <h2 className="pixel-title">🪙 COIN FLIP</h2>
          <p className="game-subtitle">Double or Nothing • 50/50</p>
        </div>
        <div className="connect-section">
          <div className="pixel-box">
            <span className="pixel-icon">👾</span>
            <h3>CONNECT WALLET TO PLAY</h3>
            <p>Click "Select Wallet" in the header</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="retro-game-container">
      <div className="game-header">
        <h2 className="pixel-title">🪙 COIN FLIP</h2>
        <p className="game-subtitle">Double or Nothing • 50/50</p>
      </div>

      <div className="balance-section">
        <div className="pixel-stat-box">
          <span className="stat-label">YOUR BALANCE</span>
          <span className="stat-value">{balance.toFixed(4)} SOL</span>
          {publicKey && (
            <span className="wallet-address">
              {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
            </span>
          )}
        </div>
      </div>

      <div className="bet-section">
        <label className="pixel-label">BET AMOUNT</label>
        <div className="bet-buttons">
          {[0.01, 0.05, 0.1, 0.5, 1].map((amount) => (
            <button
              key={amount}
              className={`pixel-bet-btn ${betAmount === amount ? 'active' : ''}`}
              onClick={() => setBetAmount(amount)}
              disabled={isFlipping}
            >
              {amount} SOL
            </button>
          ))}
        </div>
        <input
          type="number"
          step="0.001"
          min="0.001"
          max={balance}
          value={betAmount}
          onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
          className="pixel-input"
          disabled={isFlipping}
        />
      </div>

      {error && <div className="pixel-error">⚠️ {error}</div>}

      <button
        className={`pixel-flip-btn ${isFlipping ? 'flipping' : ''}`}
        onClick={handleFlip}
        disabled={isFlipping || betAmount > balance}
      >
        {isFlipping ? '🪙 FLIPPING...' : result?.win ? '🎉 WIN! PLAY AGAIN' : '🪙 FLIP COIN'}
      </button>

      {result && !isFlipping && (
        <div className={`result-box ${result.win ? 'win' : 'loss'}`}>
          <span className="result-icon">{result.win ? '🎉' : '😢'}</span>
          <h3>{result.win ? 'YOU WON!' : 'YOU LOST!'}</h3>
          <p className="result-amount">
            {result.win ? '+' : '-'}{result.amount} SOL
          </p>
          {result.txSignature && (
            <a
              href={`https://solscan.io/tx/${result.txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              View Transaction ↗
            </a>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="history-section">
          <h4 className="pixel-subtitle">HISTORY</h4>
          <div className="history-list">
            {history.map((flip, idx) => (
              <div key={idx} className={`history-item ${flip.win ? 'win' : 'loss'}`}>
                <span>{flip.win ? '🎉' : '😢'}</span>
                <span>{flip.amount} SOL</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
