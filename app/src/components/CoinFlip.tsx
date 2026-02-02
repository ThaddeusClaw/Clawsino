import { useState, useEffect, useCallback } from 'react';
import { 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  TransactionInstruction
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

const PROGRAM_ID = new PublicKey('2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG');
const HOUSE_WALLET = new PublicKey('8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ');

// Instruction discriminators
const INITIALIZE_DISC = new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]);
const FLIP_DISC = new Uint8Array([24, 243, 78, 161, 192, 246, 102, 103]);

// Helper to convert number to u64 bytes
function numberToU64Bytes(num: number): Uint8Array {
  const arr = new Uint8Array(8);
  const view = new DataView(arr.buffer);
  view.setBigUint64(0, BigInt(num), true); // little-endian
  return arr;
}

// Helper to concatenate Uint8Arrays
function concatArrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

export function CoinFlip() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  const [bet, setBet] = useState(0.01);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{win: boolean; amount: number; tx?: string} | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [gameReady, setGameReady] = useState(false);

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

  // Check if game is initialized
  const checkGameInitialized = useCallback(async (): Promise<boolean> => {
    if (!connection) return false;
    try {
      const [gamePda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('game')], 
        PROGRAM_ID
      );
      const account = await connection.getAccountInfo(gamePda);
      return account !== null;
    } catch {
      return false;
    }
  }, [connection]);

  // Auto-initialize on connect
  useEffect(() => {
    if (!connected || !publicKey || !connection) {
      setGameReady(false);
      return;
    }

    const autoInit = async () => {
      const isInit = await checkGameInitialized();
      if (isInit) {
        setGameReady(true);
        return;
      }

      // Auto-initialize
      setIsInitializing(true);
      try {
        const [gamePda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode('game')], 
          PROGRAM_ID
        );
        
        const initData = INITIALIZE_DISC;
        
        const initIx = new TransactionInstruction({
          keys: [
            { pubkey: gamePda, isSigner: false, isWritable: true },
            { pubkey: HOUSE_WALLET, isSigner: false, isWritable: false },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: initData as any, // Uint8Array works as Buffer-like
        });

        const tx = new Transaction().add(initIx);
        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, 'confirmed');
        
        console.log('Game auto-initialized:', signature);
        setGameReady(true);
      } catch (err: any) {
        console.error('Auto-initialize failed:', err);
        // Don't show error - user can still try to play
      } finally {
        setIsInitializing(false);
      }
    };

    autoInit();
    fetchBalance();
    const interval = setInterval(fetchBalance, 3000);
    return () => clearInterval(interval);
  }, [connected, publicKey, connection, checkGameInitialized, sendTransaction, fetchBalance]);

  // Create flip instruction
  const createFlipIx = (player: PublicKey, amount: number) => {
    const [gamePda] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode('game')], 
      PROGRAM_ID
    );
    const amountLamports = Math.floor(amount * 1e9);
    const amountBytes = numberToU64Bytes(amountLamports);
    const data = concatArrays(FLIP_DISC, amountBytes);

    return new TransactionInstruction({
      keys: [
        { pubkey: gamePda, isSigner: false, isWritable: true },
        { pubkey: HOUSE_WALLET, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: data as any,
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

    if (!gameReady) {
      setError('Game not ready. Please wait for initialization...');
      return;
    }

    setFlipping(true);
    setError(null);

    try {
      const tx = new Transaction().add(createFlipIx(publicKey, bet));
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      const txInfo = await connection.getTransaction(signature, { commitment: 'confirmed' });
      
      if (txInfo?.meta?.err) {
        setError('Transaction failed');
        setFlipping(false);
        return;
      }

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

      {/* Status indicator */}
      <div style={{marginBottom: '15px', color: gameReady ? '#00ff88' : '#ffaa00'}}>
        {isInitializing ? '⏳ Initializing game...' : 
         gameReady ? '✅ Game Ready' : '⚠️ Waiting for game...'}
      </div>

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
        disabled={flipping || bet > balance || !gameReady}
      >
        {flipping ? '🪙 FLIPPING...' : gameReady ? '🪙 FLIP COIN' : '⏳ WAIT...'}
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
