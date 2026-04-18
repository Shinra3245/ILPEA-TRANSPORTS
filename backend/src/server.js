// backend/src/server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// 1. Inicializar Firebase Admin usando nuestra llave local
const serviceAccount = require('../config/firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

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

// Inicializar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ILPEA corriendo en http://localhost:${PORT}`);
  console.log(`Conectado a Firebase Project: ${serviceAccount.project_id}`);
});


// ==========================================
// ENDPOINT 5: Insights Automáticos (Proactivo)
// ==========================================
app.get('/api/insights-automaticos', async (req, res) => {
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
      model: "gpt-3.5-turbo-1106", 
      response_format: { type: "json_object" }, 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analiza estos datos y genera el JSON: ${JSON.stringify(rutas)}` }
      ],
      temperature: 0.2
    });

    // 4. Se lo enviamos procesado al Frontend
    const dataIA = JSON.parse(completion.choices[0].message.content);
    res.json({ success: true, insights: dataIA.insights });

  } catch (error) {
    console.error("Error generando insights:", error);
    res.status(500).json({ success: false, message: "Error conectando con la IA" });
  }
});