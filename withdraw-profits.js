#!/usr/bin/env node
/**
 * Clawsino Profit Withdrawal Tool
 * 
 * Laedt House Wallet aus 1Password - sicher!
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { execSync } from 'child_process';
import fs from 'fs';
import readline from 'readline';

const RPC_URL = process.env.SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=af5e5d84-6ce2-4eb9-b096-f4754ca84ba3';
const OP_ITEM_NAME = 'Clawsino House Wallet V2';
const MINIMUM_RESERVE = 0.5 * LAMPORTS_PER_SOL;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load from 1Password
function loadHouseWallet() {
  try {
    const opPassword = process.env.OP_PASSWORD;
    if (!opPassword) {
      throw new Error('OP_PASSWORD environment variable required');
    }
    
    const sessionToken = execSync(`echo "${opPassword}" | op signin --account thaddeus --raw`, { encoding: 'utf8' }).trim();
    const secretKeyJson = execSync(`OP_SESSION_thaddeus="${sessionToken}" op item get "${OP_ITEM_NAME}" --field password --reveal`, { encoding: 'utf8' }).trim();
    const secretKey = JSON.parse(secretKeyJson);
    
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  } catch (err) {
    console.error('❌ Failed to load from 1Password:', err.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🦞 Clawsino Profit Withdrawal Tool\n');
  console.log('🔐 Loading from 1Password...\n');
  
  const houseKeypair = loadHouseWallet();
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('✅ House wallet loaded:', houseKeypair.publicKey.toBase58());
  
  const balance = await connection.getBalance(houseKeypair.publicKey);
  console.log(`\n💰 House Wallet Status:`);
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Minimum Reserve: ${(MINIMUM_RESERVE / LAMPORTS_PER_SOL)} SOL`);
  
  const availableForWithdrawal = Math.max(0, balance - MINIMUM_RESERVE);
  console.log(`   Available for Withdrawal: ${(availableForWithdrawal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  
  if (availableForWithdrawal <= 0) {
    console.log('\n⚠️  No funds available for withdrawal (below minimum reserve)');
    process.exit(0);
  }
  
  console.log('\n📤 Withdrawal Options:');
  console.log('1. Withdraw all available profits');
  console.log('2. Withdraw custom amount');
  console.log('3. Cancel');
  
  rl.question('\nSelect option (1-3): ', async (option) => {
    if (option === '3') {
      console.log('Cancelled.');
      rl.close();
      return;
    }
    
    let withdrawAmount;
    
    if (option === '1') {
      withdrawAmount = availableForWithdrawal;
    } else if (option === '2') {
      const answer = await new Promise(resolve => {
        rl.question(`Enter amount to withdraw (max ${(availableForWithdrawal / LAMPORTS_PER_SOL).toFixed(4)} SOL): `, resolve);
      });
      withdrawAmount = parseFloat(answer) * LAMPORTS_PER_SOL;
      
      if (withdrawAmount > availableForWithdrawal) {
        console.log('❌ Amount exceeds available balance');
        rl.close();
        return;
      }
    } else {
      console.log('Invalid option');
      rl.close();
      return;
    }
    
    const destinationAddress = await new Promise(resolve => {
      rl.question('\nEnter destination wallet address: ', resolve);
    });
    
    let destinationPubkey;
    try {
      destinationPubkey = new PublicKey(destinationAddress);
    } catch {
      console.log('❌ Invalid address');
      rl.close();
      return;
    }
    
    console.log('\n📋 Withdrawal Summary:');
    console.log(`   From: ${houseKeypair.publicKey.toBase58()}`);
    console.log(`   To: ${destinationAddress}`);
    console.log(`   Amount: ${(withdrawAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    
    const confirm = await new Promise(resolve => {
      rl.question('\nConfirm withdrawal? (yes/no): ', resolve);
    });
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      rl.close();
      return;
    }
    
    try {
      console.log('\n🚀 Executing withdrawal...');
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: houseKeypair.publicKey,
          toPubkey: destinationPubkey,
          lamports: Math.floor(withdrawAmount),
        })
      );
      
      const signature = await connection.sendTransaction(transaction, [houseKeypair]);
      await connection.confirmTransaction(signature, 'confirmed');
      
      console.log(`\n✅ Withdrawal successful!`);
      console.log(`   Transaction: ${signature}`);
      console.log(`   Explorer: https://solscan.io/tx/${signature}`);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'WITHDRAWAL',
        amount: withdrawAmount / LAMPORTS_PER_SOL,
        destination: destinationAddress,
        signature: signature,
        remainingBalance: (balance - withdrawAmount) / LAMPORTS_PER_SOL,
      };
      fs.appendFileSync('./withdrawals.log', JSON.stringify(logEntry) + '\n');
      
    } catch (err) {
      console.error('\n❌ Withdrawal failed:', err.message);
    }
    
    rl.close();
  });
}

main().catch(console.error);
