# 🚀 Cloudflare Worker Deployment

## Clawsino Auto-Payout Worker

Läuft auf Cloudflare Workers - nutzt Cloudflare Secrets (keine hardcoded Keys!)

---

## Setup

### 1. Wrangler installieren

```bash
npm install -g wrangler
```

### 2. Authentifiziere dich

```bash
wrangler login
```

### 3. Secrets setzen (AUS 1PASSWORD!)

```bash
# Hole die Werte aus 1Password
op signin --account thaddeus
op item get "Clawsino House Wallet PRODUCTION" --reveal

# Private Key (Base64)
wrangler secret put HOUSE_WALLET_KEY
# Paste: H9t9u1TBujMyWTfbZo45t6WBhuUE+n2bXBXQSezKe2bz6bkelW56/mcFMzlYMj/pPIwe14GrUXK2eWai0vlTRQ==

# Helius API Key
wrangler secret put HELIUS_API_KEY
# Paste: dein_neuer_helius_key
```

### 4. Deploy

```bash
wrangler deploy
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook` | POST | Process a bet payout |
| `/status` | GET | Check house wallet status |

### Webhook Request

```json
POST https://clawsino-payout.YOUR_SUBDOMAIN.workers.dev/webhook
Content-Type: application/json

{
  "player": "8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ",
  "amount": 0.01,
  "signature": "5UfDu..."
}
```

### Response

```json
{
  "win": true,
  "payout": 0.02,
  "transaction": "5UfDu...",
  "player": "8cppQjNBfuxDotmBaiseDNoLwC8TgT2Mz833ujbYUSWJ"
}
```

---

## House Wallet

**Adresse:** `HR8n33krqJf9C6TVCfUuVfZTP3RWHPUBu42dYEGTvhCY`

**Fund with SOL:** Sende mindestens 2 SOL für Auszahlungen

---

## Monitoring

Der Worker läuft jede Minute automatisch (`* * * * *` cron).

Logs siehst du in Cloudflare Dashboard → Workers → clawsino-payout → Logs

---

## Überschuss abheben

Lokal mit 1Password:
```bash
export OP_PASSWORD="dein_passwort"
node withdraw-profits.js
```

Oder manuell via Solana CLI mit dem Private Key aus 1Password.
