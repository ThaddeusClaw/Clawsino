import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

// Simple balance fetch that ALWAYS uses mainnet
async function getBalanceFromMainnet(address: string): Promise<number> {
  try {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address]
      })
    });
    
    const data = await response.json();
    return (data.result?.value || 0) / 1e9;
  } catch {
    return 0;
  }
}

export function SimpleBalance() {
  const wallet = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet.publicKey) {
      setBalance(null);
      return;
    }

    const address = wallet.publicKey.toBase58();
    let cancelled = false;
    
    async function fetchBalance() {
      setLoading(true);
      const bal = await getBalanceFromMainnet(address);
      if (!cancelled) {
        setBalance(bal);
        setLoading(false);
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [wallet.publicKey]);

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
      <span className="balance-value">
        {loading && balance === null ? '...' : `${balance?.toFixed(4) || '0.0000'} SOL`}
      </span>
      <span className="wallet-addr">{shortAddress}</span>
    </div>
  );
}
