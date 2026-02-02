import { useState } from 'react';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

const PROGRAM_ID = new PublicKey('2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG');
const HOUSE_WALLET = new PublicKey('8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ');

// Instruction discriminators
const INITIALIZE_DISCRIMINATOR = new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]);
const FLIP_DISCRIMINATOR = new Uint8Array([24, 243, 78, 161, 192, 246, 102, 103]);

export function CoinFlip() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  const [bet, setBet] = useState(0.01);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{win: boolean; amount: number; tx?: string} | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Check if game is initialized
  const checkGameInitialized = async (): Promise<boolean> => {
    if (!connection) return false;
    try {
      const [gamePda] = PublicKey.findProgramAddressSync([Buffer.from('game')], PROGRAM_ID);
      const account = await connection.getAccountInfo(gamePda);
      return account !== null;
    } catch {
      return false;
    }
  };

  // Initialize game account
  const initializeGame = async () => {
    if (!publicKey || !sendTransaction || !connection) {
      setError('Wallet not connected');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Derive game PDA
      const [gamePda] = PublicKey.findProgramAddressSync([Buffer.from('game')], PROGRAM_ID);
      
      // Create initialize instruction
      const initData = Buffer.from(INITIALIZE_DISCRIMINATOR);
      
      const initIx = new TransactionInstruction({
        keys: [
          { pubkey: gamePda, isSigner: true, isWritable: true },
          { pubkey: HOUSE_WALLET, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: initData,
      });

      const tx = new Transaction().add(initIx);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      
      console.log('Game initialized:', signature);
      setError(null);
    } catch (err: any) {
      console.error('Initialize failed:', err);
      setError('Failed to initialize game: ' + err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  // Fetch balance
  const fetchBalance = async () => {
    if (!publicKey || !connection) return;
    try {
      const lamports = await connection.getBalance(publicKey, 'confirmed');
      setBalance(lamports / 1e9);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    }
  };

  // Create flip instruction
  const createFlipIx = (player: PublicKey, amount: number) => {
    const [gamePda] = PublicKey.findProgramAddressSync([Buffer.from('game')], PROGRAM_ID);
    const amountLamports = Math.floor(amount * 1e9);
    const amountBuffer = Buffer.allocUnsafe(8);
    amountBuffer.writeBigUInt64LE(BigInt(amountLamports), 0);
    const data = Buffer.concat([FLIP_DISCRIMINATOR, amountBuffer]);

    return new TransactionInstruction({
      keys: [
        { pubkey: gamePda, isSigner: false, isWritable: true },
        { pubkey: HOUSE_WALLET, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: data,
    });
  };

  const handleFlip = async () => {
    if (!publicKey || !sendTransaction || !connection) {
      setError('Wallet not connected');
      return;
    }

    if (bet > balance) {
      setError('Insufficient balance');
      return;
    }

    // Check if game is initialized
    const isInitialized = await checkGameInitialized();
    if (!isInitialized) {
      setError('Game not initialized. Click "Initialize Game" first.');
      return;
    }

    setFlipping(true);
    setError(null);

    try {
      const tx = new Transaction().add(createFlipIx(publicKey, bet));
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Check transaction result
      const txInfo = await connection.getTransaction(signature, { commitment: 'confirmed' });
      
      if (txInfo?.meta?.err) {
        setError('Transaction failed: ' + JSON.stringify(txInfo.meta.err));
        setFlipping(false);
        return;
      }

      // Parse logs
      let isWin = false;
      if (txInfo?.meta?.logMessages) {
        for (const log of txInfo.meta.logMessages) {
          if (log.includes('WIN')) { isWin = true; break; }
          if (log.includes('LOSS')) { isWin = false; break; }
        }
      }

      setResult({ win: isWin, amount: bet, tx: signature });
      fetchBalance();
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setFlipping(false);
    }
  };

  if (!connected) {
    return (
      <div className="game-panel">
        <h2>🪙 COIN FLIP</h2>
        <p>50/50 • Double or Nothing • Smart Contract</p>
        <div className="connect-box">
          <span className="pixel-icon">👾</span>
          <h3>CONNECT WALLET TO PLAY</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      <h2>🪙 COIN FLIP</h2>
      <p>50/50 • Double or Nothing • Smart Contract</p>
      
      <div className="player-balance">
        <span>YOUR BALANCE</span>
        <strong>{balance.toFixed(4)} SOL</strong>
      </div>

      {/* Initialize Button */}
      <button
        className="init-btn"
        onClick={initializeGame}
        disabled={isInitializing}
        style={{marginBottom: '20px', background: '#00ff88', color: '#000'}}
      >
        {isInitializing ? '⏳ INITIALIZING...' : '🚀 INITIALIZE GAME'}
      </button>

      <div className="bet-section">
        <label>BET AMOUNT</label>
        <div className="bet-presets">
          {[0.01, 0.05, 0.1].map(a => (
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

      {error && <div className="error-message">⚠️ {error}</div>}

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
          <h3>{result.win ? 'YOU WON!' : 'YOU LOST!'}</h3>
          <p>{result.win ? '+' : '-'}{result.amount} SOL</p>
        </div>
      )}
    </div>
  );
}
