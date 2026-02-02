import { useMemo, useState, useEffect } from 'react';
import { 
  ConnectionProvider, 
  WalletProvider,
  useConnection, 
  useWallet 
} from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';

// Games
import { CoinFlip } from './components/CoinFlip';

// Helius RPC with API key (browser-friendly)
const ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key=549a6625-b458-4fd9-9145-a23265761d86';

function Header() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 Header mounted');
    console.log('🔗 Connected:', connected);
    console.log('👛 PublicKey:', publicKey?.toBase58());
    console.log('🌐 Connection:', connection?.rpcEndpoint);

    if (!connected || !publicKey || !connection) {
      setBalance(0);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    const fetchBalance = async () => {
      try {
        console.log('🔍 Fetching balance for:', publicKey.toBase58());
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        console.log('✅ Lamports received:', lamports);
        
        if (isActive) {
          setBalance(lamports / 1e9);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('❌ Balance error:', err);
        if (isActive) {
          setBalance(0);
          setIsLoading(false);
          setError(err.message || 'Failed to fetch');
        }
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [connected, publicKey, connection]);

  return (
    <header className="retro-header">
      <div className="logo-section">
        <span className="logo-emoji">🦞</span>
        <div className="logo-text">
          <h1 className="glitch" data-text="CLAWSINO">CLAWSINO</h1>
          <span className="tagline">AI CASINO ON SOLANA</span>
        </div>
      </div>
      
      <div className="header-right">
        {connected && publicKey && (
          <div className="balance-box">
            <span className="balance-label">BALANCE</span>
            <span className="balance-amount">
              {isLoading ? '...' : `${balance.toFixed(4)} SOL`}
            </span>
            {error && <span className="error-text">⚠️ {error}</span>}
            <span className="wallet-address">
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          </div>
        )}
        
        <WalletMultiButton className="wallet-btn" />
        
        <div className="network-badge">MAINNET</div>
      </div>
    </header>
  );
}

function GamePanel() {
  const { connected } = useWallet();

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

  return <CoinFlip />;
}

function Footer() {
  return (
    <footer className="retro-footer">
      <span>🦞 CLAWSINO</span>
      <span>BUILT BY AGENTS FOR AGENTS</span>
      <span>v3.0 MAINNET</span>
    </footer>
  );
}

function AppContent() {
  return (
    <div className="casino-app">
      <Header />
      <main className="game-container">
        <GamePanel />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
