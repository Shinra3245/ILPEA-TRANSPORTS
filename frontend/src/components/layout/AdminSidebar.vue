<template>
  <aside class="sidebar">
    <div class="brand">ILPEA <span>ADMIN</span></div>
    <nav class="nav-menu">
      <button
        type="button"
        @click="router.push('/admin')"
        :class="['nav-item', { active: route.path === '/admin' }]"
      >
        Dashboard
      </button>
      <button
        type="button"
        @click="router.push('/admin/rutas')"
        :class="['nav-item', { active: route.path.startsWith('/admin/rutas') }]"
      >
        Gestión de rutas
      </button>
      <button
        type="button"
        @click="router.push('/admin/usuarios/jefes')"
        :class="['nav-item', { active: route.path === '/admin/usuarios/jefes' }]"
      >
        Jefes
      </button>
      <button
        type="button"
        @click="router.push('/admin/usuarios/empleados')"
        :class="['nav-item', { active: route.path === '/admin/usuarios/empleados' }]"
      >
        Empleados
      </button>
      <button
        type="button"
        @click="router.push('/admin/asignaciones')"
        :class="['nav-item', { active: route.path === '/admin/asignaciones' }]"
      >
        Asignaciones
      </button>
    </nav>
    <button type="button" @click="cerrarSesion" class="logout-btn">Cerrar Sesión</button>
  </aside>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';

const router = useRouter();
const route = useRoute();
const { logout } = useAuth();

async function cerrarSesion() {
  await logout();
  router.push('/login');
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  background: var(--ilpea-black);
  color: var(--ilpea-white);
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
}

.brand {
  font-weight: 800;
  font-size: 1.2rem;
  margin-bottom: 3rem;
}

.brand span {
  color: #666;
  font-weight: 400;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 2rem;
}

.nav-item {
  display: block;
  width: 100%;
  background: none;
  border: none;
  color: #888;
  text-align: left;
  padding: 0.8rem 0;
  cursor: pointer;
  transition: 0.2s;
  font-size: 0.9rem;
}

.nav-item.active,
.nav-item:hover {
  color: var(--ilpea-white);
}

.logout-btn {
  background: var(--ilpea-danger);
  color: var(--ilpea-white);
  padding: 0.8rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  transition: background 0.3s;
  width: 100%;
}

.logout-btn:hover {
  background: #b91c1c;
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    padding: 1.5rem;
    align-items: center;
  }

  .brand {
    margin-bottom: 1.5rem;
  }

  .nav-menu {
    width: 100%;
  }

  .nav-item {
    text-align: center;
  }
}
</style>
