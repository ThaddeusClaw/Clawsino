#!/usr/bin/env node
/**
 * Clawsino Profit Withdrawal Tool
 * 
 * Allows authority to withdraw profits from house wallet
 * while keeping minimum balance for operations.
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import readline from 'readline';

const RPC_URL = process.env.SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=af5e5d84-6ce2-4eb9-b096-f4754ca84ba3';
const HOUSE_WALLET_PATH = './house-wallet.json';

// Minimum reserve to keep in house wallet (for payouts)
const MINIMUM_RESERVE = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('🦞 Clawsino Profit Withdrawal Tool\n');
  
  // Load house wallet
  let houseKeypair;
  try {
    const walletData = JSON.parse(fs.readFileSync(HOUSE_WALLET_PATH, 'utf8'));
    houseKeypair = Keypair.fromSecretKey(new Uint8Array(walletData.secretKey));
    console.log('✅ House wallet loaded:', houseKeypair.publicKey.toBase58());
  } catch (err) {
    console.error('❌ Failed to load house wallet:', err.message);
    process.exit(1);
  }
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Check balance
  const balance = await connection.getBalance(houseKeypair.publicKey);
  console.log('\n💰 House Wallet Status:');
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Minimum Reserve: ${(MINIMUM_RESERVE / LAMPORTS_PER_SOL)} SOL`);
  
  const availableForWithdrawal = Math.max(0, balance - MINIMUM_RESERVE);
  console.log(`   Available for Withdrawal: ${(availableForWithdrawal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  
  if (availableForWithdrawal <= 0) {
    console.log('\n⚠️  No funds available for withdrawal (below minimum reserve)');
    process.exit(0);
  }
  
  // Ask for withdrawal details
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
    
    // Ask for destination
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
    
    // Confirm withdrawal
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
    
    // Execute withdrawal
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
      
      // Log withdrawal
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
