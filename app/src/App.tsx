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
import { DiceRoll } from './components/DiceRoll';
import { Roulette } from './components/Roulette';
import { Crash } from './components/Crash';
import { Slots } from './components/Slots';

type GameType = 'coinflip' | 'dice' | 'roulette' | 'crash' | 'slots';

const GAMES: { id: GameType; name: string; icon: string }[] = [
  { id: 'coinflip', name: 'COIN FLIP', icon: '🪙' },
  { id: 'dice', name: 'DICE', icon: '🎲' },
  { id: 'roulette', name: 'ROULETTE', icon: '🎰' },
  { id: 'crash', name: 'CRASH', icon: '📈' },
  { id: 'slots', name: 'SLOTS', icon: '7️⃣' },
];

// Use mainnet with fallback
const ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Header Component with Wallet
function Header() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey || !connection) {
      setBalance(0);
      return;
    }

    let isActive = true;
    setIsLoading(true);

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        if (isActive) {
          setBalance(lamports / 1e9);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Balance error:', err);
        if (isActive) {
          setBalance(0);
          setIsLoading(false);
        }
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 3000);

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
          <div className="balance-display">
            <div className="balance-box">
              <span className="balance-label">BALANCE</span>
              <span className="balance-amount">
                {isLoading ? '...' : `${balance.toFixed(4)} SOL`}
              </span>
              <span className="wallet-address">
                {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
              </span>
            </div>
          </div>
        )}
        
        <WalletMultiButton className="wallet-btn" />
        
        <div className="network-pill">
          <span className="network-dot"></span>
          MAINNET
        </div>
      </div>
    </header>
  );
}

// Navigation
function GameNav({ activeGame, onSelect }: { activeGame: GameType; onSelect: (g: GameType) => void }) {
  return (
    <nav className="retro-nav">
      {GAMES.map((game) => (
        <button
          key={game.id}
          className={`pixel-btn ${activeGame === game.id ? 'active' : ''}`}
          onClick={() => onSelect(game.id)}
        >
          <span className="btn-icon">{game.icon}</span>
          <span className="btn-text">{game.name}</span>
        </button>
      ))}
    </nav>
  );
}

// Game Router
function GameContent({ game }: { game: GameType }) {
  switch (game) {
    case 'coinflip': return <CoinFlip />;
    case 'dice': return <DiceRoll />;
    case 'roulette': return <Roulette />;
    case 'crash': return <Crash />;
    case 'slots': return <Slots />;
    default: return <CoinFlip />;
  }
}

// Footer
function Footer() {
  return (
    <footer className="retro-footer">
      <div className="footer-content">
        <span className="footer-logo">🦞 CLAWSINO</span>
        <span className="footer-text">BUILT BY AGENTS FOR AGENTS</span>
        <span className="footer-version">v2.1 MAINNET</span>
      </div>
    </footer>
  );
}

// Main App Content
function AppContent() {
  const [activeGame, setActiveGame] = useState<GameType>('coinflip');

  return (
    <div className="casino-app">
      <Header />
      <GameNav activeGame={activeGame} onSelect={setActiveGame} />
      <main className="game-container">
        <GameContent game={activeGame} />
      </main>
      <Footer />
    </div>
  );
}

// Root App with Providers
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
