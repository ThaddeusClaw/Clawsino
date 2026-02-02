import { useState, useEffect, useCallback } from 'react';
import { 
  Transaction, 
  SystemProgram, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

// House wallet address
const HOUSE_WALLET = new PublicKey('8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ');

// Smart Contract Program ID
const PROGRAM_ID = new PublicKey('2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG');

// Discriminator for 'flip' instruction (from IDL)
const FLIP_DISCRIMINATOR = new Uint8Array([24, 243, 78, 161, 192, 246, 102, 103]);

export function CoinFlip() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  const [bet, setBet] = useState(0.01);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<{win: boolean; amount: number; tx?: string} | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  // Create flip instruction manually (no Anchor needed)
  const createFlipInstruction = (player: PublicKey, amount: number): TransactionInstruction => {
    // Derive game PDA
    const [gamePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('game')],
      PROGRAM_ID
    );

    // Create instruction data: discriminator (8 bytes) + amount (8 bytes as u64)
    const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
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

    setFlipping(true);
    setError(null);

    try {
      // Create transaction with smart contract instruction
      const transaction = new Transaction().add(
        createFlipInstruction(publicKey, bet)
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed:', signature);

      // For now, we'll simulate the win/loss based on transaction success
      // In production, you'd parse the transaction result or listen to events
      // The smart contract decides the outcome, not us
      
      // Check transaction logs to see if won
      const txInfo = await connection.getTransaction(signature, {
        commitment: 'confirmed',
      });
      
      console.log('Transaction info:', txInfo);
      
      // Check if transaction succeeded
      if (txInfo?.meta?.err) {
        console.error('Transaction failed:', txInfo.meta.err);
        setError('Transaction failed: ' + JSON.stringify(txInfo.meta.err));
        setFlipping(false);
        return;
      }
      
      // Parse logs to determine win/loss
      let isWin = false;
      let foundResult = false;
      console.log('Transaction logs:', txInfo?.meta?.logMessages);
      
      if (txInfo?.meta?.logMessages) {
        for (const log of txInfo.meta.logMessages) {
          console.log('Log:', log);
          if (log.includes('WIN')) {
            isWin = true;
            foundResult = true;
            break;
          } else if (log.includes('LOSS')) {
            isWin = false;
            foundResult = true;
            break;
          }
        }
      }
      
      // Check if pre/post balances show a change
      const preBalance = txInfo?.meta?.preBalances?.[0] || 0;
      const postBalance = txInfo?.meta?.postBalances?.[0] || 0;
      console.log('Pre-balance:', preBalance, 'Post-balance:', postBalance);
      
      // If we didn't find a log message, check balance change
      if (!foundResult) {
        // If post > pre + bet, they won (got 2x back)
        const balanceChange = (postBalance - preBalance) / LAMPORTS_PER_SOL;
        console.log('Balance change:', balanceChange);
        if (balanceChange > bet * 0.5) { // They got money back
          isWin = true;
        }
      }

      setResult({ win: isWin, amount: bet, tx: signature });
      fetchBalance();
      
    } catch (err: any) {
      console.error('Flip failed:', err);
      
      // Parse specific errors
      if (err.message?.includes('0x1770')) {
        setError('Game is paused');
      } else if (err.message?.includes('0x1771')) {
        setError('Bet too small (min 0.001 SOL)');
      } else if (err.message?.includes('0x1772')) {
        setError('Bet too large (max 0.1 SOL)');
      } else if (err.message?.includes('0x1773')) {
        setError('Bet exceeds house limit');
      } else if (err.message?.includes('0x1774')) {
        setError('House has insufficient funds');
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
        <p>50/50 • Double or Nothing • Smart Contract</p>
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
      <p>50/50 • Double or Nothing • Smart Contract</p>
      
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
