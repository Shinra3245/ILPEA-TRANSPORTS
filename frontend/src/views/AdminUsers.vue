<template>
  <div class="admin-layout">
    <AdminSidebar />

    <main class="main-content">
      <header class="content-header">
        <div class="header-flex">
          <h2>Gestión de Usuarios</h2>
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
import AdminSidebar from '../components/layout/AdminSidebar.vue';
import JefeCrudPanel from '../components/JefeCrudPanel.vue';
import EmpleadoCrudPanel from '../components/EmpleadoCrudPanel.vue';
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f8f9fa;
  font-family: 'Inter', system-ui, sans-serif;
  color: #1a1a1a;
  width: 100%;
}

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

.crud-section {
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
  }

  .main-content {
    padding: 1.5rem 1rem;
  }
}
</style>
