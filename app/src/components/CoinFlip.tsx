import { useState, useEffect, useCallback } from 'react';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

const HOUSE_WALLET = '8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ';

export function CoinFlip() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  const [bet, setBet] = useState(0.01);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{win: boolean; amount: number} | null>(null);
  const [balance, setBalance] = useState(0);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connection) return;
    try {
      const lamports = await connection.getBalance(publicKey, 'confirmed');
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (!connected) {
      setBalance(0);
      return;
    }
    fetchBalance();
    const interval = setInterval(fetchBalance, 3000);
    return () => clearInterval(interval);
  }, [connected, fetchBalance]);

  const handleFlip = async () => {
    if (!publicKey || !sendTransaction || !connection) return;
    if (bet > balance) return;

    setFlipping(true);
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(HOUSE_WALLET),
          lamports: Math.floor(bet * LAMPORTS_PER_SOL),
        })
      );

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');

      setResult({ win: Math.random() > 0.5, amount: bet });
      fetchBalance();
    } catch (err) {
      console.error('Flip failed:', err);
    } finally {
      setFlipping(false);
    }
  };

  if (!connected) {
    return (
      <div className="game-panel">
        <h2>🪙 COIN FLIP</h2>
        <p>50/50 • Double or Nothing</p>
        <div className="connect-box">
          <span className="pixel-icon">👾</span>
          <h3>CONNECT WALLET TO PLAY</h3>
          <p>Click "Select Wallet" in the header</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      <h2>🪙 COIN FLIP</h2>
      <p>50/50 • Double or Nothing</p>
      
      <div className="player-balance">
        <span>YOUR BALANCE</span>
        <strong>{balance.toFixed(4)} SOL</strong>
      </div>

      <div className="bet-section">
        <label>BET AMOUNT</label>
        <div className="bet-presets">
          {[0.01, 0.05, 0.1, 0.5, 1].map(a => (
            <button
              key={a}
              className={bet === a ? 'active' : ''}
              onClick={() => setBet(a)}
              disabled={flipping}
            >
              {a} SOL
            </button>
          ))}
        </div>
        <input
          type="number"
          step="0.001"
          min="0.001"
          max={balance}
          value={bet}
          onChange={(e) => setBet(parseFloat(e.target.value) || 0)}
          disabled={flipping}
        />
      </div>

      <button
        className={`flip-btn ${flipping ? 'spinning' : ''}`}
        onClick={handleFlip}
        disabled={flipping || bet > balance || bet <= 0}
      >
        {flipping ? '🪙 FLIPPING...' : result?.win ? '🎉 WIN! AGAIN?' : '🪙 FLIP COIN'}
      </button>

      {result && !flipping && (
        <div className={`result ${result.win ? 'win' : 'loss'}`}>
          <span>{result.win ? '🎉' : '😢'}</span>
          <h3>{result.win ? 'YOU WON!' : 'YOU LOST!'}</h3>
          <p>{result.win ? '+' : '-'}{result.amount} SOL</p>
        </div>
      )}
    </div>
  );
}
