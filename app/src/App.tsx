import { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { CoinFlip } from './components/CoinFlip';
import { DiceRoll } from './components/DiceRoll';
import { Roulette } from './components/Roulette';
import { Crash } from './components/Crash';
import { Slots } from './components/Slots';
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';

type GameType = 'coinflip' | 'dice' | 'roulette' | 'crash' | 'slots';

const GAMES: { id: GameType; name: string; icon: string }[] = [
  { id: 'coinflip', name: 'COIN FLIP', icon: '🪙' },
  { id: 'dice', name: 'DICE', icon: '🎲' },
  { id: 'roulette', name: 'ROULETTE', icon: '🎰' },
  { id: 'crash', name: 'CRASH', icon: '📈' },
  { id: 'slots', name: 'SLOTS', icon: '7️⃣' },
];

// CRITICAL: Use RPC that allows browser requests
// Ankr provides public Solana RPC with CORS support
const MAINNET_RPC = 'https://rpc.ankr.com/solana';

function App() {
  const [activeGame, setActiveGame] = useState<GameType>('coinflip');
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    console.log('%c🦞 CLAWSINO v2.0', 'color: #ff0040; font-size: 24px; font-weight: bold;');
    console.log('%cNetwork: MAINNET', 'color: #00ff88; font-size: 14px;');
    console.log('%cRPC: ' + MAINNET_RPC, 'color: #888; font-size: 12px;');
    setIsLoaded(true);
  }, []);

  const endpoint = useMemo(() => {
    console.log('🔗 Connecting to MAINNET...');
    return MAINNET_RPC;
  }, []);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  const renderGame = () => {
    switch (activeGame) {
      case 'coinflip': return <CoinFlip />;
      case 'dice': return <DiceRoll />;
      case 'roulette': return <Roulette />;
      case 'crash': return <Crash />;
      case 'slots': return <Slots />;
      default: return <CoinFlip />;
    }
  };

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="pixel-loader">
          <span>🦞</span>
          <p>LOADING CLAWSINO...</p>
        </div>
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="casino-app retro-theme">
            <header className="retro-header">
              <div className="logo-section">
                <span className="logo-emoji">🦞</span>
                <div className="logo-text">
                  <h1 className="glitch" data-text="CLAWSINO">CLAWSINO</h1>
                  <span className="tagline">AI CASINO ON SOLANA</span>
                </div>
              </div>
              <div className="header-stats">
                <WalletMultiButton />
                <div className="stat-pill">
                  <span className="stat-label">NETWORK</span>
                  <span className="stat-value mainnet">MAINNET</span>
                </div>
              </div>
            </header>
            
            <nav className="retro-nav">
              {GAMES.map((game) => (
                <button 
                  key={game.id}
                  className={`pixel-btn ${activeGame === game.id ? 'active' : ''}`}
                  onClick={() => setActiveGame(game.id)}
                >
                  <span className="btn-icon">{game.icon}</span>
                  <span className="btn-text">{game.name}</span>
                </button>
              ))}
            </nav>
            
            <main className="game-container">
              {renderGame()}
            </main>
            
            <footer className="retro-footer">
              <div className="footer-content">
                <span className="footer-logo">🦞 CLAWSINO</span>
                <span className="footer-text">BUILT BY AGENTS FOR AGENTS</span>
                <span className="footer-version">v2.0 MAINNET</span>
              </div>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
