<template>
  <div>
    <div v-if="cargando" class="estado">Cargando recomendaciones...</div>
    <div v-else-if="error" class="estado estado-error">{{ error }}</div>
    <div v-else-if="!insights.length" class="ui-empty">Sin recomendaciones disponibles.</div>
    <div v-else class="insights-container">
      <div v-for="(item, index) in insights" :key="item.recomendacion_id || index" :class="['insight-card', item.prioridad]">
        <div class="icon">
          <AppIcon name="lightbulb" :size="20" />
        </div>
        <div class="content">
          <h4>{{ item.titulo }}</h4>
          <p>{{ item.descripcion }}</p>
          <div v-if="esAdmin" class="insight-actions">
            <button
              v-if="puedeEjecutarRecomendacion(item)"
              type="button"
              class="btn-accion btn-ejecutar"
              :disabled="procesandoId === item.recomendacion_id"
              @click="abrirModalPlan(item)"
            >
              {{ textoBotonAccion(item) }}
            </button>
            <button
              type="button"
              class="btn-accion btn-rechazar"
              :disabled="procesandoId === item.recomendacion_id"
              @click="rechazarRecomendacion(item)"
            >
              {{ procesandoId === item.recomendacion_id ? 'Procesando...' : 'Rechazar' }}
            </button>
          </div>
          <p v-if="mensajes[item.recomendacion_id || '']" class="insight-msg">
            {{ mensajes[item.recomendacion_id || ''] }}
          </p>
        </div>
        <div class="tag">{{ item.prioridad.toUpperCase() }}</div>
      </div>
    </div>

    <EjecutarPlanModal
      v-model:visible="modalVisible"
      :insight="insightSeleccionado"
      :rutas="rutas"
      :fecha-operacion="fechaOperacion"
      :turno-operacion="turnoOperacion"
      @plan-ejecutado="onPlanEjecutado"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { usePlanesIA } from '../composables/usePlanesIA';
import AppIcon from './ui/AppIcon.vue';
import EjecutarPlanModal, { type InsightPlan, type RutaPlanOption } from './EjecutarPlanModal.vue';

interface Insight extends InsightPlan {
  recomendacion_id: string;
}

const props = defineProps<{
  rutas?: RutaPlanOption[];
  fechaOperacion?: string;
  turnoOperacion?: string | null;
}>();

const emit = defineEmits<{
  'plan-ejecutado': [];
  'feedback-registrado': [];
  'cargando-change': [cargando: boolean];
}>();

const insights = ref<Insight[]>([]);
const cargando = ref(true);
const error = ref('');
const modalVisible = ref(false);
const insightSeleccionado = ref<InsightPlan | null>(null);
const procesandoId = ref<string | null>(null);
const mensajes = ref<Record<string, string>>({});

const { authHeaders, usuario } = useAuth();
const { registrarFeedback } = usePlanesIA();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const esAdmin = computed(() => usuario.value?.rol === 'ADMIN');
const rutas = computed(() => props.rutas || []);

const obtenerTipoAccion = (item: Insight) => {
  const accion = String(item.tipo_accion || '').toLowerCase();
  if (accion === 'cambiar_unidad' || accion === 'cancelar_reasignar') return accion;

  const texto = `${item.titulo} ${item.descripcion}`.toLowerCase();
  return texto.includes('van') || texto.includes('unidad') || texto.includes('vehiculo') || texto.includes('vehículo')
    ? 'cambiar_unidad'
    : 'cancelar_reasignar';
};

const puedeEjecutarRecomendacion = (item: Insight) => {
  const titulo = item.titulo.toLowerCase();
  return obtenerTipoAccion(item) === 'cambiar_unidad'
    || item.prioridad === 'alta'
    || titulo.includes('cancelar')
    || titulo.includes('mover')
    || titulo.includes('reasign');
};

const textoBotonAccion = (item: Insight) =>
  obtenerTipoAccion(item) === 'cambiar_unidad'
    ? 'Cambiar vehículo'
    : 'Ejecutar plan';

