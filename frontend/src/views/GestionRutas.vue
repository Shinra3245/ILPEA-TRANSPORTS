<template>
  <div class="admin-layout">
    <AdminSidebar />

    <main class="main-content">
      <header class="content-header">
        <h2>Gestión de rutas</h2>
        <p class="subtitle">
          Seguimiento en vivo con Samsara, administración reversible de rutas y asignación operativa de unidades por fecha/turno.
        </p>
      </header>

      <div class="rutas-tabs">
        <button
          type="button"
          :class="['rutas-tab-btn', { active: pestañaActiva === 'seguimiento' }]"
          @click="cambiarPestaña('seguimiento')"
        >
          Seguimiento
        </button>
        <button
          type="button"
          :class="['rutas-tab-btn', { active: pestañaActiva === 'administracion' }]"
          @click="cambiarPestaña('administracion')"
        >
          Administración
        </button>
      </div>

      <RutasSamsaraPanel v-if="pestañaActiva === 'seguimiento'" />
      <EliminacionRutasPanel v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminSidebar from '../components/layout/AdminSidebar.vue';
import RutasSamsaraPanel from '../components/RutasSamsaraPanel.vue';
import EliminacionRutasPanel from '../components/EliminacionRutasPanel.vue';

type PestañaRutas = 'seguimiento' | 'administracion';

const route = useRoute();
const router = useRouter();
const pestañaActiva = ref<PestañaRutas>('seguimiento');

function resolverPestañaDesdeQuery(): PestañaRutas {
  return route.query.tab === 'administracion' ? 'administracion' : 'seguimiento';
}

function cambiarPestaña(pestaña: PestañaRutas) {
  pestañaActiva.value = pestaña;

  const query = pestaña === 'administracion' ? { tab: 'administracion' } : {};
  router.replace({ path: '/admin/rutas', query });
}

onMounted(() => {
  pestañaActiva.value = resolverPestañaDesdeQuery();
});

watch(
  () => route.query.tab,
  () => {
    pestañaActiva.value = resolverPestañaDesdeQuery();
  },
);
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
  margin-bottom: 1.5rem;
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
  max-width: 52rem;
  line-height: 1.5;
}

.rutas-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.rutas-tab-btn {
  border: 1px solid var(--ilpea-border);
  background: var(--ilpea-white);
  color: var(--ilpea-gray-500);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.rutas-tab-btn.active {
  background: var(--ilpea-black);
  border-color: var(--ilpea-black);
  color: var(--ilpea-white);
}

.rutas-tab-btn:hover:not(.active) {
  border-color: var(--ilpea-gray-500);
  color: var(--ilpea-gray-900);
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
