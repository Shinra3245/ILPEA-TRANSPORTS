<template>
  <div>
    <div v-if="cargando" class="estado">Generando recomendaciones IA...</div>
    <div v-else-if="error" class="estado estado-error">{{ error }}</div>
    <div v-else class="insights-container">
      <div v-for="(item, index) in insights" :key="index" :class="['insight-card', item.prioridad]">
      <div class="icon">💡</div>
      <div class="content">
        <h4>{{ item.titulo }}</h4>
        <p>{{ item.descripcion }}</p>
      </div>
      <div class="tag">{{ item.prioridad.toUpperCase() }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';

interface Insight {
  titulo: string;
  descripcion: string;
  prioridad: 'alta' | 'media' | 'baja';
  ruta_id?: string;
}

const insights = ref<Insight[]>([]);
const cargando = ref(true);
const error = ref('');
const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

onMounted(async () => {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/api/insights-automaticos`, { headers });
    const data = await res.json();

    if (!res.ok || !data.success) {
      error.value = data.message || 'No se pudieron generar recomendaciones IA.';
      return;
    }

    insights.value = data.insights;
  } catch (e) {
    error.value = 'Error de red al consultar recomendaciones IA.';
  } finally {
    cargando.value = false;
  }
});
</script>

<style scoped>
.insights-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.estado {
  margin-bottom: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  background: #e2e8f0;
  color: #334155;
  font-weight: 600;
}

.estado-error {
  background: #fee2e2;
  color: #991b1b;
}

.insight-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: white;
  border-left: 5px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.alta { border-left-color: #ef4444; background: #fef2f2; }
.media { border-left-color: #f59e0b; background: #fffbeb; }
.baja { border-left-color: #3b82f6; background: #eff6ff; }

.content h4 { margin: 0; font-size: 1rem; color: #1e293b; }
.content p { margin: 0.2rem 0 0 0; font-size: 0.85rem; color: #64748b; }
.tag { margin-left: auto; font-size: 0.7rem; font-weight: bold; padding: 2px 8px; border-radius: 4px; border: 1px solid currentColor; }
</style>