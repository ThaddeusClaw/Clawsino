# 🔐 Cloudflare Secrets Setup - Agent Casino

## Neue House Wallet (PRODUCTION)

**⚠️ WICHTIG: Diese Wallet ist NEU und sicher!**

### Public Address (für Einzahlungen)
```
HR8n33krqJf9C6TVCfUuVfZTP3RWHPUBu42dYEGTvhCY
```

### Private Key
**NUR in 1Password verfügbar:**
- Item: `Clawsino House Wallet PRODUCTION`
- Vault: `Thaddeus`

**Niemals geteilt, niemals exposed!**

---

## Schritt 1: Private Key für Cloudflare vorbereiten

```bash
# Hole Private Key aus 1Password
op signin --account thaddeus
op item get "Clawsino House Wallet PRODUCTION" --reveal

# Kopiere den password Wert (Base64 format)
```

---

## Schritt 2: Cloudflare Pages Setup

### 2.1 Gehe zu Cloudflare Dashboard
https://dash.cloudflare.com → Pages → clawsino

### 2.2 Environment Variables setzen

Gehe zu: **Settings** → **Environment variables**

Füge hinzu:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `HOUSE_WALLET_KEY` | `H9t9u1TBujMyWTfbZo45t6WBhuUE+n2bXBXQSezKe2bz6bkelW56/mcFMzlYMj/pPIwe14GrUXK2eWai0vlTRQ==` | Production |
| `SOLANA_RPC` | `https://mainnet.helius-rpc.com/?api-key=af5e5d84-6ce2-4eb9-b096-f4754ca84ba3` | Production |

⚠️ **WICHTIG:** `HOUSE_WALLET_KEY` ist der Base64-encoded private key!

### 2.3 Save & Deploy

Klicke **Save** → Trigger redeploy

---

## Schritt 3: House Wallet füllen

Sende SOL an:
```
HR8n33krqJf9C6TVCfUuVfZTP3RWHPUBu42dYEGTvhCY
```

Minimum: **2 SOL** (für Auszahlungspuffer)

---

## Schritt 4: Server starten

### Option A: Lokal (mit 1Password)
```bash
cd ~/projects/agent-casino/coin-flip
export OP_PASSWORD="dein_1password_passwort"
node payout-server.js
```

### Option B: Cloudflare Worker (autonom)
→ Muss separat als Worker deployt werden

---

## Überschuss abheben

```bash
# Lokal mit 1Password
export OP_PASSWORD="dein_passwort"
node withdraw-profits.js
```

Oder manuell:
```bash
# Hole Private Key
op item get "Clawsino House Wallet PRODUCTION" --reveal

# Sende zu deiner Wallet
solana transfer DEINE_WALLET_ADRESSE 1.5 --from house-wallet.json --url mainnet
```

---

## Sicherheitscheckliste

- [x] Neue Wallet nach Key-Exposure
- [x] Nur in 1Password gespeichert
- [x] Cloudflare Secrets für Autonomie
- [x] Keine Keys im Code
- [x] Keine Keys in Git
- [x] Keine Keys in Chat (gelernt! 😅)

---

## Support

Bei Problemen:
1. Prüfe Cloudflare Logs
2. Prüfe House Balance: https://solscan.io/account/HR8n33krqJf9C6TVCfUuVfZTP3RWHPUBu42dYEGTvhCY
3. 1Password: Vault "Thaddeus" → "Clawsino House Wallet PRODUCTION"
