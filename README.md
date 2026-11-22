# Password Manager

Gestor de contraseñas offline-first desarrollado con React, TypeScript y Vite.

El proyecto implementa un almacén de contraseñas local con cifrado en el navegador y sincronización remota opcional mediante Firebase.

## Características

- Almacén local cifrado mediante Web Crypto API (PBKDF2 para derivación de clave y AES-GCM para datos).
- Flujo de desbloqueo mediante contraseña maestra sin persistencia de credenciales en texto plano.
- Gestión de cuentas, contraseñas y notas seguras.
- Exportación e importación de copias de seguridad cifradas en JSON / ZIP.
- Sincronización en la nube opcional mediante Firebase Firestore.

## Stack técnico

- **Frontend:** React, TypeScript, Vite, Tailwind CSS.
- **Criptografía y persistencia:** Web Crypto API, IndexedDB (idb).
- **Backend opcional:** Firebase Auth y Firestore.

## Ejecución local

```bash
npm install
npm run dev
```

Las credenciales de Firebase se configuran opcionalmente en variables de entorno `VITE_FIREBASE_*`.
