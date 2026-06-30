/**
 * Crea o actualiza usuarios de acceso para paneles (ADMIN, JEFE, EMPLEADO)
 * con credenciales conocidas para pruebas.
 *
 * Uso:
 *   node seed-accesos-paneles.js
 */

const admin = require('firebase-admin');

const serviceAccount = require('./backend/config/firebase-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

const CREDENCIALES = {
  admin: {
    email: process.env.PANEL_ADMIN_EMAIL || 'admin.panel@ilpea.test',
    password: process.env.PANEL_ADMIN_PASSWORD || 'Admin123!',
    nombre: 'Administrador Panel',
    rol: 'ADMIN',
  },
  jefe: {
    email: process.env.PANEL_JEFE_EMAIL || 'jefe.panel@ilpea.test',
    password: process.env.PANEL_JEFE_PASSWORD || 'Jefe123!',
    nombre: 'Jefe Panel',
    rol: 'JEFE',
  },
  empleado: {
    email: process.env.PANEL_EMPLEADO_EMAIL || 'empleado.panel@ilpea.test',
    password: process.env.PANEL_EMPLEADO_PASSWORD || 'Empleado123!',
    nombre: 'Empleado Panel',
    rol: 'EMPLEADO',
  },
};

function esUsuarioNoEncontrado(error) {
  return error && error.code === 'auth/user-not-found';
}

async function upsertAuthUser({ email, password, nombre }) {
  try {
    const existente = await auth.getUserByEmail(email);
    const actualizado = await auth.updateUser(existente.uid, {
      password,
      displayName: nombre,
      disabled: false,
    });
    return { uid: actualizado.uid, creado: false };
  } catch (error) {
    if (!esUsuarioNoEncontrado(error)) {
      throw error;
    }

    const creado = await auth.createUser({
      email,
      password,
      displayName: nombre,
      disabled: false,
      emailVerified: false,
    });

    return { uid: creado.uid, creado: true };
  }
}

function idEmpleadoDesdeUid(uid) {
  return `EMP-${String(uid || '').slice(-6).toUpperCase()}`;
}

async function upsertFirestoreUsuario(uid, payload) {
  await db.collection('usuarios').doc(uid).set(payload, { merge: true });
}

async function seedAccesosPaneles() {
  try {
    console.log('Iniciando insercion/upsert de accesos para paneles...');

    const adminAuth = await upsertAuthUser(CREDENCIALES.admin);
    const jefeAuth = await upsertAuthUser(CREDENCIALES.jefe);
    const empleadoAuth = await upsertAuthUser(CREDENCIALES.empleado);

    const ahora = new Date();

    await upsertFirestoreUsuario(adminAuth.uid, {
      email: CREDENCIALES.admin.email,
      nombre: CREDENCIALES.admin.nombre,
      rol: CREDENCIALES.admin.rol,
      activo: true,
      jefe_uid: null,
      actualizado_en: ahora,
      actualizado_por: 'seed-accesos-paneles',
      creado_en: ahora,
      creado_por: 'seed-accesos-paneles',
    });

    await upsertFirestoreUsuario(jefeAuth.uid, {
      email: CREDENCIALES.jefe.email,
      nombre: CREDENCIALES.jefe.nombre,
      rol: CREDENCIALES.jefe.rol,
      activo: true,
      jefe_uid: null,
      actualizado_en: ahora,
      actualizado_por: 'seed-accesos-paneles',
      creado_en: ahora,
      creado_por: 'seed-accesos-paneles',
    });

    await upsertFirestoreUsuario(empleadoAuth.uid, {
      email: CREDENCIALES.empleado.email,
      nombre: CREDENCIALES.empleado.nombre,
      rol: CREDENCIALES.empleado.rol,
      activo: true,
      id_empleado: idEmpleadoDesdeUid(empleadoAuth.uid),
      jefe_uid: jefeAuth.uid,
      actualizado_en: ahora,
      actualizado_por: 'seed-accesos-paneles',
      creado_en: ahora,
      creado_por: 'seed-accesos-paneles',
    });

    console.log('OK: accesos de panel listos.');
    console.log('');
    console.log('ADMIN    ->', CREDENCIALES.admin.email, '|', CREDENCIALES.admin.password);
    console.log('JEFE     ->', CREDENCIALES.jefe.email, '|', CREDENCIALES.jefe.password);
    console.log('EMPLEADO ->', CREDENCIALES.empleado.email, '|', CREDENCIALES.empleado.password);
    console.log('');
    console.log('Nota: Si ya existian, se actualizaron password/rol/datos para garantizar acceso.');
  } catch (error) {
    console.error('Error en seed-accesos-paneles:', error.message);
    process.exitCode = 1;
  }
}

seedAccesosPaneles();
