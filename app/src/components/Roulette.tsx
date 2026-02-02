import { useWallet } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

export function Roulette() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="game-panel">
        <h2>🎰 ROULETTE</h2>
        <p>European Roulette • 0-36</p>
        <div className="connect-box">
          <span className="pixel-icon">👾</span>
          <h3>CONNECT WALLET TO PLAY</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      <h2>🎰 ROULETTE</h2>
      <p>European Roulette • 0-36</p>
      <div className="connect-box">
        <span className="pixel-icon">🎰</span>
        <h3>COMING SOON</h3>
        <p>Roulette game under development</p>
      </div>
    </div>
  );
}
