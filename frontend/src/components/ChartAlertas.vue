<template>
  <div class="chart-container">
    <h3>⚠️ Estado de Rutas</h3>
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface Ruta {
  id: string;
  alerta_ocupacion: string;
}

interface Props {
  rutas: Ruta[];
}

const props = defineProps<Props>();

const estadisticas = computed(() => {
  let ok = 0;
  let alerta = 0;
  let cancelar = 0;

  props.rutas.forEach(ruta => {
    if (ruta.alerta_ocupacion === 'OK') {
      ok++;
    } else if (ruta.alerta_ocupacion.includes('CANCELAR')) {
      cancelar++;
    } else {
      alerta++;
    }
  });

  return { ok, alerta, cancelar };
});

const chartData = computed(() => ({
  labels: ['✅ OK', '⚠️ Alerta', '❌ Cancelar'],
  datasets: [
    {
      data: [
        estadisticas.value.ok,
        estadisticas.value.alerta,
        estadisticas.value.cancelar
      ],
      backgroundColor: [
        '#22c55e',
        '#f59e0b',
        '#ef4444'
      ],
      borderColor: [
        '#16a34a',
        '#d97706',
        '#dc2626'
      ],
      borderWidth: 2
    }
  ]
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        font: { size: 12 },
        padding: 15
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const percentage = ((context.parsed / total) * 100).toFixed(1);
          return `${context.label}: ${context.parsed} rutas (${percentage}%)`;
        }
      }
    },
    datalabels: {
      color: '#ffffff',
      font: { weight: 'bold' as const, size: 12 },
      formatter: (value: number, context: any) => {
        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
        return `${value} (${percentage}%)`;
      }
    }
  }
};
</script>

<style scoped>
.chart-container {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
  max-width: 400px;
}

.chart-container h3 {
  margin-top: 0;
  color: #1e293b;
  font-size: 1.1rem;
}
</style>
