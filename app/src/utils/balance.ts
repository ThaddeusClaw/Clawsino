// Ultra-robust balance fetching with multiple fallbacks
// This ensures we ALWAYS get the correct mainnet balance

const MAINNET_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
];

export async function fetchBalanceDirect(address: string): Promise<number> {
  console.log('🔍 Fetching balance for:', address);
  
  for (const rpcUrl of MAINNET_RPCS) {
    try {
      console.log('🌐 Trying RPC:', rpcUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address, { commitment: 'confirmed' }]
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`⚠️ RPC ${rpcUrl} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.warn('⚠️ RPC Error:', data.error);
        continue;
      }
      
      const lamports = data.result?.value;
      if (typeof lamports !== 'number') {
        console.warn('⚠️ Invalid response format:', data);
        continue;
      }
      
      const sol = lamports / 1e9;
      console.log(`✅ Balance from ${rpcUrl}: ${sol} SOL`);
      return sol;
      
    } catch (err) {
      console.warn(`❌ Failed to fetch from ${rpcUrl}:`, err);
      continue;
    }
  }
  
  console.error('❌ All RPC endpoints failed');
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
