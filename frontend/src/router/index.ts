import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
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
    // --- NUEVA RUTA PARA GESTIÓN GPS ---
    {
      path: '/admin/rutas',
      name: 'GestionRutas',
      component: GestionRutas,
      meta: { requiresAuth: true, role: 'ADMIN' }
    },
    // -----------------------------------
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

// GUARDIÁN DE NAVEGACIÓN (Protección de Rutas)
router.beforeEach(async (to, _from, next) => {
  const { restaurarSesion, obtenerRol } = useAuth()
  const autenticado = await restaurarSesion()
  const userRole = obtenerRol()

  if (to.meta.requiresAuth && !autenticado) {
    next('/login') // Si no está logueado, lo mandamos al login
  } else if (to.meta.role && to.meta.role !== userRole) {
    // Si intenta entrar a una vista que no es de su rol
    if (userRole === 'ADMIN') next('/admin')
    else if (userRole === 'JEFE') next('/jefe')
    else if (userRole === 'EMPLEADO') next('/empleado')
    else next('/login')
  } else {
    next() // Todo en orden, le permitimos pasar
  }
})

export default router