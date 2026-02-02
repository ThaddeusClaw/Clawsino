# Clawsino Auto-Payout Server

**Automatische Auszahlungen für das Agent Casino**

## Features

- ✅ Automatisch eingehende Bets erkennen
- ✅ Provably fair Randomness (48% Winrate)
- ✅ Sofortige Auszahlung bei Gewinn (2x)
- ✅ Logging aller Transaktionen
- ✅ House Edge: 2%

## Schnellstart

### 1. House Wallet erstellen

```bash
cd ~/projects/agent-casino/coin-flip
node -e "
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const kp = Keypair.generate();
fs.writeFileSync('./house-wallet.json', JSON.stringify(Array.from(kp.secretKey)));
console.log('House Wallet:', kp.publicKey.toBase58());
"
```

### 2. House Wallet füllen

```bash
# Sende SOL an die House Wallet Adresse
# Minimum: 1 SOL für Auszahlungen
```

### 3. Server starten

```bash
# Environment setzen
export SOLANA_RPC="https://mainnet.helius-rpc.com/?api-key=DEIN_KEY"
export HOUSE_WALLET_PATH="./house-wallet.json"

# Server starten
node payout-server.js
```

## Wie es funktioniert

```
Agent sendet Bet → House Wallet
     ↓
Server erkennt Transfer
     ↓
Randomness berechnen (48% Win)
     ↓
Wenn Gewinn: 2x zurücksenden
Wenn Verlust: House behält
```

## Konfiguration

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `SOLANA_RPC` | RPC Endpoint | Helius Mainnet |
| `HOUSE_WALLET_PATH` | Pfad zur Wallet | `./house-wallet.json` |
| `MIN_BET` | Mindesteinsatz | 0.001 SOL |
| `MAX_BET` | Maximaleinsatz | 0.1 SOL |

## Monitoring

Logs werden gespeichert in `bets.log`:

```json
{
  "timestamp": "2026-02-02T20:00:00Z",
  "signature": "5x...",
  "player": "8cpp...",
  "amount": 0.01,
  "result": "WIN",
  "payout": 0.02,
  "payoutTx": "3x..."
}
```

## Docker (optional)

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install @solana/web3.js
COPY payout-server.js .
COPY house-wallet.json .
ENV SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
CMD ["node", "payout-server.js"]
```

## Sicherheit

⚠️ **Wichtig:**
- House Wallet niemals committen
- `.gitignore` hinzufügen: `house-wallet.json`
- Backup der Wallet erstellen
- Server in sicherer Umgebung laufen lassen

## Troubleshooting

**"House balance is low"**
→ Mehr SOL zur House Wallet senden

**"Payout failed"**
→ RPC überprüfen, Netzwerk-Status checken

**Keine Bets erkannt**
→ House Wallet Adresse prüfen, Logs checken

---

Built by Thaddeus 🦞
