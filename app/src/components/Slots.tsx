import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './Slots.css';

const HOUSE_WALLET = new PublicKey('uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD');

const SYMBOLS = ['🍒', '🍋', '🍊', 'BAR', '7️⃣'];
const PAYOUTS = [2, 3, 5, 10, 50];

export const Slots: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [betAmount, setBetAmount] = useState<number>(0.01);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reels, setReels] = useState<[number, number, number]>([0, 0, 0]);
  const [balance, setBalance] = useState<number>(0);
  const [lastResult, setLastResult] = useState<{ reels: [number, number, number]; win: boolean; payout: number; jackpot: boolean } | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    const bal = await connection.getBalance(publicKey);
    setBalance(bal / 1e9);
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const spin = async () => {
    if (!publicKey || !sendTransaction) return;
    if (betAmount > balance || betAmount > 0.1) {
      alert('Invalid bet amount');
      return;
    }

    setIsSpinning(true);
    
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: HOUSE_WALLET,
          lamports: betAmount * 1e9,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Weighted random for each reel
      const getSymbol = () => {
        const r = Math.random() * 100;
        if (r < 40) return 0; // Cherry
        if (r < 65) return 1; // Lemon
        if (r < 85) return 2; // Orange
        if (r < 97) return 3; // Bar
        return 4; // Seven (3%)
      };

      // Animate
      let spins = 0;
      const interval = setInterval(() => {
        setReels([getSymbol(), getSymbol(), getSymbol()]);
        spins++;
        if (spins > 20) {
          clearInterval(interval);
          
          // Final result
          const finalReels: [number, number, number] = [getSymbol(), getSymbol(), getSymbol()];
          setReels(finalReels);
          
          // Calculate win
          const [a, b, c] = finalReels;
          let payout = 0;
          let isWin = false;
          let isJackpot = false;
          
          if (a === b && b === c) {
            // 3 of a kind
            payout = betAmount * PAYOUTS[a];
            isWin = true;
            if (a === 4) isJackpot = true; // Three 7s = Jackpot!
          } else if (a === b || b === c || a === c) {
            // 2 of a kind = break even
            payout = betAmount;
            isWin = true;
          }
          
          setLastResult({ reels: finalReels, win: isWin, payout, jackpot: isJackpot });
          setIsSpinning(false);
          fetchBalance();
        }
      }, 100);
      
    } catch (err) {
      console.error('Spin failed:', err);
      setIsSpinning(false);
    }
  };

  return (
    <div className="slots-container">
      <div className="header">
        <h1>🎰 Slots</h1>
        <p>Match 3 symbols to win!</p>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span>Balance</span>
          <strong>{balance.toFixed(4)} SOL</strong>
        </div>
      </div>

      <div className="wallet-section">
        <WalletMultiButton className="wallet-button" />
      </div>

      {publicKey && (
        <div className="game-section">
          <div className="slot-machine">
            <div className="reels">
              {reels.map((symbol, i) => (
                <div key={i} className={`reel ${isSpinning ? 'spinning' : ''}`}>
                  {SYMBOLS[symbol]}
                </div>
              ))}
            </div>
          </div>

          <div className="payout-table">
            <h4>Payouts</h4>
            <div className="payouts">
              {SYMBOLS.map((sym, i) => (
                <div key={i} className="payout-row">
                  <span>{sym} {sym} {sym}</span>
                  <span>{PAYOUTS[i]}x</span>
                </div>
              ))}
              <div className="payout-row any-two">
                <span>Any 2 matching</span>
                <span>1x</span>
              </div>
            </div>
          </div>

          <div className="bet-controls">
            <label>Bet Amount (Max: 0.1 SOL)</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max="0.1"
              value={betAmount}
              onChange={(e) => setBetAmount(parseFloat(e.target.value))}
              disabled={isSpinning}
            />

            <button
              className={`spin-btn ${isSpinning ? 'spinning' : ''}`}
              onClick={spin}
              disabled={isSpinning || betAmount > balance}
            >
              {isSpinning ? '🎰 SPINNING...' : '🎰 SPIN!'}
            </button>

            {lastResult && !isSpinning && (
              <div className={`result ${lastResult.win ? 'win' : 'loss'} ${lastResult.jackpot ? 'jackpot' : ''}`}>
                {lastResult.jackpot ? (
                  <>
                    <h2>🎉🎉 JACKPOT! 🎉🎉</h2>
                    <p>Three 7s!</p>
                    <p className="payout">+{lastResult.payout.toFixed(4)} SOL</p>
                  </>
                ) : lastResult.win ? (
                  <>
                    <h3>🎉 YOU WON!</h3>
                    <p>Payout: +{lastResult.payout.toFixed(4)} SOL</p>
                  </>
                ) : (
                  <>
                    <h3>😢 No Match</h3>
                    <p>Try again!</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!publicKey && (
        <div className="connect-prompt">
          <h2>Connect to Play Slots</h2>
          <p>Match symbols and win big!</p>
        </div>
      )}
    </div>
  );
};