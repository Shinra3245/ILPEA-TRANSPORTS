# RBAC - Guía Rápida de Implementación

## 📦 Archivos Creados/Modificados

### Backend
```
backend/
├── src/
│   ├── config/
│   │   └── roles.js (NUEVO) - Configuración de roles y permisos
│   ├── middleware/
│   │   └── auth.js (NUEVO) - Middleware de autenticación y autorización
│   └── server.js (MODIFICADO) - Endpoints protegidos con RBAC
```

### Frontend
```
frontend/src/
├── composables/
│   └── useAuth.ts (NUEVO) - Composable para manejo de autenticación
├── components/
│   └── ProtectedRoute.vue (NUEVO) - Componente guardado por permisos
└── views/
    ├── Login.vue (MODIFICADO) - Agregado rol EMPLEADO
    └── EmpleadoDashboard.vue (NUEVO) - Dashboard para empleados
```

### Documentación
```
├── RBAC_DOCUMENTACION.md (NUEVO) - Documentación completa del RBAC
└── RBAC_GUIA_RAPIDA.md (NUEVO) - Este archivo
```

---

## 🎯 Tres Roles Implementados

### 1️⃣ ADMIN (Color: Negro/Azul oscuro)
```
✅ Acceso total
✅ Gestiona usuarios
✅ Gestiona rutas
✅ Ve todos los dashboards
✅ Sincroniza datos Python
```

### 2️⃣ JEFE (Color: Azul)
```
✅ Gestiona asignaciones
✅ Monitorea rutas
✅ Usa copiloto IA
✅ Ve insights
❌ No puede gestionar usuarios
❌ No puede sincronizar datos
```

### 3️⃣ EMPLEADO (Color: Verde)
```
✅ Ve su ruta asignada
✅ Ve su estado de viaje
❌ No puede asignar rutas
❌ No puede usar copiloto
❌ No puede gestionar nada
```

---

## 🔑 Funciones Clave

### Backend - Verificar Permiso
```javascript
// En server.js
const { tienePermiso } = require('./config/roles');

app.post('/api/action', autorizar('action:permiso'), (req, res) => {
  // Solo usuarios con permiso 'action:permiso' pueden acceder
});
```

### Backend - Múltiples Permisos (OR)
```javascript
app.post('/api/chat', 
  autorizar(['chat:enviar', 'insights:ver']), 
  (req, res) => {
    // Permite si tiene chat:enviar O insights:ver
  }
);
```

### Frontend - Verificar Rol
```typescript
import { useAuth } from '@/composables/useAuth'

const { tieneRol } = useAuth()

if (tieneRol('ADMIN')) {
  // Mostrar opciones de admin
}

// Múltiples roles
if (tieneRol(['ADMIN', 'JEFE'])) {
  // Mostrar si es admin o jefe
}
```

### Frontend - Verificar Permiso
```typescript
const { tienePermiso } = useAuth()

if (tienePermiso('usuarios:crear')) {
  // Mostrar botón crear usuario
}
```

### Frontend - Proteger Componente
```vue
<template>
  <!-- Solo admins pueden ver -->
  <ProtectedRoute require-rol="ADMIN">
    <AdminPanel />
  </ProtectedRoute>

  <!-- Solo quien pueda editar rutas -->
  <ProtectedRoute require-permiso="rutas:actualizar">
    <EditarRuta />
  </ProtectedRoute>
</template>
```

---

## 🧪 Probando en Desarrollo

### 1. Login con diferentes roles
Ir a `http://localhost:5173/login` y seleccionar:
- 👨‍💼 ADMIN → `/admin`
- 👔 JEFE → `/jefe`
- 👷 EMPLEADO → `/empleado`

### 2. Probar endpoint con rol simulado
```bash
# Como ADMIN
curl -H "X-User-Role: ADMIN" http://localhost:3000/api/usuarios

# Como JEFE (sin permiso)
curl -H "X-User-Role: JEFE" http://localhost:3000/api/usuarios
# → 403 Forbidden: "Tu rol (JEFE) no tiene acceso a esta acción."

# Como EMPLEADO (sin permiso)
curl -H "X-User-Role: EMPLEADO" http://localhost:3000/api/usuarios
# → 403 Forbidden
```

### 3. Ver datos del usuario en DevTools
```javascript
// Consola del navegador
localStorage.getItem('usuario')
// {"email":"admin@ilpea.test","rol":"ADMIN","nombre":"Administrador"}
```

