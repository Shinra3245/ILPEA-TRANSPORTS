<template>
  <div class="chart-container">
    <h3 class="title-with-icon">
      <AppIcon name="trending-up" :size="20" />
      <span>Ocupación máxima por ruta</span>
    </h3>
    <div class="chart-scroll">
      <div class="chart-canvas-wrapper" :style="{ minWidth: chartMinWidth }">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './ui/AppIcon.vue';
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

// 50px por ruta asegura espacio suficiente para el punto + etiqueta sin solaparse,
// sin importar si el contenedor (card de 3 columnas en escritorio o pantalla móvil) es angosto.
const chartMinWidth = computed(() => `${Math.max(props.rutas.length * 50, 480)}px`);

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

const etiquetaAbajo = (ctx: { dataset: { data: unknown[] }; dataIndex: number }) => {
  const value = Number(ctx.dataset.data[ctx.dataIndex]);
  return value <= 10;
};

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      top: 8,
      left: 8,
      right: 8
    }
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        font: { size: 12 },
        padding: 16,
        boxWidth: 12
      }
    },
    title: {
      display: false
    },
    datalabels: {
      anchor: (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
        etiquetaAbajo(ctx) ? ('start' as const) : ('end' as const),
      align: (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
        etiquetaAbajo(ctx) ? ('bottom' as const) : ('top' as const),
      offset: (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
        etiquetaAbajo(ctx) ? 10 : 6,
      color: '#0f172a',
      font: { weight: 'bold' as const, size: 11 },
      formatter: (value: number) => `${value.toFixed(1)}%`
    }
  },
  scales: {
    x: {
      ticks: {
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0,
        padding: 4
      }
    },
    y: {
      beginAtZero: true,
      max: 100,
      grace: '5%',
      ticks: {
        padding: 8,
        callback: (value: number | string) => `${value}%`
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
