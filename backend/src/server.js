// backend/src/server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 1. Inicializar Firebase Admin usando nuestra llave local
const serviceAccount = require('../config/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

function crearClienteOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const OpenAI = require('openai');
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (error) {
    console.warn('OpenAI deshabilitado: paquete no instalado o error de carga.');
    return null;
  }
}

const openai = crearClienteOpenAI();

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

// Middlewares
app.use(cors());
app.use(express.json()); // Permite recibir datos en formato JSON

// ==========================================
// ENDPOINT 1: Obtener todas las rutas
// (Consumido por el Dashboard del Administrador)
// ==========================================
app.get('/api/rutas', async (req, res) => {
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

// ==========================================
// ENDPOINT 2: El "Cap Check" (Asignación Atómica)
// ==========================================
app.post('/api/asignar', async (req, res) => {
  const { id_empleado, id_ruta, fecha } = req.body;
  
  // Referencia al documento de programación diaria específico
  const docRef = db.collection('programacion_diaria').doc(`${fecha}_${id_ruta}`);

  try {
    // Usamos una TRANSACCIÓN de Firestore para evitar condiciones de carrera (sobrecupo)
    await db.runTransaction(async (t) => {
      const doc = await t.get(docRef);
      
      if (!doc.exists) {
        throw new Error("La ruta no está programada para esta fecha.");
      }

      const data = doc.data();
      const asientosOcupados = data.asientos_ocupados || 0;
      const capacidadMaxima = data.capacidad_limite || 12; // Regla estricta por defecto: Van (12)

      // Regla de Negocio: Bloqueo Dinámico
      if (asientosOcupados >= capacidadMaxima) {
        throw new Error("CAP_CHECK_FAILED: La unidad ya está a su máxima capacidad.");
      }

      // Si hay espacio, registramos al empleado y sumamos 1 asiento
      const nuevosPasajeros = [...(data.pasajeros_ids || []), id_empleado];
      
      t.update(docRef, {
        asientos_ocupados: asientosOcupados + 1,
        pasajeros_ids: nuevosPasajeros
      });
    });

    res.status(200).json({ success: true, message: "Empleado asignado exitosamente." });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==========================================
// ENDPOINT 3: Sincronizar datos desde Python
// ==========================================
app.post('/api/rutas/sync', async (req, res) => {
  const rutasData = req.body; // Esperamos recibir un arreglo de rutas desde Python
  
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
// ==========================================
app.post('/api/chat', async (req, res) => {
  const { mensaje_usuario } = req.body || {};

  if (!mensaje_usuario || !String(mensaje_usuario).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Debes enviar un mensaje en el campo mensaje_usuario.'
    });
  }

  try {
    const snapshot = await db.collection('rutas').get();
    const rutas = [];
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
    res.status(500).json({
      success: false,
      message: 'No fue posible generar respuesta del copiloto.'
    });
  }
});

// ==========================================
// ENDPOINT 5: Insights Automáticos (Proactivo)
// ==========================================
app.get('/api/insights-automaticos', async (req, res) => {
  if (!openai) {
    return res.status(503).json({
      success: false,
      message: 'OpenAI no está configurado. Define OPENAI_API_KEY en backend/.env y reinicia el servidor.',
      insights: []
    });
  }

  try {
    // 1. Extraemos TODAS las rutas de Firebase
    const snapshot = await db.collection('rutas').get();
    const rutas = [];
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
    console.error("Error generando insights:", error);
    res.status(500).json({ success: false, message: "Error conectando con la IA" });
  }
});

// Inicializar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ILPEA corriendo en http://localhost:${PORT}`);
  console.log(`Conectado a Firebase Project: ${serviceAccount.project_id}`);
});