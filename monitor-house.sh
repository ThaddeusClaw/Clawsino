#!/bin/bash
# House Monitor - Tracks casino health and alerts

HOUSE_WALLET="uRz2YWz8SAmX7utf9dGeiuhRdNvY1PDQWkH6yX5zCsD"
ALERT_THRESHOLD=0.2  # Alert if house below 0.2 SOL
MAX_BET=0.1

while true; do
    # Get house balance
    BALANCE=$(solana balance $HOUSE_WALLET --url devnet 2>/dev/null | awk '{print $1}')
    
    if (( $(echo "$BALANCE < $ALERT_THRESHOLD" | bc -l) )); then
        echo "🚨 ALERT: House balance low! Current: $BALANCE SOL"
        echo "Time: $(date)"
        
        # Send alert (if configured)
        # curl -X POST ... (Telegram webhook)
    fi
    
    # Check if house is funded enough for operation
    if (( $(echo "$BALANCE >= 1.0" | bc -l) )); then
        echo "✅ House healthy: $BALANCE SOL"
    else
        echo "⚠️ House underfunded: $BALANCE SOL / 1.0 SOL target"
    fi
    
    echo "Max bet allowed: $(echo "$BALANCE * 0.1" | bc) SOL"
    echo "---"
    
    sleep 300  # Check every 5 minutes
done