# Estructura RBAC (Role-Based Access Control) - ILPEA Transports

## 📋 Resumen

Se ha implementado un sistema completo de control de acceso basado en roles (RBAC) que distingue entre tres tipos de usuarios:
- **ADMIN**: Acceso total. Gestiona usuarios, rutas y configuración.
- **JEFE**: Gestiona asignaciones, monitorea rutas y accede al copiloto IA.
- **EMPLEADO**: Visualiza su ruta asignada y estado de viaje.

---

## 🏗️ Arquitectura RBAC

### Backend (`backend/src/`)

#### 1. **`config/roles.js`** - Configuración de Roles y Permisos
```javascript
// Define 3 roles y sus permisos asociados
ROLES = { ADMIN, JEFE, EMPLEADO }
PERMISOS = {
  'rutas:ver': [ADMIN, JEFE, EMPLEADO],
  'rutas:crear': [ADMIN],
  'rutas:actualizar': [ADMIN, JEFE],
  'asignacion:crear': [ADMIN, JEFE],
  'chat:enviar': [ADMIN, JEFE],
  // ...más permisos
}
```

**Funciones:**
- `tienePermiso(rol, accion)` - Verifica si un rol puede hacer una acción
- `obtenerPermisosDelRol(rol)` - Obtiene todos los permisos de un rol

#### 2. **`middleware/auth.js`** - Middleware de Autenticación y Autorización

**`autenticar(req, res, next)`**
- Verifica token de Firebase en header `Authorization: Bearer <token>`
- Extrae datos del usuario desde Firestore
- Adjunta información del usuario al request: `req.usuario`

**`autorizar(accionesRequeridas)`**
- Middleware que verifica si el usuario tiene permiso para una acción
- Retorna 403 si no tiene permisos
- Soporta validación de múltiples acciones (OR)

**`autenticarSimulado(req, res, next)`** (Para desarrollo)
- Lee el rol desde header `X-User-Role`
- Simula un usuario sin necesidad de Firebase Auth

**`registrarAccion(coleccion)`** (Auditoría)
- Registra todas las acciones en Firestore
- Útil para auditoría y debugging

#### 3. **Endpoints Protegidos por RBAC**

| Endpoint | Método | Permiso Requerido | Roles |
|----------|--------|------------------|-------|
| `/api/rutas` | GET | `rutas:ver` | ADMIN, JEFE, EMPLEADO |
| `/api/asignar` | POST | `asignacion:crear` | ADMIN, JEFE |
| `/api/rutas/sync` | POST | `rutas:sync` | ADMIN |
| `/api/chat` | POST | `chat:enviar` | ADMIN, JEFE |
| `/api/insights-automaticos` | GET | `insights:ver` | ADMIN, JEFE |
| `/api/ai/feedback` | POST | `insights:ver` | ADMIN *(validacion adicional de rol en backend)* |
| `/api/ai/ejecutar-plan` | POST | `asignacion:crear` | ADMIN *(validacion adicional de rol en backend)* |
| `/api/ai/planes-ejecutados` | GET | `insights:ver` | ADMIN, JEFE |
| `/api/usuarios` | GET | `usuarios:ver` | ADMIN |
| `/api/usuarios/crear` | POST | `usuarios:crear` | ADMIN |
| `/api/usuarios/:uid/rol` | PUT | `usuarios:actualizar` | ADMIN |
| `/api/usuarios/:uid` | DELETE | `usuarios:eliminar` | ADMIN |

---

### Frontend (`frontend/src/`)

#### 1. **`composables/useAuth.ts`** - Composable de Autenticación

```typescript
// Funciones principales:
- login(email, rol) - Inicia sesión simulada
- logout() - Cierra sesión
- cargarUsuarioGuardado() - Recupera usuario de localStorage
- tieneRol(roles) - Verifica si tiene un rol específico
- tienePermiso(accion) - Verifica si tiene permiso para una acción
- obtenerRol() - Obtiene el rol del usuario
- obtenerNombre() - Obtiene el nombre del usuario
```

