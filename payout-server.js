#!/usr/bin/env node
/**
 * Clawsino Auto-Payout Server
 * 
 * Monitors House Wallet for incoming bets and automatically processes payouts
 * based on provably fair randomness.
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Configuration
const RPC_URL = process.env.SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY';
const HOUSE_WALLET_PATH = process.env.HOUSE_WALLET_PATH || './house-wallet.json';
const MIN_BET = 0.001; // SOL
const MAX_BET = 0.1;   // SOL
const HOUSE_EDGE = 0.02; // 2%

// Load house wallet
let houseKeypair;
try {
  const secretKey = JSON.parse(fs.readFileSync(HOUSE_WALLET_PATH, 'utf8'));
  houseKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log('✅ House wallet loaded:', houseKeypair.publicKey.toBase58());
} catch (err) {
  console.error('❌ Failed to load house wallet:', err.message);
  console.log('Creating new house wallet...');
  houseKeypair = Keypair.generate();
  fs.writeFileSync(HOUSE_WALLET_PATH, JSON.stringify(Array.from(houseKeypair.secretKey)));
  console.log('✅ New house wallet created:', houseKeypair.publicKey.toBase58());
  console.log('⚠️  FUND THIS WALLET BEFORE STARTING!');
  process.exit(1);
}

const connection = new Connection(RPC_URL, 'confirmed');
const processedSignatures = new Set();

// Provably fair randomness
function generateRandom(playerKey, slot, timestamp, nonce) {
  const data = Buffer.concat([
    Buffer.from(playerKey.toBytes()),
    Buffer.from(slot.toString()),
    Buffer.from(timestamp.toString()),
    Buffer.from(nonce.toString())
  ]);
  
  // Simple hash
  let hash = 14695981039346656037n;
  for (const byte of data) {
    hash = hash * 1099511628211n;
    hash = hash ^ BigInt(byte);
  }
  return Number(hash % 1000000n); // 0-999999
}

// Check if player won
function checkWin(playerKey, amount, slot, timestamp) {
  const random = generateRandom(playerKey, slot, timestamp, Date.now());
  const winChance = 48; // 48% win rate (2% house edge)
  const roll = random % 100;
  return roll < winChance;
}

// Process a single bet
async function processBet(signature, playerKey, amount) {
  console.log(`\n🎲 Processing bet: ${amount} SOL from ${playerKey.toBase58().slice(0, 8)}...`);
  
  const slot = await connection.getSlot();
  const timestamp = Date.now();
  
  const isWin = checkWin(playerKey, amount, slot, timestamp);
  
  if (isWin) {
    // Player wins: Send 2x back
    const payout = amount * 2 * LAMPORTS_PER_SOL;
    
    console.log(`🎉 PLAYER WINS! Sending ${amount * 2} SOL payout...`);
    
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: houseKeypair.publicKey,
          toPubkey: playerKey,
          lamports: Math.floor(payout),
        })
      );
      
      const sig = await connection.sendTransaction(transaction, [houseKeypair]);
      await connection.confirmTransaction(sig, 'confirmed');
      
      console.log(`✅ Payout sent: ${sig}`);
      return { win: true, payout: amount * 2, tx: sig };
    } catch (err) {
      console.error('❌ Payout failed:', err.message);
      return { win: true, payout: 0, error: err.message };
    }
  } else {
    // Player loses: House keeps it
    console.log(`😢 Player lost ${amount} SOL`);
    return { win: false, amount };
  }
}

// Monitor house wallet for new bets
async function monitorHouseWallet() {
  console.log('\n👁️  Monitoring house wallet for bets...');
  console.log(`House: ${houseKeypair.publicKey.toBase58()}`);
  
  try {
    const signatures = await connection.getSignaturesForAddress(
      houseKeypair.publicKey,
      { limit: 10 }
    );
    
    for (const sigInfo of signatures) {
      if (processedSignatures.has(sigInfo.signature)) continue;
      
      const tx = await connection.getTransaction(sigInfo.signature, {
        commitment: 'confirmed',
      });
      
      if (!tx || !tx.meta) continue;
      
      // Check if this is an incoming transfer (to house)
      const accountKeys = tx.transaction.message.accountKeys;
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys[i].equals(houseKeypair.publicKey)) {
          const change = (postBalances[i] - preBalances[i]) / LAMPORTS_PER_SOL;
          
          // Incoming transfer (positive change)
          if (change > 0 && change >= MIN_BET && change <= MAX_BET) {
            // Find sender
            const senderIndex = tx.meta.preBalances.findIndex((pre, idx) => {
              return postBalances[idx] < pre; // Their balance decreased
            });
            
            if (senderIndex >= 0) {
              const playerKey = accountKeys[senderIndex];
              
              console.log(`\n💰 New bet detected!`);
              console.log(`   From: ${playerKey.toBase58().slice(0, 12)}...`);
              console.log(`   Amount: ${change} SOL`);
              
              // Process the bet
              const result = await processBet(sigInfo.signature, playerKey, change);
              
              // Log result
              const logEntry = {
                timestamp: new Date().toISOString(),
                signature: sigInfo.signature,
                player: playerKey.toBase58(),
                amount: change,
                result: result.win ? 'WIN' : 'LOSS',
                payout: result.payout || 0,
                payoutTx: result.tx || null,
              };
              
              fs.appendFileSync('./bets.log', JSON.stringify(logEntry) + '\n');
            }
          }
        }
      }
      
      processedSignatures.add(sigInfo.signature);
    }
  } catch (err) {
    console.error('❌ Monitor error:', err.message);
  }
}

// Main loop
async function main() {
  console.log('🦞 Clawsino Auto-Payout Server');
  console.log('================================\n');
  
  // Check house balance
  const balance = await connection.getBalance(houseKeypair.publicKey);
  console.log(`House balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.warn('⚠️  House balance is low! Add more SOL.');
  }
  
  console.log('\n🚀 Starting monitoring loop...\n');
  
  // Run every 5 seconds
  setInterval(monitorHouseWallet, 5000);
  
  // Initial check
  await monitorHouseWallet();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
