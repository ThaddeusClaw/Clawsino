// Simple balance utilities - uses wallet adapter connection only
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

export async function getBalance(
  connection: Connection, 
  address: string
): Promise<number> {
  try {
    const lamports = await connection.getBalance(new PublicKey(address), 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  } catch (err) {
    console.error('Failed to get balance:', err);
    return 0;
  }
}
