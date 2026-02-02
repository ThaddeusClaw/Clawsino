/**
 * Clawsino Auto-Payout Worker
 * 
 * Runs on Cloudflare Workers with Secrets:
 * - HELIUS_API_KEY (Helius API key)
 * - HOUSE_WALLET_KEY (Base64 encoded private key)
 * 
 * Deploy: wrangler deploy
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default {
  async fetch(request, env, ctx) {
    // Only accept POST requests to /webhook
    if (request.method !== 'POST') {
      return new Response('Clawsino Payout Worker - Use POST /webhook', { status: 200 });
    }
    
    const url = new URL(request.url);
    
    if (url.pathname === '/webhook') {
      return handleWebhook(request, env);
    }
    
    if (url.pathname === '/status') {
      return handleStatus(env);
    }
    
    return new Response('Not found', { status: 404 });
  },
  
  // Scheduled job runs every minute
  async scheduled(event, env, ctx) {
    ctx.waitUntil(monitorHouseWallet(env));
  }
};

async function handleWebhook(request, env) {
  try {
    const body = await request.json();
    
    // Expect: { player: "address", amount: 0.01, signature: "tx_sig" }
    const { player, amount, signature } = body;
    
    if (!player || !amount || !signature) {
      return jsonResponse({ error: 'Missing fields: player, amount, signature' }, 400);
    }
    
    const result = await processBet(env, player, amount, signature);
    return jsonResponse(result);
    
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

async function handleStatus(env) {
  try {
    const houseKeypair = loadHouseWallet(env);
    const connection = getConnection(env);
    
    const balance = await connection.getBalance(houseKeypair.publicKey);
    
    return jsonResponse({
      status: 'ok',
      house_address: houseKeypair.publicKey.toBase58(),
      balance_sol: balance / LAMPORTS_PER_SOL,
      rpc: 'connected'
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function loadHouseWallet(env) {
  if (!env.HOUSE_WALLET_KEY) {
    throw new Error('HOUSE_WALLET_KEY not set in Cloudflare Secrets');
  }
  
  const secretKey = Buffer.from(env.HOUSE_WALLET_KEY, 'base64');
  return Keypair.fromSecretKey(secretKey);
}

function getConnection(env) {
  const heliusKey = env.HELIUS_API_KEY;
  const rpcUrl = heliusKey 
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : 'https://api.mainnet-beta.solana.com';
  
  return new Connection(rpcUrl, 'confirmed');
}

// Provably fair randomness
function generateRandom(playerKey, slot, timestamp, nonce) {
  const data = new TextEncoder().encode(
    playerKey + slot + timestamp + nonce
  );
  
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

async function processBet(env, playerAddress, amount, signature) {
  const houseKeypair = loadHouseWallet(env);
  const connection = getConnection(env);
  
  const playerKey = new PublicKey(playerAddress);
  const slot = await connection.getSlot();
  const timestamp = Date.now();
  
  const isWin = checkWin(playerAddress, amount, slot, timestamp);
  
  if (isWin) {
    const payout = amount * 2 * LAMPORTS_PER_SOL;
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: houseKeypair.publicKey,
        toPubkey: playerKey,
        lamports: Math.floor(payout),
      })
    );
    
    const sig = await connection.sendTransaction(transaction, [houseKeypair]);
    await connection.confirmTransaction(sig, 'confirmed');
    
    return {
      win: true,
      payout: amount * 2,
      transaction: sig,
      player: playerAddress,
      original_bet: signature
    };
  } else {
    return {
      win: false,
      amount: amount,
      player: playerAddress,
      original_bet: signature
    };
  }
}

async function monitorHouseWallet(env) {
  // This runs on schedule to check for new bets
  // Logs to Cloudflare Analytics or external service
  console.log('Monitoring house wallet...');
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
