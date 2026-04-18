/**
 * Script para inicializar usuarios en Firestore con roles RBAC
 * Ejecutar: node seed-usuarios.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase
const serviceAccount = require('./backend/config/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const PASSWORDS_SEED = {
  ADMIN: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
  JEFE: process.env.SEED_JEFE_PASSWORD || 'Jefe123!',
  EMPLEADO: process.env.SEED_EMPLEADO_PASSWORD || 'Empleado123!'
};

function esErrorAuthNoConfigurado(error) {
  const mensaje = String(error?.message || '').toLowerCase();
  return mensaje.includes('no configuration corresponding to the provided identifier');
}

// Datos de usuarios iniciales
const USUARIOS_INICIALES = [
  {
    email: 'admin@ilpea.test',
    password: PASSWORDS_SEED.ADMIN,
    nombre: 'Administrador Principal',
    rol: 'ADMIN',
    jefe_uid: null
  },
  {
    email: 'jefe@ilpea.test',
    password: PASSWORDS_SEED.JEFE,
    nombre: 'Jefe de Turno',
    rol: 'JEFE',
    jefe_uid: null
  },
  {
    email: 'empleado@ilpea.test',
    password: PASSWORDS_SEED.EMPLEADO,
    nombre: 'Empleado de Ejemplo',
    rol: 'EMPLEADO',
    jefe_uid: null
  }
];

async function seedUsuarios() {
  try {
    console.log('🌱 Iniciando seeding de usuarios...\n');

    // Pre-check: valida que Firebase Authentication esté configurado en el proyecto
    try {
      await auth.listUsers(1);
    } catch (error) {
      if (esErrorAuthNoConfigurado(error)) {
        console.error('❌ Firebase Authentication no está configurado para este proyecto.');
        console.error('   Pasos: Firebase Console > Authentication > Get started');
        console.error('   Luego habilita: Sign-in method > Email/Password');
        console.error('   Project ID detectado:', serviceAccount.project_id);
        process.exit(1);
      }
      throw error;
    }

    const uidsCreado = {};

    for (const usuarioData of USUARIOS_INICIALES) {
      try {
        // 1. Crear usuario en Firebase Auth
        const userRecord = await auth.createUser({
          email: usuarioData.email,
          password: usuarioData.password,
          displayName: usuarioData.nombre,
          emailVerified: false
        });

        uidsCreado[usuarioData.rol] = userRecord.uid;

        console.log(`✅ Usuario creado en Auth: ${usuarioData.email} (UID: ${userRecord.uid})`);

        const jefeUidFinal = usuarioData.rol === 'EMPLEADO'
          ? uidsCreado.JEFE || null
          : null;
        const idEmpleadoFinal = usuarioData.rol === 'EMPLEADO'
          ? `EMP-${userRecord.uid.slice(-6).toUpperCase()}`
          : null;

        // 2. Guardar datos adicionales en Firestore
        await db.collection('usuarios').doc(userRecord.uid).set({
          ...(idEmpleadoFinal ? { id_empleado: idEmpleadoFinal } : {}),
          email: usuarioData.email,
          nombre: usuarioData.nombre,
          rol: usuarioData.rol,
          jefe_uid: jefeUidFinal,
          activo: true,
          creado_en: new Date(),
          creado_por: 'sistema',
          ultimo_login: null,
          metadata: {
            tipo_usuario: usuarioData.rol,
            permisos_iniciales: true
          }
        });

        console.log(`✅ Documento creado en Firestore\n`);

      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          console.log(`⚠️  ${usuarioData.email} ya existe. Saltando...\n`);
        } else if (esErrorAuthNoConfigurado(error)) {
          console.error('❌ Firebase Authentication no está configurado (Get started + Email/Password).');
          process.exit(1);
        } else {
          console.error(`❌ Error creando ${usuarioData.email}:`, error.message);
        }
      }
    }

    console.log('🎉 Seeding completado!');
    console.log('\n📋 Usuarios creados:');
    USUARIOS_INICIALES.forEach(u => {
      console.log(`   • ${u.email} (${u.rol})`);
    });
    console.log('\n⚠️  Guarda estas contraseñas en un lugar seguro o cámbialas después.');

  } catch (error) {
    console.error('❌ Error fatal:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar seeding
seedUsuarios();
