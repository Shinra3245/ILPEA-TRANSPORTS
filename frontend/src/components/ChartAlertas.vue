<template>
  <div class="chart-container">
    <h3 class="title-with-icon">
      <AppIcon name="alert-triangle" :size="20" />
      <span>Estado de rutas</span>
    </h3>
    <div class="chart-canvas-wrapper">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './ui/AppIcon.vue';
import { Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { Context as DataLabelContext } from 'chartjs-plugin-datalabels';
import type { TooltipItem } from 'chart.js';

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

  props.rutas.forEach((ruta) => {
    const textoAlerta = String(ruta.alerta_ocupacion || '');
    if (textoAlerta.includes('SIN PROGRAMACIÓN') || textoAlerta.includes('SIN DATOS')) {
      return;
    }
    if (textoAlerta === 'OK') {
      ok++;
    } else if (textoAlerta.includes('CANCELAR')) {
      cancelar++;
    } else {
      alerta++;
    }
  });

  return { ok, alerta, cancelar };
});

const chartData = computed(() => ({
  labels: ['OK', 'Alerta', 'Cancelar'],
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

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '58%',
  layout: {
    padding: 8
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        font: { size: 12 },
        padding: 12,
        boxWidth: 12
      }
    },
    tooltip: {
      callbacks: {
        label: (context: TooltipItem<'doughnut'>) => {
          const data = context.dataset.data as number[];
          const total = data.reduce((a, b) => a + Number(b), 0);
          const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
          return `${context.label}: ${context.parsed} rutas (${percentage}%)`;
        }
      }
    },
    datalabels: {
      display: (context: DataLabelContext) => {
        const data = context.dataset.data as number[];
        const value = Number(data[context.dataIndex]);
        if (value <= 0) return false;

        const total = data.reduce((a, b) => a + Number(b), 0);
        if (total <= 0) return false;

        return (value / total) * 100 >= 12;
      },
      color: '#ffffff',
      font: { weight: 'bold' as const, size: 11 },
      anchor: 'center' as const,
      align: 'center' as const,
      formatter: (value: number, context: DataLabelContext) => {
        const data = context.dataset.data as number[];
        const total = data.reduce((a, b) => a + Number(b), 0);
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
        return `${value}\n(${percentage}%)`;
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
  max-width: 400px;
}

.chart-container h3 {
  margin-top: 0;
  color: #1e293b;
  font-size: 1.1rem;
}

.chart-canvas-wrapper {
  position: relative;
  height: 280px;
  max-width: 320px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .chart-canvas-wrapper {
    height: 240px;
    max-width: 100%;
  }
}
</style>
