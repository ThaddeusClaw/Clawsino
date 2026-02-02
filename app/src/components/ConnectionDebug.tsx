import { useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

// Debug component to log connection details
export const ConnectionDebug = () => {
  const { connection } = useConnection();
  const { publicKey, wallet } = useWallet();

  useEffect(() => {
    console.log('=== CONNECTION DEBUG ===');
    console.log('RPC Endpoint:', connection?.rpcEndpoint);
    console.log('Public Key:', publicKey?.toBase58());
    console.log('Wallet Name:', wallet?.adapter?.name);
    console.log('Wallet Connected:', !!publicKey);
    console.log('=======================');
    
    // Test the connection
    if (publicKey && connection) {
      connection.getBalance(publicKey).then(bal => {
        console.log('✅ Direct balance check:', bal / 1e9, 'SOL');
      }).catch(err => {
        console.error('❌ Direct balance check failed:', err);
      });
    }
  }, [connection, publicKey, wallet]);

  return null; // This component doesn't render anything
};
