import { useWallet } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

export function DiceRoll() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="game-panel">
        <h2>🎲 DICE</h2>
        <p>Roll under/over 50 • 1.98x payout</p>
        <div className="connect-box">
          <span className="pixel-icon">👾</span>
          <h3>CONNECT WALLET TO PLAY</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      <h2>🎲 DICE</h2>
      <p>Roll under/over 50 • 1.98x payout</p>
      <div className="connect-box">
        <span className="pixel-icon">🎲</span>
        <h3>COMING SOON</h3>
        <p>Dice game under development</p>
      </div>
    </div>
  );
}
