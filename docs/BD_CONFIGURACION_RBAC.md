# 🗄️ Guía de Configuración de Base de Datos para RBAC

## 📊 Comparativa: Firestore vs SQL

| Aspecto | Firestore | SQL (MariaDB/PostgreSQL) |
|---------|-----------|-------------------------|
| **Escalabilidad** | Excelente (NoSQL) | Muy buena |
| **Complejidad** | Baja | Media-Alta |
| **Auditoría** | Manual (registrar en colección) | Nativa con triggers |
| **Relaciones** | Flexibles | Estrictas |
| **Costos** | Pay-per-use | Hosting dedicado |
| **Setup inicial** | Rápido | Más lento |
| **Consultas complejas** | SQL emulado | SQL puro |

---

## ✅ **Opción 1: Firestore (Recomendado - Ya lo usas)**

### Paso 1: Ejecutar script de seeding

```bash
cd d:\PrograWEB\src\ILPEA-TRANSPORTS

# Instalar dependencies si no las tienes
npm install firebase-admin

# Ejecutar script
node seed-usuarios.js
```

**Output esperado:**
```
🌱 Iniciando seeding de usuarios...

✅ Usuario creado en Auth: admin@ilpea.test (UID: xyz123)
✅ Documento creado en Firestore

✅ Usuario creado en Auth: jefe@ilpea.test (UID: abc456)
✅ Documento creado en Firestore

✅ Usuario creado en Auth: empleado@ilpea.test (UID: def789)
✅ Documento creado en Firestore

🎉 Seeding completado!

📋 Usuarios creados:
   • admin@ilpea.test (ADMIN)
   • jefe@ilpea.test (JEFE)
   • empleado@ilpea.test (EMPLEADO)
```

### Paso 2: Verificar en Firestore Console

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Seleccionar tu proyecto
3. Ir a Firestore Database
4. Buscar colección `usuarios`
5. Deberías ver 3 documentos con estructura:
```json
{
  "email": "admin@ilpea.test",
  "nombre": "Administrador Principal",
  "rol": "ADMIN",
  "activo": true,
  "creado_en": "2026-04-17...",
  "creado_por": "sistema"
}
```

### Paso 3: Cambiar contraseñas

En Firestore console o vía código:
```javascript
// En backend
const { auth } = require('firebase-admin');

await auth.updateUser('uid-aqui', {
  password: 'nueva-contraseña-segura'
});
```

---

## 🗄️ **Opción 2: SQL (MariaDB/PostgreSQL)**

### Paso 1: Ejecutar script SQL

Si tienes MariaDB/PostgreSQL corriendo:

```bash
# MariaDB
mysql -h localhost -u root -p < init-rbac.sql

# PostgreSQL
psql -U usuario -d base_datos -f init-rbac.sql
```

### Paso 2: Verificar tablas creadas

```sql
-- MariaDB/PostgreSQL
SHOW TABLES;

-- Deberías ver:
-- - roles
-- - usuarios
-- - permisos
-- - rol_permisos
-- - acciones_auditoria
-- - v_usuarios_con_permisos (vista)
-- - v_auditoria_acciones (vista)
```

### Paso 3: Consultar usuarios

```sql
-- Ver usuarios con roles y permisos
SELECT * FROM v_usuarios_con_permisos;

-- Resultado:
-- id | uid | email | nombre | rol | permisos | activo | creado_en
-- 1 | firebase-uid-admin-001 | admin@ilpea.test | Admin... | ADMIN | (todos) | 1 | ...
```

---

## 🔀 Integración Backend con BD

### Si usas Firestore (actual)

El código backend **ya está listo**. Los endpoints crean usuarios así:

```javascript
// backend/src/server.js
app.post('/api/usuarios/crear', autorizar('usuarios:crear'), async (req, res) => {
  const { email, nombre, rol, password } = req.body;
  
  // 1. Crear en Firebase Auth
  const userRecord = await admin.auth().createUser({
    email, password, displayName: nombre
  });
  
  // 2. Guardar en Firestore
  await db.collection('usuarios').doc(userRecord.uid).set({
    email, nombre, rol, creado_en: new Date(), ...
  });
});
```

### Si quieres migrar a SQL

Necesitarías actualizar el backend para usar MySQL en lugar de Firestore:

```bash
npm install mysql2 sequelize  # ORM para SQL
```

Entonces cambiar calls a:

```javascript
const db = require('./database'); // Conexión MySQL

// Crear usuario
await db.query('INSERT INTO usuarios (uid, email, nombre, id_rol, creado_en) VALUES (?, ?, ?, ?, NOW())',
  [uid, email, nombre, rolId]
);

// Ver permisos
const permisos = await db.query(`
  SELECT p.codigo FROM usuarios u
  JOIN rol_permisos rp ON u.id_rol = rp.id_rol
  JOIN permisos p ON rp.id_permiso = p.id
  WHERE u.email = ?
