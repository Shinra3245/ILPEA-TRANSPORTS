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
  capacidad_limite?: number;
  asientos_ocupados?: number;
  max_pasajeros_dia: number;
  programada?: boolean;
}

interface Props {
  rutas: Ruta[];
}

const props = defineProps<Props>();

const chartMinWidth = computed(() => `${Math.max(props.rutas.length * 70, 480)}px`);

const esVistaOperativa = computed(() =>
  props.rutas.some((ruta) => ruta.capacidad_limite !== undefined || ruta.asientos_ocupados !== undefined)
);

const obtenerCapacidad = (ruta: Ruta) => ruta.capacidad_limite ?? ruta.capacidad_real;

const obtenerOcupacion = (ruta: Ruta) => {
  if (ruta.asientos_ocupados !== undefined) {
    return ruta.asientos_ocupados;
  }

  return ruta.max_pasajeros_dia;
};

const chartData = computed(() => ({
  labels: props.rutas.map((r) => `Ruta ${r.ruta}`),
  datasets: [
    {
      label: esVistaOperativa.value ? 'Capacidad límite' : 'Capacidad Real',
      data: props.rutas.map(obtenerCapacidad),
      backgroundColor: '#3b82f6',
      borderColor: '#1e40af',
      borderWidth: 1
    },
    {
      label: esVistaOperativa.value ? 'Asientos ocupados' : 'Pico de Pasajeros',
      data: props.rutas.map(obtenerOcupacion),
      backgroundColor: '#fbbf24',
      borderColor: '#d97706',
      borderWidth: 1
    }
  ]
}));

const barLabelDentro = (ctx: { chart: ChartJS; dataset: { data: unknown[] }; dataIndex: number }) => {
  const value = Number(ctx.dataset.data[ctx.dataIndex]);
  if (!value) return false;

  const yScale = ctx.chart.scales.y;
  if (!yScale) return false;

  const barTop = yScale.getPixelForValue(value);
  return barTop - yScale.top < 40;
};

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      top: 8,
      left: 4,
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
      display: (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
        Number(ctx.dataset.data[ctx.dataIndex]) > 0,
      anchor: (ctx: { chart: ChartJS; dataset: { data: unknown[] }; dataIndex: number }) =>
        barLabelDentro(ctx) ? ('center' as const) : ('end' as const),
      align: (ctx: { chart: ChartJS; dataset: { data: unknown[] }; dataIndex: number }) =>
        barLabelDentro(ctx) ? ('center' as const) : ('top' as const),
      color: (ctx: { chart: ChartJS; dataset: { data: unknown[] }; dataIndex: number }) =>
        barLabelDentro(ctx) ? '#ffffff' : '#1e293b',
      offset: 4,
      clip: false,
      font: { weight: 'bold' as const, size: 11 },
      formatter: (value: number) => `${value}`
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
      grace: '10%',
      ticks: {
        padding: 8,
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
