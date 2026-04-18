<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="brand">ILPEA <span>ADMIN</span></div>
      <nav class="nav-menu">
        <button 
          @click="irAlDashboard" 
          :class="['nav-item', { active: $route.path === '/admin' }]">
          Dashboard
        </button>
        
        <button 
          @click="irARutasApi" 
          :class="['nav-item', { active: $route.path === '/admin/rutas' }]">
          Gestionar Rutas
        </button>
        
        <button 
          :class="['nav-item', { active: $route.path === '/admin/usuarios' }]">
          Usuarios
        </button>

        <button
          @click="irAAsignaciones"
          :class="['nav-item', { active: $route.path === '/admin/asignaciones' }]">
          Asignaciones
        </button>
      </nav>
      <button @click="cerrarSesion" class="logout-btn">Cerrar Sesión</button>
    </aside>

    <main class="main-content">
      <header class="content-header">
        <div class="header-flex">
          <div>
            <h2>Gestión de Usuarios</h2>
            <p>Administra jefes y empleados del sistema</p>
          </div>
        </div>
      </header>

      <section class="crud-section">
        <JefeCrudPanel />
      </section>

      <section class="crud-section">
        <EmpleadoCrudPanel />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import JefeCrudPanel from '../components/JefeCrudPanel.vue';
import EmpleadoCrudPanel from '../components/EmpleadoCrudPanel.vue';

const router = useRouter();
// Inicializamos useAuth fuera para evitar el error de inicialización
const { logout } = useAuth();

const irAlDashboard = () => {
  router.push('/admin');
};

const irARutasApi = () => {
  router.push('/admin/rutas');
};

const irAAsignaciones = () => {
  router.push('/admin/asignaciones');
};

const cerrarSesion = async () => {
  try {
    await logout();
    router.push('/login');
  } catch (error) {
    console.error("Error al salir:", error);
  }
};
</script>

<style scoped>
/* 1. LAYOUT BASE */
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f8f9fa;
  font-family: 'Inter', system-ui, sans-serif;
  color: #1a1a1a;
  width: 100%;
}

/* 2. SIDEBAR ESTILO DASHBOARD */
.sidebar {
  width: 240px;
  background: #000;
  color: #fff;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
}

.brand { font-weight: 800; font-size: 1.2rem; margin-bottom: 3rem; }
.brand span { color: #666; font-weight: 400; }

/* 3. MENÚ DE NAVEGACIÓN */
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

.nav-item:hover, .nav-item.active {
  color: #fff;
}

/* 4. EL NUEVO BOTÓN ROJO DE CERRAR SESIÓN */
.logout-btn {
  background: #ef4444; /* Rojo corporativo de alerta */
  color: #ffffff;
  padding: 0.8rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  transition: background 0.3s;
  width: 100%;
}

.logout-btn:hover {
  background: #dc2626;
}

/* 5. CONTENIDO PRINCIPAL */
.main-content {
  flex: 1;
  padding: 3rem;
}

.header-flex {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.content-header {
  margin-bottom: 2rem;
}

.content-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #1a1a1a;
}

.content-header p {
  color: #666;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.crud-section {
  margin-bottom: 2rem;
}

/* RESPONSIVO */
@media (max-width: 768px) {
  .admin-layout { flex-direction: column; }
  .sidebar {
    width: 100%;
    padding: 1.5rem;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }
  .brand { margin-bottom: 1.5rem; }
  .nav-menu { flex-direction: column; width: 100%; margin-bottom: 1.5rem; }
  .nav-item { text-align: center; }
  .logout-btn { width: 100%; padding: 0.8rem; }
  .main-content { padding: 1.5rem 1rem; }
  .header-flex { flex-direction: column; gap: 1rem; }
}
</style>