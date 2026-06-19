# passwordmanager

Offline-first password vault built with React and Vite.

The app stores encrypted vault data locally and includes optional cloud synchronization. It is designed as a personal password manager experiment, not as a replacement for a professionally audited password manager.

## Screenshot

![Passwordmanager home screen](public/screenshots/home.png)

## What it includes

- local encrypted vault storage
- master-password based unlock flow
- password, account and secure note records
- backup import/export flows
- optional Firebase synchronization

## Tech stack

- React
- TypeScript
- Vite
- IndexedDB
- Firebase

## Local setup

```bash
npm install
npm run dev
```

Firebase sync requires the relevant `VITE_FIREBASE_*` values. The local vault flow can be reviewed without real cloud credentials.

## Social preview

GitHub social preview asset: `public/og-image.png`

## Architecture

The React interface uses a storage layer instead of reading browser APIs directly. Vault records are encrypted before they are written to IndexedDB, and decrypted data remains in the active session only. Import and export use the same encrypted representation.

Firebase is an optional synchronization adapter. Local storage remains the primary path, while the adapter transfers encrypted vault data between devices when Firebase variables are configured.

## Documentation

- DeepWiki: https://deepwiki.com/eneekoruiz/passwordmanager