`, [email]);
```

---

## 🔐 Seguridad: Cambiar Contraseñas Iniciales

### Opción A: Forzar cambio al primer login

```typescript
// frontend/composables/useAuth.ts
const login = async (email, password) => {
  // ...
  if (usuario.valor.primera_vez_login) {
    router.push('/cambiar-contrasena');
  }
};
```

### Opción B: Contraseñas temporales

```javascript
// backend - generar contraseña aleatoria
const generarContrasenaTemporal = () => {
  return Math.random().toString(36).slice(-10) + 'Ab1!';
};

// En seed:
const password = generarContrasenaTemporal();
console.log(`Contraseña temporal: ${password}`);
```

---

## 📋 Checklist de Implementación

### Opción Firestore
- [ ] Ejecutar `node seed-usuarios.js`
- [ ] Verificar colección `usuarios` en Firestore Console
- [ ] Probar login con credenciales
- [ ] Cambiar contraseñas por seguridad
- [ ] Probar endpoints RBAC con diferentes roles

### Opción SQL
- [ ] Ejecutar `init-rbac.sql` en tu BD
- [ ] Verificar tablas creadas con `SHOW TABLES`
- [ ] Adaptar backend para usar MySQL (si lo necesitas)
- [ ] Probar queries de usuarios y permisos
- [ ] Crear endpoint `/api/usuarios` que consulte tablas

---

## 🧪 Testear RBAC con Datos

### Test 1: Crear usuario como ADMIN
```bash
curl -X POST http://localhost:3000/api/usuarios/crear \
  -H "X-User-Role: ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nuevo@ilpea.test",
    "nombre": "Nuevo Usuario",
    "rol": "JEFE",
    "password": "Segura123!"
  }'

# Esperado: 201 Created
```

### Test 2: Intentar como JEFE (sin permiso)
```bash
curl -X POST http://localhost:3000/api/usuarios/crear \
  -H "X-User-Role: JEFE" \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# Esperado: 403 Forbidden
# "Tu rol (JEFE) no tiene acceso a esta acción."
```

### Test 3: Ver usuarios como ADMIN
```bash
curl http://localhost:3000/api/usuarios \
  -H "X-User-Role: ADMIN"

# Esperado: 200 OK
# [
#   { uid: "...", email: "admin@ilpea.test", rol: "ADMIN", ... },
#   { uid: "...", email: "jefe@ilpea.test", rol: "JEFE", ... },
#   ...
# ]
```

---

## 📊 Estructura Final de Datos

### Firestore
```
firestore/
├── usuarios/
│   ├── {uid1} → {email, nombre, rol: "ADMIN", ...}
│   ├── {uid2} → {email, nombre, rol: "JEFE", ...}
│   └── {uid3} → {email, nombre, rol: "EMPLEADO", ...}
│
├── rutas/
│   └── {...}
│
├── programacion_diaria/
│   └── {...}
│
└── acciones/
    └── {timestamp, usuario_id, rol, metodo, ruta, ...}
```

### SQL
```
Database: ilpea
├── roles (3 registros: ADMIN, JEFE, EMPLEADO)
├── usuarios (N usuarios con id_rol)
├── permisos (17 permisos diferentes)
├── rol_permisos (relación M:M)
└── acciones_auditoria (auditoría)
```

---

## ❓ FAQ

**P: ¿Puedo usar ambas (Firestore y SQL) juntas?**  
A: Sí, pero no es recomendado. Mantén la fuente de verdad en una sola.

**P: ¿Cómo sincronizo cambios de roles?**  
A: En tiempo real con listeners de Firestore o polling de SQL.

**P: ¿Qué pasa si cambio el rol de un usuario mientras está logueado?**  
A: Necesita refrescar el token o página para que tomen efecto.

**P: ¿Puedo agregar más roles (ej: SUPERVISOR)?**  
A: Sí, agregar a `init-rbac.sql` o crear en Firestore directamente.

**P: ¿Los permisos se cachean?**  
A: En frontend sí (localStorage). El backend verifica en cada request.

---

## 🚀 Próximos Pasos

1. **Elige tu BD**: Firestore (actual) o SQL
2. **Ejecuta script**: `seed-usuarios.js` o `init-rbac.sql`
3. **Verifica datos**: Firestore Console o CLI SQL
4. **Prueba endpoints**: Con curl o Postman
5. **Testea vistas**: Login y protecciones de RBAC
6. **Cambia contraseñas**: Usa credenciales seguras

¿Alguna pregunta sobre la estructura de BD?
