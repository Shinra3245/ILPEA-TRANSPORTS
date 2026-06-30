const express = require('express');
const router = express.Router();
const { autenticar, autorizar } = require('../middleware/auth');
const {
  db,
  textoNormalizado,
  turnoNormalizado,
  fechaISOHoy,
  normalizarAsientosPorEmpleado,
  esRutaActiva
} = require('../lib/utils');

router.get('/usuarios-asignados', autenticar, autorizar('usuarios:ver'), async (req, res) => {
  try {
    const fecha = textoNormalizado(req.query.fecha) || fechaISOHoy();
    const turno = turnoNormalizado(req.query.turno);

    const [empleadosSnap, progSnap, rutasSnap] = await Promise.all([
      db.collection('usuarios').where('rol', '==', 'EMPLEADO').get(),
      db.collection('programacion_diaria').where('fecha', '==', fecha).get(),
      db.collection('rutas').get()
    ]);

    const rutasPorId = new Map();
    rutasSnap.forEach((doc) => {
      const data = doc.data() || {};
      if (!esRutaActiva(data)) {
        return;
      }

      rutasPorId.set(doc.id, {
        id: doc.id,
        ruta: data.ruta,
        zona: data.zona || null
      });
    });

    const asignacionesPorEmpleado = new Map();

    progSnap.forEach((doc) => {
      const data = doc.data() || {};
      if (turno && data.turno && turnoNormalizado(data.turno) !== turno) {
        return;
      }

      const idRuta = textoNormalizado(data.id_ruta);
      const rutaInfo = idRuta ? rutasPorId.get(idRuta) : null;
      const pasajerosIds = Array.isArray(data.pasajeros_ids) ? data.pasajeros_ids : [];
      const asientosPorEmpleado = normalizarAsientosPorEmpleado(data.asientos_por_empleado);

      pasajerosIds.forEach((idEmpleado) => {
        const idNormalizado = textoNormalizado(idEmpleado);
        if (!idNormalizado) {
          return;
        }

        asignacionesPorEmpleado.set(idNormalizado, {
          ruta_id: idRuta,
          ruta_numero: rutaInfo?.ruta ?? null,
          zona: rutaInfo?.zona ?? null,
          asiento: asientosPorEmpleado[idNormalizado] ?? null,
          turno: textoNormalizado(data.turno) || null
        });
      });
    });

    const data = empleadosSnap.docs.map((doc) => {
      const u = doc.data() || {};
      const idEmpleado = textoNormalizado(u.id_empleado) || doc.id;
      const asig = asignacionesPorEmpleado.get(idEmpleado);

      return {
        num_control: idEmpleado,
        nombre: u.nombre || null,
        puesto: u.puesto || null,
        dpto: u.dpto || null,
        turno: asig?.turno || u.turno || null,
        empresa: u.empresa || 'ILPEA',
        horario_entrada: u.horario_entrada || null,
        horario_salida: u.horario_salida || null,
        dias_trabajo: u.dias_trabajo || null,
        domicilio: u.domicilio || null,
        colonia: u.colonia || null,
        referencia: u.referencia || null,
        ruta_asignada: asig?.ruta_numero != null ? String(asig.ruta_numero) : null,
        parada_asignada: asig?.asiento != null ? `Asiento ${asig.asiento}` : null,
        zona_ruta: asig?.zona || null,
        fecha_asignacion: fecha,
        completo: Boolean(u.puesto && u.dpto && asig?.ruta_numero != null),
        estatus: u.activo === false ? 'INACTIVO' : 'ACTIVO'
      };
    });

    res.json({
      success: true,
      fecha,
      turno: turno || null,
      cantidad: data.length,
      data
    });
  } catch (error) {
    console.error('Error en usuarios-asignados:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

module.exports = router;
