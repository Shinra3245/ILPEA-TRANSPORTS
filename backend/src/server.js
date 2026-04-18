// backend/src/server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Importar configuración de RBAC
const { ROLES, obtenerPermisosDelRol } = require('./config/roles');
const { autenticar, autorizar, autenticarSimulado, registrarAccion } = require('./middleware/auth');

function cargarCredencialesFirebase() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const keyPath = process.env.FIREBASE_KEY_PATH
    ? path.resolve(__dirname, process.env.FIREBASE_KEY_PATH)
    : path.resolve(__dirname, '../config/firebase-key.json');

  return require(keyPath);
}

const serviceAccount = cargarCredencialesFirebase();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function generarPasswordTemporal(longitud = 12) {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let resultado = '';

  for (let i = 0; i < longitud; i += 1) {
    resultado += caracteres[crypto.randomInt(0, caracteres.length)];
  }

  return resultado;
}

async function generarIdEmpleadoUnico() {
  const maxIntentos = 20;

  for (let intento = 0; intento < maxIntentos; intento += 1) {
    const candidato = `EMP-${crypto.randomInt(100000, 999999)}`;
    const existe = await db
      .collection('usuarios')
      .where('id_empleado', '==', candidato)
      .limit(1)
      .get();

    if (existe.empty) {
      return candidato;
    }
  }

  throw new Error('No se pudo generar un ID de empleado único. Intenta nuevamente.');
}

function construirIdEmpleadoDesdeUid(uid) {
  const fragmento = String(uid || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();

  if (!fragmento) {
    return `EMP-${crypto.randomInt(100000, 999999)}`;
  }

  return `EMP-${fragmento}`;
}

async function generarIdEmpleadoDeterministicoUnico(uid, idsReservados = new Set()) {
  const base = construirIdEmpleadoDesdeUid(uid);
  let candidato = base;
  let intento = 1;

  while (idsReservados.has(candidato)) {
    intento += 1;
    candidato = `${base}${String(intento).padStart(2, '0')}`;
  }

  while (true) {
    const existe = await db
      .collection('usuarios')
      .where('id_empleado', '==', candidato)
      .limit(1)
      .get();

    if (existe.empty || existe.docs[0].id === uid) {
      idsReservados.add(candidato);
      return candidato;
    }

    intento += 1;
    candidato = `${base}${String(intento).padStart(2, '0')}`;
  }
}

async function asegurarIdEmpleadoPersistido(doc, idsReservados = new Set()) {
  const data = doc.data() || {};
  const idActual = String(data.id_empleado || '').trim();

  if (idActual) {
    idsReservados.add(idActual);
    return idActual;
  }

  const idGenerado = await generarIdEmpleadoDeterministicoUnico(doc.id, idsReservados);
  await doc.ref.set({
    id_empleado: idGenerado,
    actualizado_en: new Date(),
    actualizado_por: 'auto-backfill-id-empleado'
  }, { merge: true });

  return idGenerado;
}

function normalizarEmpleado(doc) {
  const data = doc.data();
  return {
    uid: doc.id,
    id_empleado: data.id_empleado,
    email: data.email,
    nombre: data.nombre,
    rol: data.rol,
    jefe_uid: data.jefe_uid || null,
    activo: data.activo,
    creado_en: data.creado_en,
    actualizado_en: data.actualizado_en,
    creado_por: data.creado_por,
    actualizado_por: data.actualizado_por
  };
}

function normalizarJefe(doc) {
  const data = doc.data();
  return {
    uid: doc.id,
    email: data.email,
    nombre: data.nombre,
    rol: data.rol,
    activo: data.activo,
    creado_en: data.creado_en,
    actualizado_en: data.actualizado_en,
    creado_por: data.creado_por,
    actualizado_por: data.actualizado_por
  };
}

function puedeGestionarEmpleado(usuario, empleadoData) {
  if (!usuario || !empleadoData) {
    return false;
  }

  if (usuario.rol === ROLES.ADMIN) {
    return true;
  }

  return usuario.rol === ROLES.JEFE && empleadoData.jefe_uid === usuario.uid;
}

function textoNormalizado(valor) {
  return String(valor || '').trim();
}

function turnoNormalizado(turno) {
  return textoNormalizado(turno).toLowerCase();
}

function construirIdsProgramacion(fecha, idRuta, turno) {
  const fechaTexto = textoNormalizado(fecha);
  const idRutaTexto = textoNormalizado(idRuta);
  const turnoTexto = turnoNormalizado(turno);
  const ids = [];

  if (turnoTexto) {
    ids.push(`${fechaTexto}_${turnoTexto}_${idRutaTexto}`);
  }

  ids.push(`${fechaTexto}_${idRutaTexto}`);
  return ids;
}

function normalizarAsientosReservados(asientos) {
  if (!Array.isArray(asientos)) {
    return [];
  }

  return [...new Set(asientos
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0))]
    .sort((a, b) => a - b);
}

function normalizarAsientosPorEmpleado(mapa) {
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) {
    return {};
  }

  const resultado = {};

  Object.entries(mapa).forEach(([idEmpleado, asiento]) => {
    const id = textoNormalizado(idEmpleado);
    const asientoNumero = Number(asiento);

    if (id && Number.isInteger(asientoNumero) && asientoNumero > 0) {
      resultado[id] = asientoNumero;
    }
  });

  return resultado;
}

async function leerDoc(ref, transaction = null) {
  if (transaction) {
    return transaction.get(ref);
  }

  return ref.get();
}

async function leerQuery(query, transaction = null) {
  if (transaction) {
    return transaction.get(query);
  }

  return query.get();
}