const abrirModalPlan = (item: Insight) => {
  insightSeleccionado.value = item;
  modalVisible.value = true;
};

const onPlanEjecutado = () => {
  if (insightSeleccionado.value?.recomendacion_id) {
    mensajes.value[insightSeleccionado.value.recomendacion_id] = 'Plan ejecutado correctamente.';
  }
  emit('plan-ejecutado');
};

const rechazarRecomendacion = async (item: Insight) => {
  if (!item.ruta_id) {
    mensajes.value[item.recomendacion_id] = 'No se pudo identificar la ruta de la recomendación.';
    return;
  }

  procesandoId.value = item.recomendacion_id;
  mensajes.value[item.recomendacion_id] = '';

  try {
    await registrarFeedback({
      recomendacion_id: item.recomendacion_id,
      ruta_id: String(item.ruta_id),
      decision: 'RECHAZADA',
      razon: item.descripcion,
      prob_cancelacion: item.prob_cancelacion ?? null,
      ruta_alternativa_sugerida: item.ruta_alternativa_sugerida ?? null
    });
    mensajes.value[item.recomendacion_id] = 'Recomendación rechazada.';
    emit('feedback-registrado');
  } catch (err: unknown) {
    mensajes.value[item.recomendacion_id] = err instanceof Error
      ? err.message
      : 'No fue posible registrar el rechazo.';
  } finally {
    procesandoId.value = null;
  }
};

const cargarInsights = async () => {
  cargando.value = true;
  error.value = '';

  try {
    const headers = await authHeaders();
    const params = new URLSearchParams();
    if (props.fechaOperacion) {
      params.set('fecha', props.fechaOperacion);
    }
    if (props.turnoOperacion) {
      params.set('turno', props.turnoOperacion);
    }

    const query = params.toString();
    const url = query
      ? `${API_BASE_URL}/api/insights-automaticos?${query}`
      : `${API_BASE_URL}/api/insights-automaticos`;
    const res = await fetch(url, { headers });
    const data = await res.json();

    if (!res.ok || !data.success) {
      error.value = data.message || 'No se pudieron cargar recomendaciones.';
      insights.value = [];
      return;
    }

    insights.value = Array.isArray(data.insights) ? data.insights : [];
  } catch {
    error.value = 'Error de conexión.';
    insights.value = [];
  } finally {
    cargando.value = false;
  }
};

watch(cargando, (valor) => {
  emit('cargando-change', valor);
}, { immediate: true });

watch(
  () => [props.fechaOperacion, props.turnoOperacion],
  () => {
    cargarInsights();
  }
);

onMounted(() => {
  cargarInsights();
});
</script>

<style scoped>
.insights-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 0;
}

.estado {
  margin: 0;
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
  align-items: flex-start;
  padding: 1rem;
  background: white;
  border-left: 5px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.icon {
  display: flex;
  align-items: center;
  margin-right: 0.75rem;
  color: #64748b;
  margin-top: 0.15rem;
}

.alta { border-left-color: #ef4444; background: #fef2f2; }
.media { border-left-color: #f59e0b; background: #fffbeb; }
.baja { border-left-color: #3b82f6; background: #eff6ff; }

.content {
  flex: 1;
  min-width: 0;
}

.content h4 { margin: 0; font-size: 1rem; color: #1e293b; }
.content p { margin: 0.2rem 0 0 0; font-size: 0.85rem; color: #64748b; }

.insight-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn-accion {
  border: none;
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-ejecutar {
  background: #111827;
  color: #fff;
}

.btn-ejecutar:hover:not(:disabled) {
  background: #374151;
}

.btn-rechazar {
  background: #fff;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.btn-rechazar:hover:not(:disabled) {
  background: #fef2f2;
}

.btn-accion:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.insight-msg {
  margin-top: 0.5rem !important;
  font-size: 0.8rem !important;
  color: #166534 !important;
}

.tag {
  margin-left: 0.75rem;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid currentColor;
  flex-shrink: 0;
}
</style>
