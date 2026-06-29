<template>
  <div class="chart-container">
    <h3 class="title-with-icon">
      <AppIcon name="bar-chart-3" :size="20" />
      <span>Capacidad vs ocupación</span>
    </h3>
    <div class="chart-scroll">
      <div class="chart-canvas-wrapper" :style="{ minWidth: chartMinWidth }">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './ui/AppIcon.vue';
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

// 70px por ruta asegura espacio suficiente para 2 barras + etiqueta sin solaparse,
// sin importar si el contenedor (card de 3 columnas en escritorio o pantalla móvil) es angosto.
const chartMinWidth = computed(() => `${Math.max(props.rutas.length * 70, 480)}px`);

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

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
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
    x: {
      ticks: {
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0
      }
    },
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value: number | string) => `${value} pasajeros`
      }
    }
  }
}));
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

.chart-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.chart-canvas-wrapper {
  position: relative;
  height: 320px;
}

@media (max-width: 768px) {
  .chart-canvas-wrapper {
    height: 260px;
  }
}
</style>
