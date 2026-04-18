import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminUsers from '../views/AdminUsers.vue'
import PanelJefe from '../views/PanelJefe.vue'
import EmpleadoDashboard from '../views/EmpleadoDashboard.vue'
import GestionRutas from '../views/GestionRutas.vue';
import { useAuth } from '../composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'Login', component: Login },
    { 
      path: '/admin', 
      name: 'Admin', 
      component: AdminDashboard,
      meta: { requiresAuth: true, role: 'ADMIN' }
    },

    // --- RUTA PARA GESTIÓN DE RUTAS ---
    {
      path: '/admin/rutas',
      name: 'GestionRutas',
      component: GestionRutas,
      meta: { requiresAuth: true, role: 'ADMIN' }
    },

    // --- NUEVA RUTA PARA GESTIÓN DE USUARIOS (SOLUCIÓN) ---
    {
      path: '/admin/usuarios',
      name: 'AdminUsers',
      component: AdminUsers,
      meta: { requiresAuth: true, role: 'ADMIN' }
    },

    {
      path: '/admin/asignaciones',
      name: 'AdminAsignaciones',
      component: PanelJefe,
      meta: { requiresAuth: true, role: 'ADMIN' }
    },

    { 
      path: '/jefe', 
      name: 'Jefe', 
      component: PanelJefe,
      meta: { requiresAuth: true, role: 'JEFE' }
    },
    {
      path: '/empleado',
      name: 'Empleado',
      component: EmpleadoDashboard,
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