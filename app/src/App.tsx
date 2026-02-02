import { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
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

// Ankr RPC - allows browser requests
const MAINNET_RPC = 'https://rpc.ankr.com/solana';

// Balance display component
function WalletInfo() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey || !connection) {
      setBalance(null);
      return;
    }

    let active = true;
    
    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, 'confirmed');
        if (active) {
          setBalance(lamports / LAMPORTS_PER_SOL);
        }
      } catch (err) {
        console.error('Balance fetch failed:', err);
        if (active) setBalance(0);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [publicKey, connection]);

  if (!connected) {
    return (
      <div className="wallet-info">
        <WalletMultiButton className="retro-wallet-btn" />
      </div>
    );
  }

  const shortAddr = publicKey?.toBase58().slice(0, 4) + '...' + publicKey?.toBase58().slice(-4);

  return (
    <div className="wallet-info connected">
      <div className="balance-box">
        <span className="balance-label">BALANCE</span>
        <span className="balance-value">{balance?.toFixed(4) || '0.0000'} SOL</span>
        <span className="wallet-addr">{shortAddr}</span>
      </div>
      <WalletMultiButton className="retro-wallet-btn small" />
    </div>
  );
}

function AppContent() {
  const [activeGame, setActiveGame] = useState<GameType>('coinflip');

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

  return (
    <div className="casino-app retro-theme">
      <header className="retro-header">
        <div className="logo-section">
          <span className="logo-emoji">🦞</span>
          <div className="logo-text">
            <h1 className="glitch" data-text="CLAWSINO">CLAWSINO</h1>
            <span className="tagline">AI CASINO ON SOLANA</span>
          </div>
        </div>
        <div className="header-right">
          <WalletInfo />
          <div className="network-badge">MAINNET</div>
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
  );
}

function App() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    setIsReady(true);
  }, []);

  const endpoint = useMemo(() => MAINNET_RPC, []);
  
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  if (!isReady) {
    return (
      <div className="loading-screen">
        <div className="pixel-loader">
          <span>🦞</span>
          <p>LOADING...</p>
        </div>
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
