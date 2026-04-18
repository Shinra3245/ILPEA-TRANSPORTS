<template>
  <div class="insights-container">
    <div v-for="(item, index) in insights" :key="index" :class="['insight-card', item.prioridad]">
      <div class="icon">💡</div>
      <div class="content">
        <h4>{{ item.titulo }}</h4>
        <p>{{ item.descripcion }}</p>
      </div>
      <div class="tag">{{ item.prioridad.toUpperCase() }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const insights = ref([]);

onMounted(async () => {
  const res = await fetch('http://localhost:3000/api/insights-automaticos');
  const data = await res.json();
  if (data.success) {
    insights.value = data.insights;
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