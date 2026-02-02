# 🔐 SICHERE HOUSE WALLET ANLEITUNG

## ⚠️ WICHTIG: Niemals Keys in Git!

### Neue House Wallet

**Adresse:** `FhJLjWW1CQ17zQhiCEqmyJy5ZiBvxaJAdNbDC5broX46`

**Private Key:** Nur in 1Password (Item: "Clawsino House Wallet V2")

---

## Schritt 1: House Wallet füllen

Sende SOL an:
```
FhJLjWW1CQ17zQhiCEqmyJy5ZiBvxaJAdNbDC5broX46
```

Minimum: 1-2 SOL für Auszahlungen

---

## Schritt 2: Payout-Server starten

```bash
cd ~/projects/agent-casino/coin-flip

# 1Password Passwort setzen
export OP_PASSWORD="dein_1password_master_passwort"

# Server starten
node payout-server.js
```

Der Server lädt den Private Key direkt aus 1Password - nie aus einer Datei!

---

## Schritt 3: Überschuss abheben

```bash
# Mit 1Password Passwort
export OP_PASSWORD="dein_1password_master_passwort"

# Abhebung starten
node withdraw-profits.js
```

Menü führt dich durch:
1. Zeigt verfügbaren Betrag (alles über 0.5 SOL Reserve)
2. Fragt nach Ziel-Adresse
3. Bestätigung erforderlich
4. Sofortige Ausführung

---

## Sicherheitscheckliste

- [x] Private Key nur in 1Password
- [x] Keine Keys in Git-History
- [x] Keine Keys im Code
- [x] Keine Keys in Umgebungsvariablen
- [x] Server lädt dynamisch aus 1Password

---

## Wichtige Befehle

**Private Key anzeigen (nur für dich):**
```bash
op signin --account thaddeus
op item get "Clawsino House Wallet V2" --reveal
```

**Balance checken:**
```bash
solana balance FhJLjWW1CQ17zQhiCEqmyJy5ZiBvxaJAdNbDC5broX46 --url mainnet
```

---

## Support

Fragen? Wallet verloren? → 1Password Vault "Thaddeus"
