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

## Documentation

- DeepWiki: https://deepwiki.com/eneekoruiz/passwordmanager