**Uso:**
```typescript
import { useAuth } from '@/composables/useAuth'

const { tieneRol, tienePermiso, logout } = useAuth()

if (tieneRol('ADMIN')) {
  // Mostrar opciones de admin
}

if (tienePermiso('usuarios:crear')) {
  // Mostrar botón crear usuario
}
```

#### 2. **`components/ProtectedRoute.vue`** - Componente Guardado

```vue
<!-- Proteger por rol -->
<ProtectedRoute require-rol="ADMIN">
  <AdminPanel />
</ProtectedRoute>

<!-- Proteger por permiso -->
<ProtectedRoute require-permiso="chat:enviar">
  <ChatComponent />
</ProtectedRoute>

<!-- Proteger por múltiples roles (cualquiera) -->
<ProtectedRoute require-rol="['ADMIN', 'JEFE']">
  <ManagementPanel />
</ProtectedRoute>
```

Si el usuario no tiene permiso:
- Muestra mensaje "Acceso Denegado"
- Permite volver al inicio

#### 3. **`views/Login.vue`** - Pantalla de Login

Actualizada con 3 opciones:
- 👨‍💼 **ADMIN**: admin@ilpea.test
- 👔 **JEFE**: jefe@ilpea.test
- 👷 **EMPLEADO**: empleado@ilpea.test

#### 4. **`views/EmpleadoDashboard.vue`** - Panel del Empleado

Vista simple y segura para empleados:
- Visualiza solo su ruta asignada
- Protegida con `ProtectedRoute require-rol="EMPLEADO"`
- Muestra información básica de la ruta
- Información útil sobre estado de la ruta

---

## 🔐 Matriz de Permisos por Rol

### ADMIN
✅ **Todos los permisos:**
- Gestión de rutas (crear, actualizar, eliminar, sincronizar)
- Gestión de asignaciones
- Chat/Copiloto IA
- Insights automáticos
- Gestión de usuarios (CRUD)
- Acceso a todos los dashboards

### JEFE
✅ **Permisos específicos:**
- Ver rutas
- Actualizar rutas
- Crear/ver/cancelar asignaciones
- Usar chat/copiloto IA
- Ver insights automáticos
- Dashboards del jefe y empleado

❌ **No puede:**
- Crear, eliminar rutas
- Sincronizar datos desde Python
- Gestionar usuarios
- Acceder a dashboard admin

### EMPLEADO
✅ **Permisos mínimos:**
- Ver rutas
- Ver sus asignaciones
- Acceder a dashboard de empleado

❌ **No puede:**
- Crear, actualizar o eliminar rutas
- Asignar empleados
- Usar copiloto IA
- Ver insights
- Gestionar usuarios

---

## 🚀 Cómo Usar en Desarrollo

### 1. **Iniciar servidor backend con RBAC simulado:**
```bash
cd backend
node src/server.js
```

En desarrollo, usa `autenticarSimulado` que lee del header `X-User-Role`.

### 2. **Hacer solicitud con rol simulado:**
```bash
# Como ADMIN
curl -H "X-User-Role: ADMIN" http://localhost:3000/api/usuarios

# Como JEFE
curl -H "X-User-Role: JEFE" http://localhost:3000/api/rutas

# Como EMPLEADO (sin permiso)
curl -H "X-User-Role: EMPLEADO" http://localhost:3000/api/usuarios
# → Error 403: Permiso denegado
```

### 3. **En el frontend:**
```typescript
import { useAuth } from '@/composables/useAuth'

const { login } = useAuth()

// Simular login como jefe
login('jefe@ilpea.test', 'JEFE')

// El usuario queda persistido en localStorage
```

---

## 🔄 Flujo de Autenticación

