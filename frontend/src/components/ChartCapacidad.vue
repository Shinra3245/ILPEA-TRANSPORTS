<template>
  <div class="chart-container">
    <h3>📊 Capacidad Real vs Ocupación Máxima</h3>
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface Ruta {
  id: string;
  ruta: number;
  capacidad_real: number;
  max_pasajeros_dia: number;
}

interface Props {
  rutas: Ruta[];
}

const props = defineProps<Props>();

const chartData = computed(() => ({
  labels: props.rutas.map(r => `Ruta ${r.ruta}`),
  datasets: [
    {
      label: 'Capacidad Real',
      data: props.rutas.map(r => r.capacidad_real),
      backgroundColor: '#3b82f6',
      borderColor: '#1e40af',
      borderWidth: 1
    },
    {
      label: 'Pico de Pasajeros',
      data: props.rutas.map(r => r.max_pasajeros_dia),
      backgroundColor: '#fbbf24',
      borderColor: '#d97706',
      borderWidth: 1
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
      color: '#1e293b',
      font: { weight: 'bold' as const, size: 12 },
      formatter: (value: number) => `${value}`
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value: number | string) => `${value} pasajeros`
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
