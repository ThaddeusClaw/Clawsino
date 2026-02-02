import { useState } from 'react';
import { useCasinoGame, GameCard } from '../hooks/useCasinoGame';
import './RPS.css';

type Choice = 'rock' | 'paper' | 'scissors';

const CHOICES: Choice[] = ['rock', 'paper', 'scissors'];
const EMOJIS: Record<Choice, string> = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️'
};

function determineWinner(player: Choice, bot: Choice): 'win' | 'loss' | 'tie' {
  if (player === bot) return 'tie';
  if (
    (player === 'rock' && bot === 'scissors') ||
    (player === 'paper' && bot === 'rock') ||
    (player === 'scissors' && bot === 'paper')
  ) {
    return 'win';
  }
  return 'loss';
}

export function RockPaperScissors() {
  const { connected, balance, loading, error } = useCasinoGame();
  const [bet, setBet] = useState(0.01);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'revealed'>('idle');
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [botChoice, setBotChoice] = useState<Choice | null>(null);
  const [result, setResult] = useState<{ outcome: 'win' | 'loss' | 'tie'; payout: number } | null>(null);

  const play = async (choice: Choice) => {
    if (!connected) return;
    
    setPlayerChoice(choice);
    setGameState('playing');
    setBotChoice(null);
    setResult(null);
    
    // Simulate bot thinking
    setTimeout(() => {
      const botPick = CHOICES[Math.floor(Math.random() * 3)];
      const outcome = determineWinner(choice, botPick);
      
      setBotChoice(botPick);
      setGameState('revealed');
      
      let payout = 0;
      if (outcome === 'win') payout = bet * 1.9; // 5% house edge
      else if (outcome === 'tie') payout = bet; // Return bet
      
      setResult({ outcome, payout });
    }, 1500);
  };

  const reset = () => {
    setGameState('idle');
    setPlayerChoice(null);
    setBotChoice(null);
    setResult(null);
  };

  return (
    <GameCard
      title="Rock Paper Scissors"
      icon="✂️"
      description="Classic game with crypto stakes!"
      minBet={0.001}
      maxBet={0.1}
      houseEdge={5}
    >
      <div className="rps-game">
        <div className="battle-arena">
          <div className="player-side">
            <h4>You</h4>
            <div className={`choice-display ${playerChoice || 'hidden'}`}>
              {playerChoice ? EMOJIS[playerChoice] : '❓'}
            </div>
          </div>

          <div className="vs">VS</div>

          <div className="bot-side">
            <h4>Bot</h4>
            <div className={`choice-display ${botChoice || 'hidden'} ${gameState === 'playing' ? 'thinking' : ''}`}>
              {botChoice ? EMOJIS[botChoice] : gameState === 'playing' ? '🤔' : '❓'}
            </div>
          </div>
        </div>

        {gameState === 'idle' && (
          <>
            <div className="choice-buttons">
              {CHOICES.map((choice) => (
                <button
                  key={choice}
                  className="choice-btn"
                  onClick={() => play(choice)}
                  disabled={!connected || loading || bet > balance}
                >
                  <span className="emoji">{EMOJIS[choice]}</span>
                  <span className="label">{choice}</span>
                </button>
              ))}
            </div>

            <div className="bet-controls">
              <input
                type="number"
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
                min={0.001}
                max={0.1}
                step={0.001}
              />
              <span className="currency">SOL</span>
            </div>
          </>
        )}

        {gameState === 'playing' && (
          <div className="thinking">Bot is choosing...</div>
        )}

        {gameState === 'revealed' && result && (
          <div className={`rps-result ${result.outcome}`}>
            <h3>
              {result.outcome === 'win' && '🎉 You Win!'}
              {result.outcome === 'loss' && '😔 You Lose!'}
              {result.outcome === 'tie' && '🤝 Tie!'}
            </h3>
            <p>
              {result.outcome === 'win' && `Payout: ${result.payout.toFixed(4)} SOL`}
              {result.outcome === 'loss' && 'Better luck next time!'}
              {result.outcome === 'tie' && 'Bet returned'}
            </p>
            <button className="play-again-btn" onClick={reset}>
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
