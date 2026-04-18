<template>
  <div class="recomendaciones-wrapper">
    <div v-if="cargando" class="estado-ia cargando">
      ⏳ Analizando rutas con Inteligencia Artificial...
    </div>
    
    <div v-else-if="error" class="estado-ia error">
      ⚠️ Error de IA: {{ error }}
    </div>

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

const insights = ref([]);
const cargando = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/insights-automaticos');
    const data = await res.json();
    
    if (data.success) {
      insights.value = data.insights;
    } else {
      error.value = data.message || "La IA no pudo procesar los datos.";
    }
  } catch (err) {
    error.value = "No hay conexión con el backend en http://localhost:3000";
    console.error(err);
  } finally {
    cargando.value = false;
  }
});
</script>

<style scoped>
.recomendaciones-wrapper {
  margin-bottom: 2rem;
}
.estado-ia {
  padding: 1rem;
  border-radius: 8px;
  font-weight: bold;
  text-align: center;
}
.cargando {
  background-color: #e0f2fe;
  color: #0369a1;
}
.error {
  background-color: #fee2e2;
  color: #991b1b;
}
.insights-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
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