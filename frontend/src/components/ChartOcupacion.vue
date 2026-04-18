<template>
  <div class="chart-container">
    <h3>📈 Ocupación Máxima por Ruta</h3>
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

interface Ruta {
  id: string;
  ruta: number;
  porcentaje_ocupacion_max: number;
  alerta_ocupacion: string;
}

interface Props {
  rutas: Ruta[];
}

const props = defineProps<Props>();

const chartData = computed(() => ({
  labels: props.rutas.map(r => `Ruta ${r.ruta}`),
  datasets: [
    {
      label: 'Ocupación Máxima (%)',
      data: props.rutas.map(r => r.porcentaje_ocupacion_max),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: props.rutas.map(r => 
        r.porcentaje_ocupacion_max < 40 ? '#ef4444' : '#22c55e'
      ),
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7
    }
  ]
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        font: { size: 12 }
      }
    },
    title: {
      display: false
    },
    datalabels: {
      anchor: 'end' as const,
      align: 'top' as const,
      color: '#0f172a',
      font: { weight: 'bold' as const, size: 12 },
      formatter: (value: number) => `${value.toFixed(1)}%`
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      ticks: {
        callback: (value: number | string) => `${value}%`
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
}

.chart-container h3 {
  margin-top: 0;
  color: #1e293b;
  font-size: 1.1rem;
}
</style>
