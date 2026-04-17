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

// Inicializar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ILPEA corriendo en http://localhost:${PORT}`);
  console.log(`Conectado a Firebase Project: ${serviceAccount.project_id}`);
});