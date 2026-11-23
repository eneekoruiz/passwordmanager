# Password Manager · Gestor de Contraseñas y Autenticador 2FA

Gestor de contraseñas offline-first y generador de códigos de verificación en dos pasos (TOTP 2FA) con cifrado en el navegador de conocimiento cero (Zero-Knowledge) y respaldo remoto opcional.

- **Documentación de arquitectura:** [DeepWiki - passwordmanager](https://deepwiki.com/eneekoruiz/passwordmanager)

## Propósito y Valor del Producto

Diseñado para proporcionar seguridad y soberanía sobre las credenciales personales sin depender de servidores centralizados que puedan comprometer las claves maestras. Toda la criptografía se ejecuta localmente en el cliente antes de persistir cualquier dato.

- **Cifrado de Conocimiento Cero (Zero-Knowledge):** Todos los registros del baúl (cuentas, contraseñas, URLs y notas) se cifran y descifran exclusivamente en memoria en el navegador utilizando la Web Crypto API nativa con AES-GCM de 256 bits. La contraseña maestra nunca se transmite ni se almacena en disco.
- **Derivación Robusta de Claves:** La clave de cifrado se deriva de la contraseña maestra mediante el algoritmo estándar PBKDF2 con función pseudoaleatoria HMAC-SHA-256 y un salt criptográfico aleatorio almacenado en el dispositivo.
- **Autenticador 2FA (TOTP) Integrado:** Incorpora generación de códigos temporales de un solo uso compatibles con el estándar RFC 6238 (Google Authenticator, Authy), con temporizadores visuales de cuenta atrás y escaneo de semillas directamente junto a cada cuenta.
- **Persistencia Offline en IndexedDB:** Almacén local rápido y completamente operativo sin conexión a internet implementado sobre IndexedDB (`idb`).
- **Exportación e Importación Encriptada:** Exporta el baúl completo en un archivo JSON comprimido y protegido con cifrado AES-GCM mediante JSZip, permitiendo migraciones seguras y copias de seguridad sin exponer datos en texto plano.
- **Sincronización Opcional:** Posibilidad de sincronizar el baúl cifrado mediante Firebase para disponibilidad entre dispositivos, sin que el servidor conozca en ningún momento el contenido de las credenciales.

## Stack Técnico

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Criptografía:** Web Crypto API nativa del navegador (PBKDF2, SHA-256, AES-GCM 256 bits)
- **Persistencia Local:** IndexedDB (`idb`), Vite Plugin PWA
- **Herramientas & Utilidades:** `otpauth` (generador TOTP RFC 6238), `jszip` (empaquetado de copias cifradas), Firebase SDK (sincronización opcional)
- **Testing:** Vitest

## Puesta en Marcha Local

### Prerrequisitos

- Node.js 18+

### Instalación y Ejecución

```bash
git clone https://github.com/eneekoruiz/passwordmanager.git
cd passwordmanager
npm install

# Iniciar servidor de desarrollo local
npm run dev

# Ejecutar suite de pruebas unitarias
npm test

# Compilar paquete de producción
npm run build
```
