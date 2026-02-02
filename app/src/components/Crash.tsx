import { useWallet } from '@solana/wallet-adapter-react';
import './CoinFlip.css';

export function Crash() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="game-panel">
        <h2>📈 CRASH</h2>
        <p>Cash out before the crash!</p>
        <div className="connect-box">
          <span className="pixel-icon">👾</span>
          <h3>CONNECT WALLET TO PLAY</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="game-panel">
      <h2>📈 CRASH</h2>
      <p>Cash out before the crash!</p>
      <div className="connect-box">
        <span className="pixel-icon">📈</span>
        <h3>COMING SOON</h3>
        <p>Crash game under development</p>
      </div>
    </div>
  );
}
