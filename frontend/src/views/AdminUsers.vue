<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="brand">ILPEA <span>ADMIN</span></div>
      <nav class="nav-menu">
        <button @click="irAlDashboard" class="nav-item">Dashboard</button>
        <button @click="irARutasApi" class="nav-item">Gestionar Rutas</button>
        <button class="nav-item active">Usuarios</button>
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

const irAlDashboard = () => {
  router.push('/admin');
};

const irARutasApi = () => {
  router.push('/admin/rutas');
};

const cerrarSesion = async () => {
  const { logout } = useAuth();
  await logout();
  router.push('/login');
};
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f8f9fa;
  width: 100%;
}

.sidebar {
  width: 240px;
  background: #000;
  color: #fff;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
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
  flex: 1;
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

.nav-item:hover {
  color: #fff;
}

.nav-item.active {
  color: #fff;
}

.logout-btn {
  background: none;
  border: 1px solid #333;
  color: #888;
  padding: 0.6rem;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.2s;
}

.logout-btn:hover {
  color: #fff;
  border-color: #555;
}

.main-content {
  flex: 1;
  padding: 3rem;
  overflow-y: auto;
}

.content-header {
  margin-bottom: 2rem;
}

.header-flex {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    padding: 1rem;
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }

  .brand {
    padding: 0;
    margin-bottom: 0;
  }

  .nav-menu {
    flex-direction: row;
    flex: 1;
    display: flex;
    gap: 0;
  }

  .nav-item {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }

  .logout-btn {
    margin: 0;
  }

  .main-content {
    padding: 1.5rem;
  }
}
</style>
