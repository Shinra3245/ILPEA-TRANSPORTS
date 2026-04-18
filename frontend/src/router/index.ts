import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import PanelJefe from '../views/PanelJefe.vue'

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
    { 
      path: '/jefe', 
      name: 'Jefe', 
      component: PanelJefe,
      meta: { requiresAuth: true, role: 'JEFE' }
    }
  ]
})

// GUARDIÁN DE NAVEGACIÓN (Protección de Rutas)
router.beforeEach((to, from, next) => {
  // Para este MVP, leeremos el rol desde localStorage (simulando Firebase Auth)
  const userRole = localStorage.getItem('userRole')

  if (to.meta.requiresAuth && !userRole) {
    next('/login') // Si no está logueado, lo mandamos al login
  } else if (to.meta.role && to.meta.role !== userRole) {
    // Si intenta entrar a una vista que no es de su rol
    if (userRole === 'ADMIN') next('/admin')
    else if (userRole === 'JEFE') next('/jefe')
    else next('/login')
  } else {
    next() // Todo en orden, le permitimos pasar
  }
})

export default router