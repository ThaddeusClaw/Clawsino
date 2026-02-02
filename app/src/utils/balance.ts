// Balance fetching using wallet adapter connection

import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

// Use wallet adapter connection when available
export async function fetchBalanceDirect(address: string, connection?: Connection): Promise<number> {
  console.log('🔍 Fetching balance for:', address);
  
  // Try wallet adapter connection first
  if (connection) {
    try {
      console.log('🌐 Using wallet adapter connection');
      const lamports = await connection.getBalance(new PublicKey(address), 'confirmed');
      const sol = lamports / LAMPORTS_PER_SOL;
      console.log(`✅ Balance: ${sol} SOL`);
      return sol;
    } catch (err) {
      console.warn('⚠️ Wallet adapter connection failed:', err);
    }
  }
  
  console.error('❌ No working connection available');
  return 0;
}

export async function fetchHouseBalance(): Promise<number> {
  const HOUSE_WALLET = '8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ';
  return fetchBalanceDirect(HOUSE_WALLET);
}

// Debug helper
export async function testConnection(): Promise<{ success: boolean; balance?: number; error?: string }> {
  const testAddress = '8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ';
  try {
    const balance = await fetchBalanceDirect(testAddress);
    return { success: true, balance };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
