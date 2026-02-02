// Shared utility for fetching balance directly from Mainnet RPC
// This bypasses any potential connection issues with the wallet adapter

export async function fetchBalanceDirect(address: string): Promise<number> {
  try {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address]
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error('RPC Error:', data.error);
      return 0;
    }
    
    const lamports = data.result?.value || 0;
    return lamports / 1e9;
  } catch (err) {
    console.error('Balance fetch error:', err);
    return 0;
  }
}

export async function fetchHouseBalance(): Promise<number> {
  const HOUSE_WALLET = '8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ';
  return fetchBalanceDirect(HOUSE_WALLET);
}
