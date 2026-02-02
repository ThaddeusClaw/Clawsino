import { useWallet } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

export function Slots() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="game-panel">
        <h2>7️⃣ SLOTS</h2>
        <p>Match 3 symbols to win</p>
        <div className="connect-box">
          <span className="pixel-icon">👾</span>
          <h3>CONNECT WALLET TO PLAY</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      <h2>7️⃣ SLOTS</h2>
      <p>Match 3 symbols to win</p>
      <div className="connect-box">
        <span className="pixel-icon">7️⃣</span>
        <h3>COMING SOON</h3>
        <p>Slots game under development</p>
      </div>
    </div>
  );
}