async function resolverRutaPorIdentificador(idRuta, transaction = null) {
  const idRutaTexto = textoNormalizado(idRuta);
  if (!idRutaTexto) {
    return null;
  }

  const rutasRef = db.collection('rutas');
  const rutaDirectaRef = rutasRef.doc(idRutaTexto);
  const rutaDirecta = await leerDoc(rutaDirectaRef, transaction);
  if (rutaDirecta.exists) {
    return {
      id: rutaDirecta.id,
      ref: rutaDirectaRef,
      data: rutaDirecta.data() || {}
    };
  }

  const numeroRuta = Number(idRutaTexto);
  if (!Number.isNaN(numeroRuta)) {
    const consultaNumero = rutasRef.where('ruta', '==', numeroRuta).limit(1);
    const rutaPorNumero = await leerQuery(consultaNumero, transaction);

    if (!rutaPorNumero.empty) {
      const doc = rutaPorNumero.docs[0];
      return {
        id: doc.id,
        ref: doc.ref,
        data: doc.data() || {}
      };
    }
  }

  return null;
}

async function resolverProgramacion(fecha, idRuta, turno, transaction = null) {
  const idsProgramacion = construirIdsProgramacion(fecha, idRuta, turno);

  for (const programacionId of idsProgramacion) {
    const ref = db.collection('programacion_diaria').doc(programacionId);
    const doc = await leerDoc(ref, transaction);
    if (doc.exists) {
      return {
        docId: programacionId,
        docRef: ref,
        data: doc.data() || {}
      };
    }
  }

  const docIdPrincipal = idsProgramacion[0];
  return {
    docId: docIdPrincipal,
    docRef: db.collection('programacion_diaria').doc(docIdPrincipal),
    data: null
  };
}

function construirProgramacionBase({ fecha, idRuta, turno, rutaData, uidCreador }) {
  const capacidad = Number(rutaData.capacidad_real) || 12;

  return {
    fecha: textoNormalizado(fecha),
    turno: turnoNormalizado(turno) || null,
    id_ruta: textoNormalizado(idRuta),
    capacidad_limite: capacidad,
    asientos_ocupados: 0,
    asientos_reservados: [],
    pasajeros_ids: [],
    asientos_por_empleado: {},
    programada_auto: true,
    zona: rutaData.zona || rutaData.nombre || null,
    tipo_unidad: rutaData['tipo de unidad'] || null,
    creado_en: new Date(),
    creado_por: uidCreador,
    actualizado_en: new Date(),
    actualizado_por: uidCreador
  };
}

function crearClienteOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const OpenAI = require('openai');
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20000,
      maxRetries: 1
    });
  } catch (error) {
    console.warn('OpenAI deshabilitado: paquete no instalado o error de carga.');
    return null;
  }
}

const openai = crearClienteOpenAI();

function esTimeoutOpenAI(error) {
  const texto = String(error?.message || '').toLowerCase();
  const nombre = String(error?.name || '').toLowerCase();
  const codigo = String(error?.code || '').toLowerCase();

  return (
    texto.includes('request timed out')
    || texto.includes('timeout')
    || nombre.includes('timeout')
    || codigo.includes('etimedout')
    || codigo.includes('timeout')
  );
}

function generarRespuestaFallback(mensajeUsuario, rutas) {
  const totalRutas = rutas.length;
  const rutasCriticas = rutas.filter((r) => Number(r.porcentaje_ocupacion_max) < 40);
  const rutasRightSizing = rutas.filter(
    (r) =>
      String(r['tipo de unidad'] || '').toLowerCase().includes('autobus') &&
      Number(r.max_pasajeros_dia) <= 12
  );

  const consulta = String(mensajeUsuario || '').toLowerCase();

  if (consulta.includes('critica') || consulta.includes('cancel') || consulta.includes('40')) {
    if (!rutasCriticas.length) return 'No hay rutas en condición crítica (< 40%) con la data actual.';
    const listado = rutasCriticas.map((r) => `Ruta ${r.ruta} (${r.porcentaje_ocupacion_max}%)`).join(', ');
    return `Rutas críticas detectadas: ${listado}. Recomiendo revisión operativa inmediata.`;
  }

  if (consulta.includes('van') || consulta.includes('right') || consulta.includes('unidad')) {
    if (!rutasRightSizing.length) return 'No hay rutas candidatas claras para cambio de unidad en este momento.';
    const listado = rutasRightSizing.map((r) => `Ruta ${r.ruta}`).join(', ');
    return `Rutas candidatas a right-sizing (Autobús -> Van): ${listado}.`;
  }

  return `Resumen rápido: ${totalRutas} rutas analizadas, ${rutasCriticas.length} con ocupación menor a 40% y ${rutasRightSizing.length} candidatas a right-sizing.`;
}

function generarInsightsLocales(rutas) {
  const insights = [];

  rutas.forEach((ruta) => {
    const rutaId = ruta.ruta ?? ruta.id ?? null;
    const nombreRuta = ruta['ruta nombre'] || ruta.nombre_ruta || ruta.nombre || `Ruta ${rutaId ?? 'sin id'}`;
    const ocupacion = Number(ruta.porcentaje_ocupacion_max);
    const pasajeros = Number(ruta.max_pasajeros_dia);
    const tipoUnidad = String(ruta['tipo de unidad'] || '').toLowerCase();

    if (!Number.isNaN(ocupacion) && ocupacion < 40) {
      insights.push({
        titulo: `Cancelar Ruta - ${nombreRuta}`,
        descripcion: `La ruta ${nombreRuta} tiene una ocupación del ${ocupacion}%, menor al 40%.`,
        prioridad: 'alta',
        ruta_id: rutaId
      });
    }

    if (tipoUnidad.includes('autobus') && !Number.isNaN(pasajeros) && pasajeros <= 12) {
      insights.push({
        titulo: `Sugerir Van - ${nombreRuta}`,
        descripcion: `La ruta ${nombreRuta} tiene ${pasajeros} pasajeros, se sugiere cambiar a una Van.`,
        prioridad: 'media',
        ruta_id: rutaId
      });
    }
  });

  return insights;
}

// Middlewares Globales
app.use(cors());
app.use(express.json()); // Permite recibir datos en formato JSON

