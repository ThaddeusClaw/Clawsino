#!/bin/bash
# House Funding Script
# Run this once to initialize house with 1 SOL

HOUSE_WALLET="uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD"
PROGRAM_ID="2Gj7tzsJUtgsMAQ6kEUzCtyy7t6X2Byy5UPcrSxKCwVG"

echo "🏦 Agent Casino - House Funding"
echo "================================"
echo ""
echo "House Wallet: $HOUSE_WALLET"
echo "Required: 1.0 SOL"
echo ""

# Check balance
BALANCE=$(solana balance $HOUSE_WALLET --url devnet 2>/dev/null || echo "0")
echo "Current Balance: $BALANCE SOL"

if (( $(echo "$BALANCE >= 1.0" | bc -l) )); then
    echo "✅ House already funded!"
else
    echo "❌ House needs funding"
    echo ""
    echo "Send 1.0 SOL to:"
    echo "$HOUSE_WALLET"
    echo ""
    echo "After sending, run: ./init-house.sh"
fi