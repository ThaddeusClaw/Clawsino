import { useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { CoinFlip } from './components/CoinFlip';
import { DiceRoll } from './components/DiceRoll';
import { Roulette } from './components/Roulette';
import { Crash } from './components/Crash';
import { Slots } from './components/Slots';
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';

type GameType = 'coinflip' | 'dice' | 'roulette' | 'crash' | 'slots';

const GAMES: { id: GameType; name: string; icon: string }[] = [
  { id: 'coinflip', name: 'Coin Flip', icon: '🪙' },
  { id: 'dice', name: 'Dice', icon: '🎲' },
  { id: 'roulette', name: 'Roulette', icon: '🎰' },
  { id: 'crash', name: 'Crash', icon: '📈' },
  { id: 'slots', name: 'Slots', icon: '🎰' },
];

function App() {
  const [activeGame, setActiveGame] = useState<GameType>('coinflip');
  
  const endpoint = useMemo(() => 'http://localhost:8899', []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

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
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="casino-app">
            <nav className="game-nav">
              <div className="logo">🎰 Agent Casino</div>
              <div className="game-tabs">
                {GAMES.map((game) => (
                  <button 
                    key={game.id}
                    className={activeGame === game.id ? 'active' : ''}
                    onClick={() => setActiveGame(game.id)}
                  >
                    {game.icon} {game.name}
                  </button>
                ))}
              </div>
            </nav>
            <main className="game-container">
              {renderGame()}
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;