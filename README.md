# Password Manager

Offline-first password manager and 2FA authenticator with client-side encryption and optional remote backup.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Cryptography:** Web Crypto API (PBKDF2 key derivation, AES-GCM 256-bit encryption)
- **Persistence & PWA:** IndexedDB (`idb`), Vite Plugin PWA
- **Utilities:** OTPAuth (TOTP 2FA code generation), JSZip (encrypted vault backup/export), Firebase SDK (optional sync)
- **Testing:** Vitest

## Architecture & Key Decisions

- **Zero-Knowledge Client-Side Encryption:** All vault entries are encrypted and decrypted in the browser using AES-GCM with 256-bit keys. The master password never leaves the browser.
- **Key Derivation:** Master key is derived using PBKDF2 with SHA-256 and a random salt stored in IndexedDB.
- **Offline-First Storage:** Local credentials and metadata are stored in IndexedDB, allowing full offline access and fast lookup.
- **Integrated TOTP Authenticator:** Generates RFC 6238-compliant one-time passwords with real-time progress countdowns directly alongside stored credentials.
- **Encrypted Export & Import:** Exports the full vault as an encrypted JSON archive (AES-GCM) with JSZip, ensuring portability without plaintext risk.

## Local Setup

### Prerequisites

- Node.js 18+

### Installation

```bash
git clone https://github.com/eneekoruiz/passwordmanager.git
cd passwordmanager
npm install
```

### Development & Build

```bash
# Start local development server
npm run dev

# Run unit tests
npm test

# Build production bundle
npm run build
```
