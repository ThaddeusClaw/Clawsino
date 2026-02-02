import { useState } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './Blackjack.css';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface Card {
  suit: string;
  value: string;
  numeric: number;
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      let numeric = 0;
      if (value === 'A') numeric = 11;
      else if (['J', 'Q', 'K'].includes(value)) numeric = 10;
      else numeric = parseInt(value);
      
      deck.push({ suit, value, numeric });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateHand(hand: Card[]): number {
  let sum = 0;
  let aces = 0;
  
  for (const card of hand) {
    sum += card.numeric;
    if (card.value === 'A') aces++;
  }
  
  // Adjust aces from 11 to 1 as needed
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  
  return sum;
}

export function Blackjack() {
  const { connected, balance, loading, error, placeBet: _placeBet } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [result, setResult] = useState<{ win: boolean; message: string; payout: number } | null>(null);

  const startGame = async () => {
    if (!connected || bet > balance) return;
    
    const newDeck = shuffleDeck(createDeck());
    const playerCards = [newDeck.pop()!, newDeck.pop()!];
    const dealerCards = [newDeck.pop()!, newDeck.pop()!];
    
    setDeck(newDeck);
    setPlayerHand(playerCards);
    setDealerHand(dealerCards);
    setGameState('playing');
    setResult(null);
    
    // Check for blackjack
    const playerTotal = calculateHand(playerCards);
    const dealerTotal = calculateHand(dealerCards);
    
    if (playerTotal === 21) {
      if (dealerTotal === 21) {
        finishGame('push', 0, 'Both have Blackjack! Push.');
      } else {
        finishGame('win', bet * 2.5, 'Blackjack! You win 2.5x!');
      }
    }
  };

  const hit = () => {
    if (gameState !== 'playing') return;
    
    const newCard = deck.pop()!;
    const newHand = [...playerHand, newCard];
    setPlayerHand(newHand);
    setDeck(deck);
    
    const total = calculateHand(newHand);
    if (total > 21) {
      finishGame('loss', 0, 'Bust! You lose.');
    }
  };

  const stand = () => {
    if (gameState !== 'playing') return;
    
    // Dealer plays
    let currentDealerHand = [...dealerHand];
    let currentDeck = [...deck];
    
    while (calculateHand(currentDealerHand) < 17) {
      currentDealerHand.push(currentDeck.pop()!);
    }
    
    setDealerHand(currentDealerHand);
    
    const playerTotal = calculateHand(playerHand);
    const dealerTotal = calculateHand(currentDealerHand);
    
    if (dealerTotal > 21) {
      finishGame('win', bet * 2, 'Dealer busts! You win!');
    } else if (dealerTotal > playerTotal) {
      finishGame('loss', 0, `Dealer wins with ${dealerTotal}.`);
    } else if (playerTotal > dealerTotal) {
      finishGame('win', bet * 2, `You win with ${playerTotal}!`);
    } else {
      finishGame('push', bet, 'Push! Bet returned.');
    }
  };

  const finishGame = (outcome: 'win' | 'loss' | 'push', payout: number, message: string) => {
    setGameState('finished');
    setResult({
      win: outcome === 'win',
      message,
      payout
    });
  };

  const reset = () => {
    setGameState('idle');
    setPlayerHand([]);
    setDealerHand([]);
    setResult(null);
  };

  return (
    <GameCard
      title="Blackjack"
      icon="🃏"
      description="Beat the dealer to 21!"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={0.5}
    >
      <div className="blackjack-game">
        <div className="table">
          <div className="dealer-area">
            <h4>Dealer</h4>
            <div className="hand">
              {dealerHand.map((card, idx) => (
                <div key={idx} className={`card ${card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'}`}>
                  {gameState === 'playing' && idx === 1 ? '🂠' : `${card.value}${card.suit}`}
                </div>
              ))}
            </div>
            {gameState !== 'idle' && (
              <div className="hand-value">
                {gameState === 'playing' 
                  ? calculateHand([dealerHand[0]]) + '+?' 
                  : calculateHand(dealerHand)}
              </div>
            )}
          </div>

          <div className="player-area">
            <h4>Your Hand</h4>
            <div className="hand">
              {playerHand.map((card, idx) => (
                <div key={idx} className={`card ${card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'}`}>
                  {card.value}{card.suit}
                </div>
              ))}
            </div>
            {playerHand.length > 0 && (
              <div className="hand-value">{calculateHand(playerHand)}</div>
            )}
          </div>
        </div>

        <div className="bet-controls">
          <input
            type="number"
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            min={0.001}
            max={0.1}
            step={0.001}
            disabled={gameState !== 'idle'}
          />
          <span className="currency">SOL</span>
        </div>

        {gameState === 'idle' && (
          <button 
            className="deal-btn"
            onClick={startGame}
            disabled={!connected || loading || bet > balance}
          >
            🃏 Deal
          </button>
        )}

        {gameState === 'playing' && (
          <div className="game-actions">
            <button className="hit-btn" onClick={hit}>👊 Hit</button>
            <button className="stand-btn" onClick={stand}>✋ Stand</button>
          </div>
        )}

        {gameState === 'finished' && result && (
          <div className={`game-result ${result.win ? 'win' : 'loss'}`}>
            <p>{result.message}</p>
            {result.payout > 0 && (
              <p>Payout: {result.payout.toFixed(4)} SOL</p>
            )}
            <button className="restart-btn" onClick={reset}>
              Play Again
            </button>
          </div>
        )}

        {error && <div className="error">❌ {error}</div>}
        
        {!connected && (
          <div className="connect-prompt">Connect wallet to play</div>
        )}
      </div>
    </GameCard>
  );
}
