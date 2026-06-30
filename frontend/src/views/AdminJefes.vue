<template>
  <div class="admin-layout">
    <AdminSidebar />

    <main class="main-content">
      <header class="content-header">
        <h2>Gestión de Jefes</h2>
        <p class="subtitle">Alta, edición y baja de jefes de turno.</p>
      </header>

      <JefeCrudPanel />
    </main>
  </div>
</template>

<script setup lang="ts">
import AdminSidebar from '../components/layout/AdminSidebar.vue';
import JefeCrudPanel from '../components/JefeCrudPanel.vue';
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
  min-width: 0;
  padding: 3rem;
}

.content-header {
  margin-bottom: 2rem;
}

.content-header h2 {
  margin: 0 0 0.35rem 0;
  font-size: 1.5rem;
  color: #1a1a1a;
}

.subtitle {
  margin: 0;
  color: var(--ilpea-gray-500);
  font-size: 0.92rem;
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
