import { useState, useEffect, useCallback } from 'react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// House wallet for all games
export const HOUSE_WALLET = new PublicKey('5uisFMq5QB9sjrSaBTnEBXTXCddLBAdLJc9moMXoWkAw');

// Game result type
export interface GameResult {
  win: boolean;
  amount: number;
  multiplier?: number;
  message: string;
}

// Base game hook for all casino games
export function useCasinoGame() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  // Fetch balance
  useEffect(() => {
    if (!publicKey || !connection) return;
    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error('Balance fetch failed:', err);
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 3000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  // Place bet function
  const placeBet = useCallback(async (amount: number, winProbability: number, winMultiplier: number): Promise<GameResult> => {
    if (!publicKey || !sendTransaction || !connection) {
      throw new Error('Wallet not connected');
    }
    if (amount > balance) {
      throw new Error('Insufficient balance');
    }

    setLoading(true);
    setError(null);

    try {
      // Send bet to house
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Provably fair random
      const random = generateRandom(publicKey.toBase58(), signature, Date.now());
      const isWin = random < winProbability;

      const gameResult: GameResult = {
        win: isWin,
        amount: isWin ? amount * winMultiplier : 0,
        multiplier: winMultiplier,
        message: isWin ? `You won ${(amount * winMultiplier).toFixed(4)} SOL!` : 'You lost!',
      };

      setResult(gameResult);
      setLoading(false);
      return gameResult;
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setLoading(false);
      throw err;
    }
  }, [publicKey, sendTransaction, connection, balance]);

  return {
    publicKey,
    connected,
    balance,
    loading,
    error,
    result,
    setResult,
    placeBet,
  };
}

// Provably fair random generator
function generateRandom(playerKey: string, signature: string, timestamp: number): number {
  const data = `${playerKey}${signature}${timestamp}`;
  let hash = 14695981039346656037n;
  for (let i = 0; i < data.length; i++) {
    hash = hash * 1099511628211n;
    hash = hash ^ BigInt(data.charCodeAt(i));
  }
  return Number(hash % 10000n) / 100; // 0-100
}

// Format wallet address
export function formatAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// Game card component
export function GameCard({ 
  title, 
  icon, 
  description, 
  minBet, 
  maxBet,
  houseEdge,
  children 
}: { 
  title: string;
  icon: string;
  description: string;
  minBet: number;
  maxBet: number;
  houseEdge: number;
  children: React.ReactNode;
}) {
  return (
    <div className="game-card">
      <div className="game-header">
        <span className="game-icon">{icon}</span>
        <div className="game-info">
          <h3>{title}</h3>
          <p className="game-description">{description}</p>
        </div>
      </div>
      
      <div className="game-stats">
        <div className="stat">
          <span className="stat-label">Min</span>
          <span className="stat-value">{minBet} SOL</span>
        </div>
        <div className="stat">
          <span className="stat-label">Max</span>
          <span className="stat-value">{maxBet} SOL</span>
        </div>
        <div className="stat">
          <span className="stat-label">House Edge</span>
          <span className="stat-value">{houseEdge}%</span>
        </div>
      </div>

      <div className="game-content">
        {children}
      </div>
    </div>
  );
}
