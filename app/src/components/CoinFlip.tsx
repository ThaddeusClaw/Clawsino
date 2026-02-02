import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import './CoinFlip.css';

// Smart Contract Program ID
const PROGRAM_ID = new PublicKey('2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG');
const HOUSE_WALLET = new PublicKey('8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ');

// IDL (simplified - will be loaded from file in production)
const IDL = {
  "address": "2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG",
  "metadata": {"name": "coin_flip", "version": "0.1.0", "spec": "0.1.0"},
  "instructions": [
    {
      "name": "flip",
      "accounts": [
        {"name": "game", "writable": true},
        {"name": "house", "writable": true},
        {"name": "player", "writable": true, "signer": true},
        {"name": "system_program", "address": "11111111111111111111111111111111"}
      ],
      "args": [{"name": "amount", "type": "u64"}]
    }
  ],
  "accounts": [{"name": "Game"}],
  "errors": [
    {"code": 6000, "name": "GamePaused", "msg": "Game is paused"},
    {"code": 6001, "name": "BelowMinBet", "msg": "Below minimum bet"},
    {"code": 6002, "name": "AboveMaxBet", "msg": "Above maximum bet"},
    {"code": 6003, "name": "ExceedsHouseLimit", "msg": "Bet exceeds 10% of house"},
    {"code": 6004, "name": "InsufficientHouseFunds", "msg": "Insufficient house funds"}
  ]
};

export function CoinFlip() {
  const { publicKey, wallet, connected } = useWallet();
  const { connection } = useConnection();
  const [program, setProgram] = useState<Program | null>(null);
  
  const [bet, setBet] = useState(0.01);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{win: boolean; amount: number; tx?: string} | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize Anchor Program
  useEffect(() => {
    if (!wallet || !publicKey || !connection) {
      setProgram(null);
      return;
    }

    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );

    const prog = new Program(IDL as any, provider);
    setProgram(prog);
  }, [wallet, publicKey, connection]);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connection) return;
    try {
      const lamports = await connection.getBalance(publicKey, 'confirmed');
      setBalance(lamports / 1e9);
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
    if (!publicKey || !program || !connection) {
      setError('Wallet not connected');
      return;
    }

    if (bet > balance) {
      setError('Insufficient balance');
      return;
    }

    setFlipping(true);
    setError(null);

    try {
      // Derive game account PDA
      const [gamePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('game')],
        PROGRAM_ID
      );

      const betLamports = Math.floor(bet * 1e9);

      // Call smart contract flip instruction
      const tx = await program.methods
        .flip(new BN(betLamports))
        .accounts({
          game: gamePda,
          house: HOUSE_WALLET,
          player: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Transaction:', tx);

      // Wait for confirmation and check result
      await connection.confirmTransaction(tx, 'confirmed');

      // Fetch transaction details to see if won
      // For now, we'll simulate the result based on the contract's randomness
      // In production, you'd listen to the FlipResult event
      const isWin = Math.random() > 0.5; // Temporary - contract decides real result
      
      setResult({ win: isWin, amount: bet, tx });
      fetchBalance();
      
    } catch (err: any) {
      console.error('Flip failed:', err);
      
      // Parse Anchor errors
      if (err.message?.includes('GamePaused')) {
        setError('Game is temporarily paused');
      } else if (err.message?.includes('BelowMinBet')) {
        setError('Bet too small (min 0.001 SOL)');
      } else if (err.message?.includes('AboveMaxBet')) {
        setError('Bet too large (max 0.1 SOL)');
      } else if (err.message?.includes('ExceedsHouseLimit')) {
        setError('Bet exceeds house limit (10% rule)');
      } else if (err.message?.includes('InsufficientHouseFunds')) {
        setError('House has insufficient funds for payout');
      } else {
        setError(err.message || 'Transaction failed');
      }
    } finally {
      setFlipping(false);
    }
  };

  if (!connected) {
    return (
      <div className="game-panel">
        <h2>🪙 COIN FLIP</h2>
        <p>50/50 • Double or Nothing • Automated Payouts</p>
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
      <p>50/50 • Double or Nothing • Automated Payouts</p>
      
      <div className="player-balance">
        <span>YOUR BALANCE</span>
        <strong>{balance.toFixed(4)} SOL</strong>
      </div>

      <div className="bet-section">
        <label>BET AMOUNT</label>
        <div className="bet-presets">
          {[0.01, 0.05, 0.1, 0.5].map(a => (
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
          max={Math.min(balance, 0.1)}
          value={bet}
          onChange={(e) => setBet(parseFloat(e.target.value) || 0)}
          disabled={flipping}
        />
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <button
        className={`flip-btn ${flipping ? 'spinning' : ''}`}
        onClick={handleFlip}
        disabled={flipping || bet > balance || bet <= 0 || bet > 0.1}
      >
        {flipping ? '🪙 FLIPPING...' : result?.win ? '🎉 WIN! AGAIN?' : '🪙 FLIP COIN'}
      </button>

      {result && !flipping && (
        <div className={`result ${result.win ? 'win' : 'loss'}`}>
          <span>{result.win ? '🎉' : '😢'}</span>
          <h3>{result.win ? 'YOU WON!' : 'YOU LOST!'}</h3>
          <p>{result.win ? '+' : '-'}{result.amount} SOL</p>
          {result.tx && (
            <a 
              href={`https://solscan.io/tx/${result.tx}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="tx-link"
            >
              View Transaction ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