```
Login Page
    ↓
Usuario selecciona rol (ADMIN/JEFE/EMPLEADO)
    ↓
useAuth.login() guarda en localStorage
    ↓
useAuth.cargarUsuarioGuardado() recupera en cada vista
    ↓
ProtectedRoute verifica tieneRol() / tienePermiso()
    ↓
Si OK → Muestra componente
Si NO → Muestra "Acceso Denegado"
```

---

## 🛠️ Cambiar a Autenticación Real (Firebase)

Para usar autenticación real de Firebase en producción:

### 1. En `server.js`, cambiar:
```javascript
// De esto:
app.use((req, res, next) => {
  if (req.path === '/api/auth/login' || req.path === '/api/auth/crear-usuario') {
    return next();
  }
  return autenticarSimulado(req, res, next);
});

// A esto:
app.use((req, res, next) => {
  if (req.path === '/api/auth/login' || req.path === '/api/auth/crear-usuario') {
    return next();
  }
  return autenticar(req, res, next); // Usar autenticar real
});
```

### 2. En el frontend, usar Firebase SDK:
```typescript
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

const firebaseConfig = { /* ... */ }
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// En useAuth.ts:
const login = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  const token = await userCredential.user.getIdToken()
  // Guardar token y usar en headers
}
```

---

## 📊 Estructura Firestore para Usuarios

```firestore
usuarios/ (collection)
├── {uid}
│   ├── email: string
│   ├── nombre: string
│   ├── rol: "ADMIN" | "JEFE" | "EMPLEADO"
│   ├── activo: boolean
│   ├── creado_en: timestamp
│   ├── creado_por: string (uid del admin que lo creó)
│   └── ...
```

---

## 📝 Auditoría

Todas las acciones se registran en:
```firestore
acciones/ (collection)
├── {docId}
│   ├── timestamp: timestamp
│   ├── usuario_id: string
│   ├── usuario_rol: string
│   ├── metodo: "GET" | "POST" | "PUT" | "DELETE"
│   ├── ruta: string
│   ├── status: number
│   ├── exitoso: boolean
│   └── datos: object
```

---

## 🔍 Debugging

### Ver rol actual en consola:
```typescript
const { obtenerRol, obtenerPermisosDelRol } = useAuth()
console.log('Rol:', obtenerRol())
console.log('Permisos:', obtenerPermisosDelRol(obtenerRol()))
```

### Verificar autenticación en localStorage:
```javascript
console.log(localStorage.getItem('usuario'))
console.log(localStorage.getItem('userRole'))
```

### Ver qué middleware está activo:
```bash
# En server.js, ver los logs:
console.log(req.usuario) // Imprime datos del usuario autenticado
```

---

## ✅ Checklist de Implementación

- ✅ Backend: Configuración de roles (`roles.js`)
- ✅ Backend: Middleware de autenticación (`auth.js`)
- ✅ Backend: Endpoints protegidos por RBAC
- ✅ Backend: Endpoints de gestión de usuarios
- ✅ Frontend: Composable `useAuth.ts`
- ✅ Frontend: Componente `ProtectedRoute.vue`
- ✅ Frontend: Login con 3 roles
- ✅ Frontend: Dashboard de Empleado
- ✅ Auditoría de acciones en Firestore
- ✅ Documentación completa

---

## 🎯 Próximas Mejoras

1. **Integración real con Firebase Auth** en lugar de simulado
2. **Tokens JWT** para sesiones más seguras
3. **2FA (Two-Factor Authentication)** para admin
4. **Permisos dinámicos** basados en atributos (ABAC)
5. **Rotación automática de tokens**
6. **Dashboard de auditoría** para visualizar acciones
7. **Rate limiting** por rol
8. **Políticas de contraseña** enforzadas

---

## 📞 Soporte

Para cambios o consultas sobre la estructura RBAC:
1. Verificar matriz de permisos en `backend/src/config/roles.js`
2. Revisar middleware en `backend/src/middleware/auth.js`
3. Consultar composable en `frontend/src/composables/useAuth.ts`
4. Usar `ProtectedRoute.vue` para componentes seguros en el frontend
