import { useState, useEffect, useCallback } from 'react';
import { Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { fetchBalanceDirect, testConnection } from '../utils/balance';
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
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<FlipResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // CRITICAL: Fetch balance with direct RPC to ensure mainnet
  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }

    try {
      setConnectionStatus('checking');
      
      // Use direct RPC call (bypasses any adapter issues)
      const sol = await fetchBalanceDirect(publicKey.toBase58());
      
      console.log('✅ Balance fetched:', sol, 'SOL');
      setBalance(sol);
      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      console.error('❌ Balance fetch error:', err);
      setConnectionStatus('error');
      setBalance(0);
      setError('Failed to fetch balance');
    }
  }, [publicKey]);

  // Debug: Test connection on mount
  useEffect(() => {
    console.log('🎰 CoinFlip mounted');
    console.log('🔗 Connection endpoint:', connection?.rpcEndpoint);
    console.log('👛 Public key:', publicKey?.toBase58());
    
    // Test RPC connection
    testConnection().then(result => {
      console.log('🧪 Connection test:', result);
    });
    
    fetchBalance();
    const interval = setInterval(fetchBalance, 3000);
    return () => clearInterval(interval);
  }, [fetchBalance, connection, publicKey]);

  const handleFlip = async () => {
    if (!publicKey || !sendTransaction || !connection) {
      setError('Wallet not connected');
      return;
    }

    if (!balance || betAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    setIsFlipping(true);
    setError(null);
    setResult(null);

    try {
      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: Math.floor(betAmount * 1e9),
        })
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Confirm
      await connection.confirmTransaction(signature, 'confirmed');

      // Determine result (50/50)
      const isWin = Math.random() > 0.5;
      
      const flipResult: FlipResult = {
        win: isWin,
        amount: betAmount,
        txSignature: signature
      };

      setResult(flipResult);
      setHistory(prev => [flipResult, ...prev].slice(0, 10));
      
      // Refresh balance
      await fetchBalance();
      
    } catch (err: any) {
      console.error('Flip error:', err);
      setError(err.message || 'Transaction failed');
    } finally {
      setIsFlipping(false);
    }
  };

  const formatBalance = (bal: number | null) => {
    if (bal === null) return '---';
    return bal.toFixed(4);
  };

  return (
    <div className="retro-game-container">
      <div className="game-header">
        <h2 className="pixel-title">🪙 COIN FLIP</h2>
        <p className="game-subtitle">Double or Nothing • 50/50</p>
      </div>

      {!connected ? (
        <div className="connect-section">
          <div className="pixel-box">
            <span className="pixel-icon">👾</span>
            <h3>CONNECT WALLET TO PLAY</h3>
            <p>Phantom or Solflare required</p>
          </div>
        </div>
      ) : (
        <>
          <div className="balance-section">
            <div className="pixel-stat-box">
              <span className="stat-label">YOUR BALANCE</span>
              <span className={`stat-value ${connectionStatus === 'error' ? 'error' : ''}`}>
                {formatBalance(balance)} SOL
              </span>
              {connectionStatus === 'error' && (
                <span className="error-text">⚠️ Connection Error - Check Console</span>
              )}
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
              max={balance || 0}
              value={betAmount}
              onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
              className="pixel-input"
              disabled={isFlipping}
            />
          </div>

          {error && (
            <div className="pixel-error">
              ⚠️ {error}
            </div>
          )}

          <button
            className={`pixel-flip-btn ${isFlipping ? 'flipping' : ''} ${result?.win ? 'win' : ''}`}
            onClick={handleFlip}
            disabled={isFlipping || !balance || betAmount > balance}
          >
            {isFlipping ? (
              <span className="flip-animation">
                <span className="coin">🪙</span>
                <span className="dots">...</span>
              </span>
            ) : result ? (
              result.win ? '🎉 WIN! PLAY AGAIN' : '😢 TRY AGAIN'
            ) : (
              '🪙 FLIP COIN'
            )}
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
        </>
      )}
    </div>
  );
};
