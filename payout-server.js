#!/usr/bin/env node
/**
 * Clawsino Auto-Payout Server
 * 
 * Laedt House Wallet aus 1Password - nie im Code speichern!
 * 
 * Setup:
 * 1. Stelle sicher dass 1Password CLI installiert ist
 * 2. House Wallet muss in 1Password existieren als "Clawsino House Wallet V2"
 * 3. Starte: OP_PASSWORD=dein_passwort node payout-server.js
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { execSync } from 'child_process';
import fs from 'fs';

// Configuration
const RPC_URL = process.env.SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=af5e5d84-6ce2-4eb9-b096-f4754ca84ba3';
const OP_ITEM_NAME = 'Clawsino House Wallet V2';
const MIN_BET = 0.001;
const MAX_BET = 0.1;

// Load house wallet from 1Password
function loadHouseWallet() {
  try {
    // Get from 1Password
    const opPassword = process.env.OP_PASSWORD;
    if (!opPassword) {
      throw new Error('OP_PASSWORD environment variable required');
    }
    
    // Sign in to 1Password
    const sessionToken = execSync(`echo "${opPassword}" | op signin --account thaddeus --raw`, { encoding: 'utf8' }).trim();
    
    // Get public key
    const publicKey = execSync(`OP_SESSION_thaddeus="${sessionToken}" op item get "${OP_ITEM_NAME}" --field username`, { encoding: 'utf8' }).trim();
    
    // Get secret key (password field) - Base58 encoded
    const secretKeyBase58 = execSync(`OP_SESSION_thaddeus="${sessionToken}" op item get "${OP_ITEM_NAME}" --field password --reveal`, { encoding: 'utf8' }).trim();
    
    // Decode Base58 to bytes
    const bs58 = require('bs58');
    const secretKey = bs58.decode(secretKeyBase58);
    
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Verify
    if (keypair.publicKey.toBase58() !== publicKey) {
      throw new Error('Public key mismatch');
    }
    
    console.log('✅ House wallet loaded from 1Password:', publicKey);
    return keypair;
  } catch (err) {
    console.error('❌ Failed to load house wallet from 1Password:', err.message);
    console.log('\nMake sure:');
    console.log('1. 1Password CLI is installed: brew install 1password-cli');
    console.log('2. OP_PASSWORD environment variable is set');
    console.log(`3. Item "${OP_ITEM_NAME}" exists in 1Password`);
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
  console.log('🔐 Loading wallet from 1Password...\n');
  
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
