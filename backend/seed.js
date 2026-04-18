const admin = require('firebase-admin');
const serviceAccount = require('./config/firebase-key.json');

// Inicializar conexión
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Datos de prueba basados en tus reportes de ILPEA
const rutasDePrueba = [
  {
    ruta: 1,
    "tipo de unidad": "Autobus",
    capacidad_real: 30,
    max_pasajeros_dia: 26,
    porcentaje_ocupacion_max: 86.6,
    alerta_ocupacion: "OK",
    sugerencia_right_sizing: "MANTENER UNIDAD"
  },
  {
    ruta: 6,
    "tipo de unidad": "Van",
    capacidad_real: 12,
    max_pasajeros_dia: 3,
    porcentaje_ocupacion_max: 25.0,
    alerta_ocupacion: "CANCELAR RUTA - Menor al 40%",
    sugerencia_right_sizing: "MANTENER UNIDAD"
  },
  {
    ruta: 8,
    "tipo de unidad": "Autobus",
    capacidad_real: 30,
    max_pasajeros_dia: 21,
    porcentaje_ocupacion_max: 70.0,
    alerta_ocupacion: "OK",
    sugerencia_right_sizing: "MANTENER UNIDAD"
  },
  {
    ruta: 14,
    "tipo de unidad": "Van",
    capacidad_real: 12,
    max_pasajeros_dia: 3,
    porcentaje_ocupacion_max: 25.0,
    alerta_ocupacion: "CANCELAR RUTA - Menor al 40%",
    sugerencia_right_sizing: "MANTENER UNIDAD"
  }
];

async function insertarDatos() {
  console.log("🚀 Iniciando inserción de datos de prueba...");
  const batch = db.batch();

  rutasDePrueba.forEach((data) => {
    const docRef = db.collection('rutas').doc(`Ruta_${data.ruta}`);
    batch.set(docRef, data);
  });

  await batch.commit();
  console.log("✅ ¡Datos insertados correctamente! Revisa tu Frontend ahora.");
  process.exit();
}

insertarDatos().catch(console.error);