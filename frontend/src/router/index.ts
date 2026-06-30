import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
    { 
      path: '/admin', 
      name: 'Admin', 
      component: () => import('../views/AdminDashboard.vue'),
      meta: { requiresAuth: true, role: 'ADMIN' }
    },

    // --- RUTA PARA GESTIÓN DE RUTAS ---
    {
      path: '/admin/rutas',
      name: 'GestionRutas',
      component: () => import('../views/GestionRutas.vue'),
      meta: { requiresAuth: true, role: 'ADMIN' }
    },
    {
      path: '/admin/rutas/eliminacion',
      redirect: { path: '/admin/rutas', query: { tab: 'administracion' } },
    },

    // --- Gestión de usuarios (jefes y empleados por separado) ---
    {
      path: '/admin/usuarios',
      redirect: '/admin/usuarios/jefes',
    },
    {
      path: '/admin/usuarios/jefes',
      name: 'AdminJefes',
      component: () => import('../views/AdminJefes.vue'),
      meta: { requiresAuth: true, role: 'ADMIN' }
    },
    {
      path: '/admin/usuarios/empleados',
      name: 'AdminEmpleados',
      component: () => import('../views/AdminEmpleados.vue'),
      meta: { requiresAuth: true, role: 'ADMIN' }
    },

    {
      path: '/admin/asignaciones',
      name: 'AdminAsignaciones',
      component: () => import('../views/PanelJefe.vue'),
      meta: { requiresAuth: true, role: 'ADMIN' }
    },

    { 
      path: '/jefe', 
      name: 'Jefe', 
      component: () => import('../views/PanelJefe.vue'),
      meta: { requiresAuth: true, role: 'JEFE' }
    },
    {
      path: '/empleado',
      name: 'Empleado',
      component: () => import('../views/EmpleadoDashboard.vue'),
      meta: { requiresAuth: true, role: 'EMPLEADO' }
    }
  ]
})

// GUARDIÁN DE NAVEGACIÓN (Se mantiene igual, está perfecto)
router.beforeEach(async (to, _from, next) => {
  const { restaurarSesion, obtenerRol } = useAuth()
  const autenticado = await restaurarSesion()
  const userRole = obtenerRol()

  if (to.meta.requiresAuth && !autenticado) {
    next('/login')
  } else if (to.meta.role && to.meta.role !== userRole) {
    if (userRole === 'ADMIN') next('/admin')
    else if (userRole === 'JEFE') next('/jefe')
    else if (userRole === 'EMPLEADO') next('/empleado')
    else next('/login')
  } else {
    next()
  }
})

export default router