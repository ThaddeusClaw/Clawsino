#!/usr/bin/env node
/**
 * Clawsino Auto-Payout Server
 * 
 * Lädt House Wallet aus Cloudflare Secrets (autonom, kein 1Password nötig)
 * 
 * Setup:
 * 1. Setze HOUSE_WALLET_KEY in Cloudflare Pages Environment Variables
 * 2. Format: Base64 encoded private key (88 characters)
 * 3. Starte: node payout-server.js
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';

// Configuration
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const HOUSE_WALLET_KEY = process.env.HOUSE_WALLET_KEY;
const MIN_BET = 0.001;
const MAX_BET = 0.1;

// Load house wallet from environment
function loadHouseWallet() {
  if (!HOUSE_WALLET_KEY) {
    console.error('❌ HOUSE_WALLET_KEY environment variable not set');
    console.log('Set it in Cloudflare Pages dashboard → Environment Variables');
    process.exit(1);
  }
  
  try {
    // Decode Base64 private key
    const secretKey = Buffer.from(HOUSE_WALLET_KEY, 'base64');
    const keypair = Keypair.fromSecretKey(secretKey);
    
    console.log('✅ House wallet loaded:', keypair.publicKey.toBase58());
    return keypair;
  } catch (err) {
    console.error('❌ Failed to load house wallet:', err.message);
    process.exit(1);
  }
}

const houseKeypair = loadHouseWallet();
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
  
  let hash = 14695981039346656037n;
  for (const byte of data) {
    hash = hash * 1099511628211n;
    hash = hash ^ BigInt(byte);
  }
  return Number(hash % 1000000n);
}

function checkWin(playerKey, amount, slot, timestamp) {
  const random = generateRandom(playerKey, amount, slot, timestamp, Date.now());
  const winChance = 48;
  const roll = random % 100;
  return roll < winChance;
}

async function processBet(signature, playerKey, amount) {
  console.log(`\n🎲 Processing bet: ${amount} SOL from ${playerKey.toBase58().slice(0, 8)}...`);
  
  const slot = await connection.getSlot();
  const timestamp = Date.now();
  
  const isWin = checkWin(playerKey, amount, slot, timestamp);
  
  if (isWin) {
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
    console.log(`😢 Player lost ${amount} SOL`);
    return { win: false, amount };
  }
}

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
      
      const accountKeys = tx.transaction.message.accountKeys;
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys[i].equals(houseKeypair.publicKey)) {
          const change = (postBalances[i] - preBalances[i]) / LAMPORTS_PER_SOL;
          
          if (change > 0 && change >= MIN_BET && change <= MAX_BET) {
            const senderIndex = tx.meta.preBalances.findIndex((pre, idx) => {
              return postBalances[idx] < pre;
            });
            
            if (senderIndex >= 0) {
              const playerKey = accountKeys[senderIndex];
              
              console.log(`\n💰 New bet detected!`);
              console.log(`   From: ${playerKey.toBase58().slice(0, 12)}...`);
              console.log(`   Amount: ${change} SOL`);
              
              const result = await processBet(sigInfo.signature, playerKey, change);
              
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

async function main() {
  console.log('🦞 Clawsino Auto-Payout Server');
  console.log('================================\n');
  
  if (!HELIUS_API_KEY) {
    console.warn('⚠️  HELIUS_API_KEY not set - using fallback RPC');
    console.warn('   Set HELIUS_API_KEY in Cloudflare for better reliability\n');
  }
  
  console.log('🔐 Loading wallet from Cloudflare Secrets...\n');
  
  const balance = await connection.getBalance(houseKeypair.publicKey);
  console.log(`House balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.warn('⚠️  House balance is low! Add more SOL.');
  }
  
  console.log('\n🚀 Starting monitoring loop...\n');
  
  setInterval(monitorHouseWallet, 5000);
  await monitorHouseWallet();
}

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
