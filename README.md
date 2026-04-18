# ILPEA-TRANSPORTS

Plataforma de monitoreo y gestion operativa de transporte para ILPEA.

## Estructura

- `backend/`: API en Express con Firebase Admin y RBAC.
- `frontend/`: Aplicacion Vue 3 + TypeScript (Vite).
- `data-science/`: Pipeline Python para procesar aforos y sincronizar rutas.

## Requisitos

- Node.js 20+
- npm 10+
- Python 3.10+

## Configuracion de entorno

1. Backend:
- Copia `backend/.env.example` a `backend/.env`.
- Configura `AUTH_MODE` (`firebase` o `simulated`).
- Configura Firebase con `FIREBASE_KEY_PATH` o `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Si usaras IA, agrega `OPENAI_API_KEY`.

2. Frontend:
- Copia `frontend/.env.example` a `frontend/.env`.
- Ajusta `VITE_API_BASE_URL` y credenciales Firebase.

3. Data science (opcional):
- Instala dependencias con `pip install -r data-science/requirements.txt`.

## Comandos utiles

Desde la raiz del proyecto:

- `npm run dev:backend`: inicia el backend.
- `npm run dev:frontend`: inicia el frontend.
- `npm run build:frontend`: construye frontend para produccion.
- `npm run check:frontend`: validacion de tipos en frontend.

## Notas de seguridad

- No subas archivos reales de credenciales (`.env`, `firebase-key.json`) al repositorio.
- Si detectas llaves expuestas, rotalas inmediatamente.
