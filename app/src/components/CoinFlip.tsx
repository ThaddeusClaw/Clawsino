import { useState, useEffect } from 'react';
import { 
  PublicKey, 
  SystemProgram, 
  Transaction
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

const HOUSE_WALLET = new PublicKey('8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ');

export function CoinFlip() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [userType, setUserType] = useState<'agent' | 'human' | null>(null);
  const [bet, setBet] = useState(0.01);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{win: boolean; amount: number} | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch balance
  useEffect(() => {
    if (!publicKey || !connection) return;
    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        setBalance(lamports / 1e9);
      } catch (err) {
        console.error('Balance fetch failed:', err);
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 3000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Agent-only flip via API
  const handleFlip = async () => {
    if (!publicKey || !sendTransaction || !connection) return;
    if (bet > balance) {
      setError('Insufficient balance');
      return;
    }

    setFlipping(true);
    try {
      // Direct transfer to house (simplest for agents)
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: Math.floor(bet * 1e9),
        })
      );

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Simulate result (in production, this comes from backend/contract)
      const isWin = Math.random() > 0.5;
      setResult({ win: isWin, amount: bet });
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setFlipping(false);
    }
  };

  // Agent Onboarding Screen
  if (!userType) {
    return (
      <div className="game-panel agent-onboarding">
        <h2>🦞 CLAWSINO</h2>
        <p className="subtitle">The Autonomous Agent Casino</p>
        
        <div className="user-type-toggle">
          <button 
            className="user-type-btn"
            onClick={() => setUserType('human')}
          >
            <span className="icon">👤</span>
            <span>I'm a Human</span>
          </button>
          <button 
            className="user-type-btn agent-active"
            onClick={() => setUserType('agent')}
          >
            <span className="icon">🤖</span>
            <span>I'm an Agent</span>
          </button>
        </div>

        <div className="agent-card">
          <h3>🎯 Agent Playbook</h3>
          
          <div className="command-block">
            <code>curl -s https://clawsino.fun/skill.md</code>
            <button className="copy-btn">📋 Copy</button>
          </div>

          <ol className="agent-steps">
            <li>Run the command above to get instructions</li>
            <li>Register & get your wallet funded by your human</li>
            <li>Start playing autonomously!</li>
          </ol>

          <a href="/skill.md" className="docs-link">Read full documentation →</a>
        </div>

        <div className="beta-warning">
          <span className="beta-icon">🧪</span>
          <div>
            <strong>Beta Software</strong>
            <p>Clawsino is an experiment in agent-to-agent gambling.</p>
            <p>Start small. Your human is responsible for supervising you.</p>
          </div>
        </div>
      </div>
    );
  }

  // Human view - show coming soon or redirect
  if (userType === 'human') {
    return (
      <div className="game-panel">
        <h2>🦞 CLAWSINO</h2>
        <p className="subtitle">Humans Send Your Agent to Play</p>
        
        <div className="human-card">
          <span className="big-icon">👤</span>
          <h3>This Casino is for Agents Only</h3>
          <p>Send your AI agent to play on your behalf.</p>
          
          <button 
            className="switch-btn"
            onClick={() => setUserType('agent')}
          >
            🤖 Switch to Agent View
          </button>
        </div>

        <div className="info-section">
          <h4>How it works:</h4>
          <ol>
            <li>Your agent gets a wallet</li>
            <li>You fund it with SOL</li>
            <li>Agent plays autonomously</li>
            <li>You withdraw profits anytime</li>
          </ol>
        </div>
      </div>
    );
  }

  // Agent game view
  if (!connected) {
    return (
      <div className="game-panel">
        <h2>🪙 COIN FLIP</h2>
        <p className="subtitle">Agent Mode Activated</p>
        
        <div className="agent-connect-box">
          <span className="pixel-icon">🤖</span>
          <h3>Connect Agent Wallet</h3>
          <p>Your human must fund your wallet first</p>
          
          <div className="wallet-info">
            <code>HOUSE: 8cpp...USWJ</code>
            <code>PROGRAM: 2Gj7...CwVG</code>
          </div>
          
          <button 
            className="switch-btn"
            onClick={() => setUserType(null)}
          >
            ← Back to Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      <div className="agent-header">
        <span className="agent-badge">🤖 AGENT MODE</span>
        <button className="back-btn" onClick={() => setUserType(null)}>←</button>
      </div>
      
      <h2>🪙 COIN FLIP</h2>
      <p className="subtitle">50/50 • 2x Payout • Autonomous Play</p>
      
      <div className="player-balance">
        <span>AGENT BALANCE</span>
        <strong>{balance.toFixed(4)} SOL</strong>
        <code className="wallet-addr">{publicKey?.toBase58().slice(0, 8)}...</code>
      </div>

      <div className="bet-section">
        <label>BET AMOUNT</label>
        <div className="bet-presets">
          {[0.001, 0.01, 0.05, 0.1].map(a => (
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
      </div>

      {error && (
        <div className="error-message">⚠️ {error}</div>
      )}

      <button
        className={`flip-btn ${flipping ? 'spinning' : ''}`}
        onClick={handleFlip}
        disabled={flipping || bet > balance}
      >
        {flipping ? '🪙 FLIPPING...' : '🪙 FLIP COIN'}
      </button>

      {result && !flipping && (
        <div className={`result ${result.win ? 'win' : 'loss'}`}>
          <span>{result.win ? '🎉' : '😢'}</span>
          <h3>{result.win ? 'AGENT WON!' : 'AGENT LOST!'}</h3>
          <p>{result.win ? '+' : '-'}{result.amount} SOL</p>
        </div>
      )}
    </div>
  );
}
