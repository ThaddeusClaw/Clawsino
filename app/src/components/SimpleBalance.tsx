import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function SimpleBalance() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.publicKey || !connection) {
      setBalance(null);
      return;
    }

    let cancelled = false;
    
    async function fetchBalance() {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Fetching balance via wallet adapter...');
        const lamports = await connection.getBalance(wallet.publicKey!, 'confirmed');
        
        if (!cancelled) {
          const sol = lamports / LAMPORTS_PER_SOL;
          console.log('✅ Balance:', sol, 'SOL');
          setBalance(sol);
        }
      } catch (err) {
        console.error('❌ Balance fetch error:', err);
        if (!cancelled) {
          setError('Failed to fetch');
          setBalance(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [wallet.publicKey, connection]);

  if (!wallet.connected) {
    return <div className="simple-balance">Connect wallet</div>;
  }

  if (!wallet.publicKey) {
    return <div className="simple-balance">No public key</div>;
  }

  const shortAddress = wallet.publicKey.toBase58().slice(0, 6) + '...' + wallet.publicKey.toBase58().slice(-4);

  return (
    <div className="simple-balance">
      <span className="balance-label">BALANCE:</span>
      <span className={`balance-value ${error ? 'error' : ''}`}>
        {loading && balance === null ? '...' : `${balance?.toFixed(4) || '0.0000'} SOL`}
      </span>
      <span className="wallet-addr">{shortAddress}</span>
      {error && <span className="error-hint">⚠️ {error}</span>}
    </div>
  );
}