---

## 📋 Matriz de Permisos Completa

| Acción | ADMIN | JEFE | EMPLEADO |
|--------|:-----:|:----:|:--------:|
| rutas:ver | ✅ | ✅ | ✅ |
| rutas:crear | ✅ | ❌ | ❌ |
| rutas:actualizar | ✅ | ✅ | ❌ |
| rutas:eliminar | ✅ | ❌ | ❌ |
| rutas:sync | ✅ | ❌ | ❌ |
| asignacion:crear | ✅ | ✅ | ❌ |
| asignacion:ver | ✅ | ✅ | ✅ |
| asignacion:cancelar | ✅ | ✅ | ❌ |
| chat:enviar | ✅ | ✅ | ❌ |
| insights:ver | ✅ | ✅ | ❌ |
| dashboard:admin | ✅ | ❌ | ❌ |
| dashboard:jefe | ✅ | ✅ | ❌ |
| dashboard:empleado | ✅ | ✅ | ✅ |
| usuarios:ver | ✅ | ❌ | ❌ |
| usuarios:crear | ✅ | ❌ | ❌ |
| usuarios:actualizar | ✅ | ❌ | ❌ |
| usuarios:eliminar | ✅ | ❌ | ❌ |

---

## 🔄 Endpoints Nuevos para Gestión de Usuarios

```bash
# Crear usuario (solo ADMIN)
POST /api/usuarios/crear
Body: { email, nombre, rol, password }

# Listar usuarios (solo ADMIN)
GET /api/usuarios

# Cambiar rol de usuario (solo ADMIN)
PUT /api/usuarios/:uid/rol
Body: { rol }

# Eliminar usuario (solo ADMIN)
DELETE /api/usuarios/:uid

# Obtener datos del usuario actual
GET /api/auth/me

# Login simulado (para desarrollo)
POST /api/auth/login
Body: { email, rol }
```

---

## 🚀 Migrar a Firebase Auth Real

Cambiar en `backend/src/server.js`:

```javascript
// De:
app.use((req, res, next) => {
  // ... líneas
  return autenticarSimulado(req, res, next);
});

// A:
app.use((req, res, next) => {
  // ... líneas
  return autenticar(req, res, next); // Firebase real
});
```

---

## 🐛 Troubleshooting

### "Permiso denegado" cuando debería tener acceso
→ Verificar en `backend/src/config/roles.js` que el rol está en la lista de permisos

### El usuario no persiste después de refresh
→ Usar `cargarUsuarioGuardado()` en `onMounted()` del componente principal

### ProtectedRoute no funciona
→ Asegurarse de importar correctamente:
```typescript
import ProtectedRoute from '@/components/ProtectedRoute.vue'
```

### Endpoint retorna 401 aunque está autenticado
→ En desarrollo, asegurarse de pasar header `X-User-Role`
```bash
curl -H "X-User-Role: ADMIN" http://localhost:3000/api/endpoint
```

---

## 📊 Estructura de Datos en localStorage

```javascript
{
  usuario: {
    email: "admin@ilpea.test",
    nombre: "Administrador",
    rol: "ADMIN"
  },
  userRole: "ADMIN" // Compatibilidad con código anterior
}
```

---

## 💡 Tips

1. **Reutilizar ProtectedRoute** en todo componente sensible
2. **Combinar verificaciones** en frontend y backend (defensa en profundidad)
3. **Registrar acciones** en Firestore para auditoría
4. **Actualizar PERMISOS** en `roles.js` cuando agregues nuevas acciones
5. **Probar con todos los roles** antes de hacer deploy

---

## ✅ Checklist para Agregar Nueva Acción

1. [ ] Agregar en `PERMISOS` en `backend/src/config/roles.js`
2. [ ] Agregar middleware `autorizar('nueva:accion')` en endpoint
3. [ ] Actualizar matriz de permisos en Frontend
4. [ ] Actualizar `tienePermiso()` en `useAuth.ts`
5. [ ] Proteger componentes con `ProtectedRoute`
6. [ ] Documentar en `RBAC_DOCUMENTACION.md`
7. [ ] Probar con cada rol

---

## 📞 Contacto

Documentación completa: `RBAC_DOCUMENTACION.md`
Código: Ver archivos en Backend y Frontend
