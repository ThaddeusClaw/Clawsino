import { useMemo, useState } from 'react';
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
import { DiceRoll } from './components/DiceRoll';
import { Crash } from './components/Crash';
import { Roulette } from './components/Roulette';
import { Slots } from './components/Slots';
import { Blackjack } from './components/Blackjack';
import { RockPaperScissors } from './components/RockPaperScissors';
import { Plinko } from './components/Plinko';
import { Limbo } from './components/Limbo';
import { WheelOfFortune } from './components/WheelOfFortune';

// Devnet endpoint for testing
const ENDPOINT = 'https://api.devnet.solana.com';

const GAMES = [
  { id: 'coinflip', name: 'Coin Flip', icon: '🪙', component: CoinFlip },
  { id: 'diceroll', name: 'Dice Roll', icon: '🎲', component: DiceRoll },
  { id: 'crash', name: 'Crash', icon: '📈', component: Crash },
  { id: 'roulette', name: 'Roulette', icon: '🎰', component: Roulette },
  { id: 'slots', name: 'Slots', icon: '🎰', component: Slots },
  { id: 'blackjack', name: 'Blackjack', icon: '🃏', component: Blackjack },
  { id: 'rps', name: 'Rock Paper Scissors', icon: '✂️', component: RockPaperScissors },
  { id: 'plinko', name: 'Plinko', icon: '🔴', component: Plinko },
  { id: 'limbo', name: 'Limbo', icon: '🎯', component: Limbo },
  { id: 'wheel', name: 'Wheel of Fortune', icon: '🎡', component: WheelOfFortune },
];

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
        <span className="footer-version">v3.0 | 10 GAMES</span>
      </div>
    </footer>
  );
}

function GameSelector({ selectedGame, onSelectGame }: { selectedGame: string; onSelectGame: (id: string) => void }) {
  return (
    <div className="game-selector">
      <h2 className="selector-title">🎮 SELECT YOUR GAME</h2>
      <div className="games-grid">
        {GAMES.map((game) => (
          <button
            key={game.id}
            className={`game-tile ${selectedGame === game.id ? 'active' : ''}`}
            onClick={() => onSelectGame(game.id)}
          >
            <span className="tile-icon">{game.icon}</span>
            <span className="tile-name">{game.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActiveGame({ gameId }: { gameId: string }) {
  const game = GAMES.find(g => g.id === gameId);
  if (!game) return null;
  
  const GameComponent = game.component;
  return <GameComponent />;
}

function AppContent() {
  const [selectedGame, setSelectedGame] = useState('coinflip');

  return (
    <div className="casino-app retro-theme">
      <Header />
      <main className="game-container">
        <GameSelector selectedGame={selectedGame} onSelectGame={setSelectedGame} />
        <ActiveGame gameId={selectedGame} />
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
