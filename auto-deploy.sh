#!/bin/bash
# Auto-deploy script for devnet
# Runs via cron job every 6 hours

cd ~/projects/agent-casino/coin-flip

HOUSE_WALLET="uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD"
PROGRAM_ID="2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG"

echo "🚀 Auto-Deploy Attempt - $(date)"
echo "================================"

# Try to get airdrop
echo "Requesting airdrop..."
solana airdrop 2 $HOUSE_WALLET --url devnet

# Check balance
BALANCE=$(solana balance $HOUSE_WALLET --url devnet | awk '{print $1}')
echo "Balance: $BALANCE SOL"

if (( $(echo "$BALANCE >= 1.5" | bc -l) )); then
    echo "✅ Sufficient funds. Deploying..."
    
    # Update config to devnet
    sed -i 's/cluster = "localnet"/cluster = "devnet"/' Anchor.toml
    
    # Build and deploy
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    anchor build
    anchor deploy --provider.cluster devnet
    
    if [ $? -eq 0 ]; then
        echo "🎉 DEPLOY SUCCESS!"
        echo "Program ID: $PROGRAM_ID"
        echo "House Balance: $BALANCE SOL"
        
        # Update frontend
        sed -i "s|http://localhost:8899|https://api.devnet.solana.com|" app/src/App.tsx
        cd app && npm run build
        
        # Notify
        echo "Agent Casino is LIVE on Devnet!"
        exit 0
    else
        echo "❌ Deploy failed"
        exit 1
    fi
else
    echo "❌ Insufficient funds. Need 1.5 SOL, have $BALANCE SOL"
    echo "Next retry in 6 hours..."
    exit 1
fi