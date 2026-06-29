const express = require('express');
const { ROLES, obtenerPermisosDelRol } = require('../config/roles');

const router = express.Router();

router.get('/auth/me', (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  return res.json({
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

router.post('/auth/login', (req, res) => {
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

  return res.json({
    success: true,
    message: 'Login simulado exitoso',
    usuario: {
      email,
      rol,
      nombre: rol === ROLES.ADMIN ? 'Admin' :
        rol === ROLES.JEFE ? 'Jefe' : 'Empleado'
    },
    token: 'simulado-token-' + Date.now()
  });
});

module.exports = router;
