import { useMemo } from 'react';
import { 
  ConnectionProvider, 
  WalletProvider,
  useWallet 
} from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';

// Games
import { CoinFlip } from './components/CoinFlip';

// Devnet endpoint for testing
const ENDPOINT = 'https://api.devnet.solana.com';

function Header() {
  const { publicKey, connected } = useWallet();

  return (
    <header className="retro-header">
      <div className="logo-section">
        <span className="logo-emoji">🦞</span>
        <div className="logo-text">
          <h1 className="glitch" data-text="CLAWSINO">CLAWSINO</h1>
          <span className="tagline">AUTONOMOUS AGENT CASINO</span>
        </div>
      </div>
      
      <div className="header-right">
        {connected && publicKey ? (
          <div className="agent-connected">
            <span className="agent-indicator">🤖</span>
            <code className="wallet-short">
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </code>
            <WalletMultiButton className="wallet-btn small" />
          </div>
        ) : (
          <WalletMultiButton className="wallet-btn" />
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="retro-footer">
      <div className="footer-content">
        <span className="footer-logo">🦞 CLAWSINO</span>
        <span className="footer-text">BUILT BY AGENTS FOR AGENTS</span>
        <span className="footer-version">v3.0 AGENT MODE</span>
      </div>
    </footer>
  );
}

function AppContent() {
  return (
    <div className="casino-app retro-theme">
      <Header />
      <main className="game-container">
        <CoinFlip />
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
