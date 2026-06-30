/**
 * Rellena id_empleado faltantes para usuarios con rol EMPLEADO.
 * Uso: node backfill-id-empleados.js
 */

const admin = require('firebase-admin');

const serviceAccount = require('./backend/config/firebase-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function generarIdBase(uid) {
  return `EMP-${String(uid || '').slice(-6).toUpperCase()}`;
}

function generarIdConSufijo(baseId, sufijo) {
  return `${baseId}${String(sufijo).padStart(2, '0')}`;
}

async function backfillIdsEmpleado() {
  try {
    console.log('Iniciando backfill de id_empleado para EMPLEADO...');

    const snapshot = await db.collection('usuarios').where('rol', '==', 'EMPLEADO').get();

    if (snapshot.empty) {
      console.log('No se encontraron usuarios con rol EMPLEADO.');
      return;
    }

    const usados = new Set();
    const faltantes = [];

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const idEmpleado = String(data.id_empleado || '').trim();
      if (idEmpleado) {
        usados.add(idEmpleado);
      } else {
        faltantes.push({ uid: doc.id, ref: doc.ref });
      }
    });

    if (!faltantes.length) {
      console.log('No hay empleados con id_empleado faltante.');
      return;
    }

    const batch = db.batch();

    faltantes.forEach((empleado) => {
      const base = generarIdBase(empleado.uid);
      let candidato = base;
      let contador = 1;

      while (usados.has(candidato)) {
        contador += 1;
        candidato = generarIdConSufijo(base, contador);
      }

      usados.add(candidato);
      batch.update(empleado.ref, {
        id_empleado: candidato,
        actualizado_en: new Date(),
        actualizado_por: 'script-backfill-id-empleado',
      });

      console.log(`Asignado ${candidato} a UID ${empleado.uid}`);
    });

    await batch.commit();

    console.log(`Backfill completado. Registros actualizados: ${faltantes.length}`);
  } catch (error) {
    console.error('Error ejecutando backfill:', error.message);
    process.exitCode = 1;
  }
}

backfillIdsEmpleado();