// Middleware de autenticación (simulado para desarrollo - cambiar en producción)
// Por defecto usa Firebase Auth real. Para pruebas locales: AUTH_MODE=simulated
app.use((req, res, next) => {
  // Saltar autenticación para /api/auth/login (permitir acceso público)
  if (req.path === '/api/auth/login') {
    return next();
  }

  const modoAuth = (process.env.AUTH_MODE || 'firebase').toLowerCase();
  if (modoAuth === 'simulated') {
    return autenticarSimulado(req, res, next);
  }

  return autenticar(req, res, next);
});

// Middleware de logging/auditoría
app.use(registrarAccion('acciones'));

// Evita caída completa del proceso por errores async no manejados.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// ==========================================
// ENDPOINT 1: Obtener todas las rutas
// (Consumido por el Dashboard del Administrador, Jefe y Empleado)
// ==========================================
app.get('/api/rutas', autorizar('rutas:ver'), async (req, res) => {
  try {
    const rutasSnapshot = await db.collection('rutas').get();
    const rutas = [];
    
    rutasSnapshot.forEach(doc => {
      rutas.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json({
      success: true,
      cantidad: rutas.length,
      data: rutas
    });
  } catch (error) {
    console.error("Error obteniendo rutas:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

app.get('/api/rutas/programadas', autorizar('rutas:ver'), async (req, res) => {
  const fecha = textoNormalizado(req.query.fecha);
  const turno = turnoNormalizado(req.query.turno);

  if (!fecha) {
    return res.status(400).json({
      success: false,
      message: 'Debes enviar la fecha en query param: ?fecha=YYYY-MM-DD'
    });
  }

  try {
    const rutasSnapshot = await db.collection('rutas').get();

    const rutas = await Promise.all(rutasSnapshot.docs.map(async (rutaDoc) => {
      const rutaData = rutaDoc.data() || {};
      const programacion = await resolverProgramacion(fecha, rutaDoc.id, turno);
      const dataProgramacion = programacion.data || {};

      const capacidadLimite = Number(dataProgramacion.capacidad_limite) || Number(rutaData.capacidad_real) || 12;
      const asientosReservados = normalizarAsientosReservados(dataProgramacion.asientos_reservados);
      const asientosPorEmpleado = normalizarAsientosPorEmpleado(dataProgramacion.asientos_por_empleado);
      const pasajerosIds = Array.isArray(dataProgramacion.pasajeros_ids) ? dataProgramacion.pasajeros_ids : [];
      const asientosOcupadosDato = Number(dataProgramacion.asientos_ocupados);
      const asientosOcupados = Number.isFinite(asientosOcupadosDato)
        ? asientosOcupadosDato
        : Math.max(asientosReservados.length, pasajerosIds.length);

      return {
        id: rutaDoc.id,
        ...rutaData,
        programada: Boolean(programacion.data),
        programacion_id: programacion.docId,
        fecha_programada: fecha,
        turno_programado: dataProgramacion.turno || turno || null,
        capacidad_limite: capacidadLimite,
        asientos_ocupados: asientosOcupados,
        asientos_reservados: asientosReservados,
        asientos_por_empleado: asientosPorEmpleado,
        pasajeros_ids: pasajerosIds,
        asientos_disponibles: Math.max(capacidadLimite - asientosOcupados, 0)
      };
    }));

    rutas.sort((a, b) => Number(a.ruta || 0) - Number(b.ruta || 0));

    res.status(200).json({
      success: true,
      fecha,
      turno: turno || null,
      cantidad: rutas.length,
      cantidad_programadas: rutas.filter((ruta) => ruta.programada).length,
      data: rutas
    });
  } catch (error) {
    console.error('Error obteniendo rutas programadas:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo rutas programadas.'
    });
  }
});

// ==========================================
// ENDPOINT 2: El "Cap Check" (Asignación Atómica)
// Solo Admin y Jefe pueden asignar empleados a rutas
// ==========================================
app.post('/api/asignar', autorizar('asignacion:crear'), async (req, res) => {
  const { id_empleado, id_ruta, fecha, turno, asiento } = req.body;

  const idEmpleado = textoNormalizado(id_empleado);
  const idRutaSolicitada = textoNormalizado(id_ruta);
  const fechaAsignacion = textoNormalizado(fecha);
  const turnoAsignacion = turnoNormalizado(turno);
  const asientoAsignado = Number(asiento);

  if (!idEmpleado || !idRutaSolicitada || !fechaAsignacion) {
    return res.status(400).json({
      success: false,
      message: 'id_empleado, id_ruta y fecha son requeridos.'
    });
  }

  if (!Number.isInteger(asientoAsignado) || asientoAsignado <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Debes enviar un número de asiento válido.'
    });
  }

  try {
    const rutaEncontrada = await resolverRutaPorIdentificador(idRutaSolicitada);
    if (!rutaEncontrada) {
      return res.status(404).json({
        success: false,
        message: 'La ruta seleccionada no existe.'
      });
    }

    // Usamos una TRANSACCIÓN de Firestore para evitar condiciones de carrera (sobrecupo)
    await db.runTransaction(async (t) => {
      const empleadoQuery = db.collection('usuarios')
        .where('id_empleado', '==', idEmpleado)
        .where('rol', '==', ROLES.EMPLEADO)
        .limit(1);

      const empleadoSnapshot = await leerQuery(empleadoQuery, t);
      if (empleadoSnapshot.empty) {
        throw new Error('El empleado seleccionado no existe.');
      }

      const empleadoDoc = empleadoSnapshot.docs[0];
      const empleadoData = empleadoDoc.data() || {};

      if (empleadoData.activo === false) {
        throw new Error('El empleado seleccionado está inactivo.');
      }

      if (req.usuario.rol === ROLES.JEFE && empleadoData.jefe_uid !== req.usuario.uid) {
        throw new Error('FORBIDDEN_EMPLOYEE: No puedes asignar empleados que no están bajo tu responsabilidad.');
      }

      const programacion = await resolverProgramacion(fechaAsignacion, rutaEncontrada.id, turnoAsignacion, t);
      let data = programacion.data;
      let programacionRef = programacion.docRef;

      if (!data) {
        data = construirProgramacionBase({
          fecha: fechaAsignacion,
          idRuta: rutaEncontrada.id,
          turno: turnoAsignacion,
          rutaData: rutaEncontrada.data,
          uidCreador: req.usuario.uid
        });
        t.set(programacionRef, data, { merge: true });
      }

      const pasajerosActuales = Array.isArray(data.pasajeros_ids) ? data.pasajeros_ids : [];
      const asientosReservados = normalizarAsientosReservados(data.asientos_reservados);
      const asientosPorEmpleado = normalizarAsientosPorEmpleado(data.asientos_por_empleado);

      const asientosOcupadosDato = Number(data.asientos_ocupados);
      const asientosOcupados = Number.isFinite(asientosOcupadosDato)
        ? asientosOcupadosDato
        : Math.max(pasajerosActuales.length, asientosReservados.length);
      const capacidadMaxima = Number(data.capacidad_limite) || Number(rutaEncontrada.data.capacidad_real) || 12;

      // Regla de Negocio: Bloqueo Dinámico
      if (asientosOcupados >= capacidadMaxima) {
        throw new Error("CAP_CHECK_FAILED: La unidad ya está a su máxima capacidad.");
      }

      if (asientoAsignado > capacidadMaxima) {
        throw new Error('SEAT_OUT_OF_RANGE: El asiento seleccionado excede la capacidad de la unidad.');
      }

      if (asientosReservados.includes(asientoAsignado)) {
        throw new Error('SEAT_OCCUPIED: El asiento seleccionado ya está ocupado.');
      }

      if (pasajerosActuales.includes(idEmpleado)) {
        throw new Error('DUPLICATE_ASSIGNMENT: El empleado ya está asignado a esta ruta.');
      }

      const nuevosPasajeros = [...pasajerosActuales, idEmpleado];
      const nuevosAsientosReservados = [...asientosReservados, asientoAsignado].sort((a, b) => a - b);

      t.set(programacionRef, {
        fecha: fechaAsignacion,
        turno: turnoAsignacion || data.turno || null,
        id_ruta: rutaEncontrada.id,
        asientos_ocupados: asientosOcupados + 1,
        pasajeros_ids: nuevosPasajeros,
        asientos_reservados: nuevosAsientosReservados,
        asientos_por_empleado: {
          ...asientosPorEmpleado,
          [idEmpleado]: asientoAsignado
        },
        actualizado_en: new Date(),
        actualizado_por: req.usuario.uid
      }, { merge: true });
    });

    res.status(200).json({
      success: true,
      message: "Empleado asignado exitosamente.",
      data: {
        id_empleado: idEmpleado,
        id_ruta: rutaEncontrada.id,
        fecha: fechaAsignacion,
        turno: turnoAsignacion || null,
        asiento: asientoAsignado
      }
    });

  } catch (error) {
    const mensaje = String(error.message || 'Error en la asignación.');
    const status = mensaje.startsWith('CAP_CHECK_FAILED')
      || mensaje.startsWith('DUPLICATE_ASSIGNMENT')
      || mensaje.startsWith('SEAT_OCCUPIED')
      || mensaje.startsWith('SEAT_OUT_OF_RANGE')
      ? 409
      : mensaje.startsWith('FORBIDDEN_EMPLOYEE')
        ? 403
        : mensaje.includes('no existe')
          ? 404
          : 400;

    res.status(status).json({ success: false, message: mensaje });
  }
});

app.post('/api/asignar/cancelar', autorizar('asignacion:cancelar'), async (req, res) => {
  const { id_empleado, id_ruta, fecha, turno, asiento } = req.body;

  const idEmpleado = textoNormalizado(id_empleado);
  const idRutaSolicitada = textoNormalizado(id_ruta);
  const fechaAsignacion = textoNormalizado(fecha);
  const turnoAsignacion = turnoNormalizado(turno);
  const asientoSolicitado = Number(asiento);

  if (!idEmpleado || !idRutaSolicitada || !fechaAsignacion) {
    return res.status(400).json({
      success: false,
      message: 'id_empleado, id_ruta y fecha son requeridos.'
    });
  }

  try {
    const rutaEncontrada = await resolverRutaPorIdentificador(idRutaSolicitada);
    if (!rutaEncontrada) {
      return res.status(404).json({
        success: false,
        message: 'La ruta seleccionada no existe.'
      });
    }

    let asientoEliminado = null;

    await db.runTransaction(async (t) => {
      const empleadoQuery = db.collection('usuarios')
        .where('id_empleado', '==', idEmpleado)
        .where('rol', '==', ROLES.EMPLEADO)
        .limit(1);

      const empleadoSnapshot = await leerQuery(empleadoQuery, t);
      if (empleadoSnapshot.empty) {
        throw new Error('El empleado seleccionado no existe.');
      }

      const empleadoDoc = empleadoSnapshot.docs[0];
      const empleadoData = empleadoDoc.data() || {};

      if (req.usuario.rol === ROLES.JEFE && empleadoData.jefe_uid !== req.usuario.uid) {
        throw new Error('FORBIDDEN_EMPLOYEE: No puedes desasignar empleados que no están bajo tu responsabilidad.');
      }

      const programacion = await resolverProgramacion(fechaAsignacion, rutaEncontrada.id, turnoAsignacion, t);
      if (!programacion.data) {
        throw new Error('ASSIGNMENT_NOT_FOUND: No hay programación registrada para esa ruta y fecha.');
      }

      const data = programacion.data;
      const pasajerosActuales = Array.isArray(data.pasajeros_ids) ? data.pasajeros_ids : [];
      const asientosReservados = normalizarAsientosReservados(data.asientos_reservados);
      const asientosPorEmpleado = normalizarAsientosPorEmpleado(data.asientos_por_empleado);

      if (!pasajerosActuales.includes(idEmpleado) && !asientosPorEmpleado[idEmpleado]) {
        throw new Error('ASSIGNMENT_NOT_FOUND: El empleado no tiene asignación activa en esta ruta.');
      }

      const asientoDesdeMapa = Number(asientosPorEmpleado[idEmpleado]);
      const asientoFinal = Number.isInteger(asientoDesdeMapa)
        ? asientoDesdeMapa
        : (Number.isInteger(asientoSolicitado) && asientoSolicitado > 0 ? asientoSolicitado : null);

      const nuevosPasajeros = pasajerosActuales.filter((idActual) => idActual !== idEmpleado);
      const nuevosAsientosReservados = asientoFinal
        ? asientosReservados.filter((asientoActual) => asientoActual !== asientoFinal)
        : asientosReservados;

      const nuevosAsientosPorEmpleado = { ...asientosPorEmpleado };
      delete nuevosAsientosPorEmpleado[idEmpleado];

      const nuevosAsientosOcupados = Math.max(nuevosPasajeros.length, nuevosAsientosReservados.length);

      t.set(programacion.docRef, {
        pasajeros_ids: nuevosPasajeros,
        asientos_reservados: nuevosAsientosReservados,
        asientos_por_empleado: nuevosAsientosPorEmpleado,
        asientos_ocupados: nuevosAsientosOcupados,
        actualizado_en: new Date(),
        actualizado_por: req.usuario.uid
      }, { merge: true });

      asientoEliminado = asientoFinal;
    });

    res.status(200).json({
      success: true,
      message: 'Asignación eliminada correctamente.',
      data: {
        id_empleado: idEmpleado,
        id_ruta: rutaEncontrada.id,
        fecha: fechaAsignacion,
        turno: turnoAsignacion || null,
        asiento: asientoEliminado
      }
    });
  } catch (error) {
    const mensaje = String(error.message || 'Error al eliminar asignación.');
    const status = mensaje.startsWith('ASSIGNMENT_NOT_FOUND')
      ? 404
      : mensaje.startsWith('FORBIDDEN_EMPLOYEE')
        ? 403
        : mensaje.includes('no existe')
          ? 404
          : 400;

    res.status(status).json({ success: false, message: mensaje });
  }
});

// ==========================================
// ENDPOINT 3: Sincronizar datos desde Python
// Solo Admin puede sincronizar datos
// ==========================================
app.post('/api/rutas/sync', autorizar('rutas:sync'), async (req, res) => {
  const rutasData = req.body; // Esperamos recibir un arreglo de rutas desde Python

  if (!Array.isArray(rutasData)) {
    return res.status(400).json({
      success: false,
      message: 'El payload debe ser un arreglo de rutas.'
    });
  }
  
  try {
    const batch = db.batch(); // Usamos batch para escribir todo de una sola vez
    
    rutasData.forEach(ruta => {
      // Usamos el número de ruta para crear un ID único (ej. "Ruta_1")
      const docId = `Ruta_${ruta.ruta.toString().trim()}`;
      const docRef = db.collection('rutas').doc(docId);
      
      // .set() con { merge: true } actualiza si ya existe, o lo crea si es nuevo
      batch.set(docRef, ruta, { merge: true }); 
    });

    await batch.commit();
    console.log(`📥 Sincronización exitosa: ${rutasData.length} rutas actualizadas.`);
    res.status(200).json({ success: true, message: "Datos sincronizados con Firebase" });
    
  } catch (error) {
    console.error("Error sincronizando rutas:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ENDPOINT 4: Chat Operativo (Copiloto)
// Solo Admin y Jefe pueden usar el copiloto
// ==========================================
app.post('/api/chat', autorizar('chat:enviar'), async (req, res) => {
  const { mensaje_usuario } = req.body || {};
  let rutas = [];

  if (!mensaje_usuario || !String(mensaje_usuario).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Debes enviar un mensaje en el campo mensaje_usuario.'
    });
  }

  try {
    const snapshot = await db.collection('rutas').get();
    snapshot.forEach((doc) => rutas.push(doc.data()));

    if (!openai) {
      return res.status(200).json({
        success: true,
        respuesta: generarRespuestaFallback(mensaje_usuario, rutas)
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Eres un copiloto logístico de ILPEA. Responde en español con recomendaciones breves, accionables y orientadas a operación de rutas.'
        },
        {
          role: 'user',
          content: `Consulta del jefe: ${mensaje_usuario}\n\nDatos de rutas actuales: ${JSON.stringify(rutas)}`
        }
      ],
      temperature: 0.2
    });

    const respuestaIA = completion.choices?.[0]?.message?.content?.trim();

    if (!respuestaIA) {
      return res.status(200).json({
        success: true,
        respuesta: generarRespuestaFallback(mensaje_usuario, rutas)
      });
    }

    res.status(200).json({ success: true, respuesta: respuestaIA });
  } catch (error) {
    console.error('Error en /api/chat:', error);

    if (esTimeoutOpenAI(error)) {
      return res.status(200).json({
        success: true,
        respuesta: generarRespuestaFallback(mensaje_usuario, rutas)
      });
    }

    res.status(500).json({
      success: false,
      message: 'No fue posible generar respuesta del copiloto.'
    });
  }
});

// ==========================================
// ENDPOINT 5: Insights Automáticos (Proactivo)
// Solo Admin y Jefe pueden ver insights
// ==========================================
app.get('/api/insights-automaticos', autorizar('insights:ver'), async (req, res) => {
  if (!openai) {
    return res.status(503).json({
      success: false,
      message: 'OpenAI no está configurado. Define OPENAI_API_KEY en backend/.env y reinicia el servidor.',
      insights: []
    });
  }

  let rutas = [];

  try {
    // 1. Extraemos TODAS las rutas de Firebase
    const snapshot = await db.collection('rutas').get();
    snapshot.forEach(doc => rutas.push(doc.data()));

    // 2. El Prompt Maestro
    const systemPrompt = `
      Actúa como un Analista Senior de Logística e IA para ILPEA. Genera "Insights de Acción" inmediatos basados en los datos de rutas que recibas.
      
      REGLAS:
      1. Prioridad ALTA: Rutas con ocupación < 40%.
      2. Prioridad MEDIA: Autobuses con <= 12 pasajeros (Sugerir Van).
      
      SALIDA ESTRICTA: Devuelve ÚNICAMENTE un objeto JSON con una propiedad "insights" que contenga un arreglo de objetos con "titulo", "descripcion", "prioridad" (alta/media/baja), y "ruta_id". No incluyas texto extra.
    `;

    // 3. Consulta a OpenAI enviando el prompt y los datos de Firebase
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', 
      response_format: { type: "json_object" }, 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analiza estos datos y genera el JSON: ${JSON.stringify(rutas)}` }
      ],
      temperature: 0.2
    });

    // 4. Se lo enviamos procesado al Frontend
    const rawContent = completion.choices?.[0]?.message?.content;
    const dataIA = rawContent ? JSON.parse(rawContent) : null;
    const insights = Array.isArray(dataIA?.insights) ? dataIA.insights : [];

    if (!insights.length) {
      return res.status(502).json({
        success: false,
        message: 'La IA respondió sin insights válidos. Intenta de nuevo.',
        insights: []
      });
    }

    res.json({ success: true, insights });

  } catch (error) {
    if (esTimeoutOpenAI(error)) {
      console.warn('OpenAI tardó demasiado; usando insights locales.');
      return res.status(200).json({
        success: true,
        insights: generarInsightsLocales(rutas),
        source: 'fallback'
      });
    }

    console.error("Error generando insights:", error);
    return res.status(200).json({
      success: true,
      insights: generarInsightsLocales(rutas),
      source: 'fallback'
    });
  }
});

// ==========================================
// ENDPOINT 6: Obtener info del usuario autenticado
// ==========================================
app.get('/api/auth/me', (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  res.json({
    success: true,
    usuario: {
      uid: req.usuario.uid,
      email: req.usuario.email,
      nombre: req.usuario.nombre,
      rol: req.usuario.rol,
      permisos: obtenerPermisosDelRol(req.usuario.rol)
    }
  });
});

// ==========================================
// ENDPOINT 7: Crear usuario (Solo Admin)
// ==========================================
app.post('/api/usuarios/crear', autorizar('usuarios:crear'), async (req, res) => {
  const { email, nombre, rol = ROLES.EMPLEADO, password } = req.body;

  if (!email || !nombre || !rol || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email, nombre, rol y password son requeridos.'
    });
  }

  // Validar que el rol sea válido
  if (!Object.values(ROLES).includes(rol)) {
    return res.status(400).json({
      success: false,
      message: `Rol inválido. Roles permitidos: ${Object.values(ROLES).join(', ')}`
    });
  }

  try {
    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre
    });

    // Guardar datos adicionales en Firestore
    await db.collection('usuarios').doc(userRecord.uid).set({
      email,
      nombre,
      rol,
      creado_por: req.usuario.uid,
      creado_en: new Date(),
      activo: true
    });

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente.',
      usuario: {
        uid: userRecord.uid,
        email,
        nombre,
        rol
      }
    });
  } catch (error) {
    console.error('Error creando usuario:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// ENDPOINT 8: Listar usuarios (Solo Admin)
// ==========================================
app.get('/api/usuarios', autorizar('usuarios:ver'), async (req, res) => {
  try {
    const usuariosSnapshot = await db.collection('usuarios').get();
    const usuarios = [];

    usuariosSnapshot.forEach(doc => {
      const data = doc.data();
      usuarios.push({
        uid: doc.id,
        email: data.email,
        nombre: data.nombre,
        rol: data.rol,
        activo: data.activo,
        creado_en: data.creado_en
      });
    });

    res.json({
      success: true,
      cantidad: usuarios.length,
      data: usuarios
    });
  } catch (error) {
    console.error('Error listando usuarios:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo usuarios'
    });
  }
});

// ==========================================
// ENDPOINT 8B: CRUD de empleados (Admin y Jefe)
// ==========================================
app.get('/api/empleados', autorizar('empleados:ver'), async (req, res) => {
  try {
    const empleadosSnapshot = req.usuario.rol === ROLES.JEFE
      ? await db.collection('usuarios').where('jefe_uid', '==', req.usuario.uid).get()
      : await db.collection('usuarios').where('rol', '==', ROLES.EMPLEADO).get();

    const empleados = [];
    const idsReservados = new Set();

    for (const doc of empleadosSnapshot.docs) {
      const empleado = normalizarEmpleado(doc);
      if (empleado.rol === ROLES.EMPLEADO) {
        if (!String(empleado.id_empleado || '').trim()) {
          try {
            empleado.id_empleado = await asegurarIdEmpleadoPersistido(doc, idsReservados);
          } catch (error) {
            console.warn('No se pudo persistir id_empleado faltante para', doc.id, error.message);
            empleado.id_empleado = construirIdEmpleadoDesdeUid(doc.id);
          }
        } else {
          idsReservados.add(String(empleado.id_empleado).trim());
        }

        empleados.push(empleado);
      }
    }

    res.json({
      success: true,
      cantidad: empleados.length,
      data: empleados
    });
  } catch (error) {
    console.error('Error listando empleados:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo empleados'
    });
  }
});

app.post('/api/empleados', autorizar('empleados:crear'), async (req, res) => {
  const { id_empleado, email, nombre, password, jefe_uid } = req.body;

  if (!email || !nombre) {
    return res.status(400).json({
      success: false,
      message: 'Email y nombre son requeridos.'
    });
  }

  if (!esEmailValido(email)) {
    return res.status(400).json({
      success: false,
      message: 'El email no tiene un formato válido.'
    });
  }

  let jefeResponsable = req.usuario.rol === ROLES.JEFE ? req.usuario.uid : jefe_uid;

  if (!jefeResponsable) {
    return res.status(400).json({
      success: false,
      message: 'Debes asignar un jefe responsable para este empleado.'
    });
  }

  let userRecord;
  try {
    const idEmpleadoManual = String(id_empleado || '').trim();
    const passwordManual = String(password || '').trim();
    const idEmpleadoFinal = idEmpleadoManual || await generarIdEmpleadoUnico();
    const passwordFinal = passwordManual || generarPasswordTemporal();

    const jefeDoc = await db.collection('usuarios').doc(jefeResponsable).get();
    if (!jefeDoc.exists || jefeDoc.data().rol !== ROLES.JEFE) {
      return res.status(400).json({
        success: false,
        message: 'El jefe asignado no existe o no tiene rol JEFE.'
      });
    }

    userRecord = await admin.auth().createUser({
      email: String(email).trim(),
      password: passwordFinal,
      displayName: String(nombre).trim()
    });

    await db.collection('usuarios').doc(userRecord.uid).set({
      id_empleado: idEmpleadoFinal,
      email: String(email).trim(),
      nombre: String(nombre).trim(),
      rol: ROLES.EMPLEADO,
      jefe_uid: jefeResponsable,
      creado_por: req.usuario.uid,
      creado_en: new Date(),
      actualizado_en: null,
      activo: true
    });

    res.status(201).json({
      success: true,
      message: 'Empleado creado exitosamente.',
      credenciales_generadas: {
        id_empleado: idEmpleadoFinal,
        password_temporal: passwordManual ? null : passwordFinal
      },
      usuario: {
        uid: userRecord.uid,
        id_empleado: idEmpleadoFinal,
        email: String(email).trim(),
        nombre: String(nombre).trim(),
        rol: ROLES.EMPLEADO,
        jefe_uid: jefeResponsable
      }
    });
  } catch (error) {
    console.error('Error creando empleado:', error.message);
    
    // Rollback si se creó en Auth pero falló en Firestore
    if (userRecord && userRecord.uid) {
      await admin.auth().deleteUser(userRecord.uid).catch(err => 
        console.error('Error al hacer rollback de Auth:', err.message)
      );
    }

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un usuario con ese email.'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.put('/api/empleados/:uid', autorizar('empleados:actualizar'), async (req, res) => {
  const { uid } = req.params;
  const { id_empleado, email, nombre, password, activo, jefe_uid } = req.body;

  try {
    const ref = db.collection('usuarios').doc(uid);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado.'
      });
    }

    const data = snapshot.data();
    if (data.rol !== ROLES.EMPLEADO) {
      return res.status(403).json({
        success: false,
        message: 'Solo se pueden editar usuarios con rol EMPLEADO.'
      });
    }

    if (!puedeGestionarEmpleado(req.usuario, data)) {
      return res.status(403).json({
        success: false,
        message: 'No puedes modificar empleados que no te pertenecen.'
      });
    }

    const updatesFirestore = {
      actualizado_por: req.usuario.uid,
      actualizado_en: new Date()
    };

    if (id_empleado) updatesFirestore.id_empleado = String(id_empleado).trim();

    const updatesAuth = {};

    if (email !== undefined) {
      if (!esEmailValido(email)) {
        return res.status(400).json({
          success: false,
          message: 'El email no tiene un formato válido.'
        });
      }

      updatesFirestore.email = String(email).trim();
      updatesAuth.email = String(email).trim();
    }

    if (nombre !== undefined) {
      updatesFirestore.nombre = String(nombre).trim();
      updatesAuth.displayName = String(nombre).trim();
    }

    if (activo !== undefined) {
      updatesFirestore.activo = Boolean(activo);
    }

    if (req.usuario.rol === ROLES.ADMIN && jefe_uid !== undefined) {
      const jefeDoc = await db.collection('usuarios').doc(jefe_uid).get();
      if (!jefeDoc.exists || jefeDoc.data().rol !== ROLES.JEFE) {
        return res.status(400).json({
          success: false,
          message: 'El jefe asignado no existe o no tiene rol JEFE.'
        });
      }

      updatesFirestore.jefe_uid = jefe_uid;
    }

    if (req.usuario.rol === ROLES.JEFE) {
      updatesFirestore.jefe_uid = req.usuario.uid;
    }

    if (password) {
      updatesAuth.password = password;
    }

    await ref.update(updatesFirestore);

    if (Object.keys(updatesAuth).length > 0) {
      await admin.auth().updateUser(uid, updatesAuth);
    }

    const updated = await ref.get();

    res.json({
      success: true,
      message: 'Empleado actualizado exitosamente.',
      usuario: normalizarEmpleado(updated)
    });
  } catch (error) {
    console.error('Error actualizando empleado:', error.message);

    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado en Firebase Auth.'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.delete('/api/empleados/:uid', autorizar('empleados:eliminar'), async (req, res) => {
  const { uid } = req.params;

  try {
    const ref = db.collection('usuarios').doc(uid);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado.'
      });
    }

    const data = snapshot.data();
    if (data.rol !== ROLES.EMPLEADO) {
      return res.status(403).json({
        success: false,
        message: 'Solo se pueden eliminar usuarios con rol EMPLEADO.'
      });
    }

    if (!puedeGestionarEmpleado(req.usuario, data)) {
      return res.status(403).json({
        success: false,
        message: 'No puedes eliminar empleados que no te pertenecen.'
      });
    }

    await ref.update({
      activo: false,
      eliminado_por: req.usuario.uid,
      eliminado_en: new Date()
    });

    await admin.auth().deleteUser(uid);

    res.json({
      success: true,
      message: 'Empleado eliminado exitosamente.'
    });
  } catch (error) {
    console.error('Error eliminando empleado:', error.message);

    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado en Firebase Auth.'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// ENDPOINT 8C: CRUD de Jefes (Solo Admin)
// ==========================================
app.get('/api/jefes', autorizar('jefes:ver'), async (req, res) => {
  try {
    const jefesSnapshot = await db.collection('usuarios').where('rol', '==', ROLES.JEFE).get();
    const jefes = [];

    jefesSnapshot.forEach((doc) => {
      jefes.push(normalizarJefe(doc));
    });

    res.json({
      success: true,
      cantidad: jefes.length,
      data: jefes
    });
  } catch (error) {
    console.error('Error listando jefes:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo jefes'
    });
  }
});

app.post('/api/jefes', autorizar('jefes:crear'), async (req, res) => {
  const { email, nombre, password } = req.body;

  if (!email || !nombre || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email, nombre y password son requeridos.'
    });
  }

  if (!esEmailValido(email)) {
    return res.status(400).json({
      success: false,
      message: 'El email no tiene un formato válido.'
    });
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: String(email).trim(),
      password,
      displayName: String(nombre).trim()
    });

    await db.collection('usuarios').doc(userRecord.uid).set({
      email: String(email).trim(),
      nombre: String(nombre).trim(),
      rol: ROLES.JEFE,
      creado_por: req.usuario.uid,
      creado_en: new Date(),
      actualizado_en: null,
      activo: true
    });

    res.status(201).json({
      success: true,
      message: 'Jefe creado exitosamente.',
      usuario: {
        uid: userRecord.uid,
        email: String(email).trim(),
        nombre: String(nombre).trim(),
        rol: ROLES.JEFE
      }
    });
  } catch (error) {
    console.error('Error creando jefe:', error.message);
    
    // Rollback si se creó en Auth pero falló en Firestore
    if (userRecord && userRecord.uid) {
      await admin.auth().deleteUser(userRecord.uid).catch(err => 
        console.error('Error al hacer rollback de Auth:', err.message)
      );
    }

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un usuario con ese email.'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.put('/api/jefes/:uid', autorizar('jefes:actualizar'), async (req, res) => {
  const { uid } = req.params;
  const { email, nombre, password, activo } = req.body;

  try {
    const ref = db.collection('usuarios').doc(uid);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: 'Jefe no encontrado.'
      });
    }

    const data = snapshot.data();
    if (data.rol !== ROLES.JEFE) {
      return res.status(403).json({
        success: false,
        message: 'Solo se pueden editar usuarios con rol JEFE.'
      });
    }

    const updatesFirestore = {
      actualizado_por: req.usuario.uid,
      actualizado_en: new Date()
    };

    const updatesAuth = {};

    if (email !== undefined) {
      if (!esEmailValido(email)) {
        return res.status(400).json({
          success: false,
          message: 'El email no tiene un formato válido.'
        });
      }

      updatesFirestore.email = String(email).trim();
      updatesAuth.email = String(email).trim();
    }

    if (nombre !== undefined) {
      updatesFirestore.nombre = String(nombre).trim();
      updatesAuth.displayName = String(nombre).trim();
    }

    if (activo !== undefined) {
      updatesFirestore.activo = Boolean(activo);
    }

    if (password) {
      updatesAuth.password = password;
    }

    await ref.update(updatesFirestore);

    if (Object.keys(updatesAuth).length > 0) {
      await admin.auth().updateUser(uid, updatesAuth);
    }

    const updated = await ref.get();

    res.json({
      success: true,
      message: 'Jefe actualizado exitosamente.',
      usuario: normalizarJefe(updated)
    });
  } catch (error) {
    console.error('Error actualizando jefe:', error.message);

    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado en Firebase Auth.'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.delete('/api/jefes/:uid', autorizar('jefes:eliminar'), async (req, res) => {
  const { uid } = req.params;

  try {
    const ref = db.collection('usuarios').doc(uid);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        message: 'Jefe no encontrado.'
      });
    }

    const data = snapshot.data();
    if (data.rol !== ROLES.JEFE) {
      return res.status(403).json({
        success: false,
        message: 'Solo se pueden eliminar usuarios con rol JEFE.'
      });
    }

    // Soft delete
    await ref.update({
      activo: false,
      eliminado_por: req.usuario.uid,
      eliminado_en: new Date()
    });

    // Eliminar de Firebase Auth
    await admin.auth().deleteUser(uid);

    res.json({
      success: true,
      message: 'Jefe eliminado exitosamente.'
    });
  } catch (error) {
    console.error('Error eliminando jefe:', error.message);

    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado en Firebase Auth.'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// ENDPOINT 9: Actualizar rol de usuario (Solo Admin)
// ==========================================
app.put('/api/usuarios/:uid/rol', autorizar('usuarios:actualizar'), async (req, res) => {
  const { uid } = req.params;
  const { rol } = req.body;

  if (!rol || !Object.values(ROLES).includes(rol)) {
    return res.status(400).json({
      success: false,
      message: `Rol inválido. Roles permitidos: ${Object.values(ROLES).join(', ')}`
    });
  }

  try {
    await db.collection('usuarios').doc(uid).update({
      rol,
      actualizado_por: req.usuario.uid,
      actualizado_en: new Date()
    });

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente.'
    });
  } catch (error) {
    console.error('Error actualizando rol:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// ENDPOINT 10: Eliminar usuario (Solo Admin)
// ==========================================
app.delete('/api/usuarios/:uid', autorizar('usuarios:eliminar'), async (req, res) => {
  const { uid } = req.params;

  try {
    // Marcar como inactivo en Firestore
    await db.collection('usuarios').doc(uid).update({
      activo: false,
      eliminado_por: req.usuario.uid,
      eliminado_en: new Date()
    });

    // Opcionalmente, también eliminarlo de Firebase Auth
    await admin.auth().deleteUser(uid);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente.'
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error.message);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==========================================
// ENDPOINT 11: Login simulado (Para desarrollo)
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const modoAuth = (process.env.AUTH_MODE || 'firebase').toLowerCase();
  if (modoAuth !== 'simulated') {
    return res.status(403).json({
      success: false,
      message: 'Login simulado deshabilitado. Usa Firebase Auth en modo real.'
    });
  }

  const { email, rol = ROLES.EMPLEADO } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email requerido'
    });
  }

  // En producción, usar Firebase Auth correctamente
  res.json({
    success: true,
    message: 'Login simulado exitoso',
    usuario: {
      email,
      rol,
      nombre: rol === ROLES.ADMIN ? 'Admin' : 
             rol === ROLES.JEFE ? 'Jefe' : 
             'Empleado'
    },
    // En desarrollo simulado, devolver token falso
    token: 'simulado-token-' + Date.now()
  });
});

// Inicializar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ILPEA corriendo en http://localhost:${PORT}`);
  console.log(`Conectado a Firebase Project: ${serviceAccount.project_id}`);
});