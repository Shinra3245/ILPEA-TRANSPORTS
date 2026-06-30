<template>
  <Teleport to="body">
    <div v-if="visible" class="crud-modal-overlay" @click.self="cerrar">
      <form class="crud-modal plan-modal" @submit.prevent="confirmar">
        <h3>Ejecutar plan IA</h3>
        <p class="ui-muted plan-resumen">{{ insight?.titulo }}</p>

        <div class="plan-action-badge">
          Acción sugerida: <strong>{{ etiquetaAccion }}</strong>
        </div>

        <label>
          Ruta origen
          <input :value="etiquetaOrigen" type="text" disabled />
        </label>

        <label v-if="accionRecomendada === 'cancelar_reasignar'">
          Ruta destino
          <select v-model="form.ruta_destino_id" required>
            <option value="" disabled>Selecciona ruta destino</option>
            <option
              v-for="ruta in rutasDestino"
              :key="ruta.id"
              :value="ruta.id"
            >
              {{ ruta.label }}
            </option>
          </select>
        </label>

        <label>
          Fecha del plan
          <input v-model="form.fecha" type="date" required />
        </label>

        <label>
          Turno
          <select v-model="form.turno">
            <option value="">Sin turno específico</option>
            <option value="matutino">Matutino</option>
            <option value="vespertino">Vespertino</option>
          </select>
        </label>

        <template v-if="accionRecomendada === 'cambiar_unidad'">
          <label>
            Tipo de unidad sugerida
            <input v-model.trim="form.tipo_unidad" type="text" required placeholder="Van, Sprinter, Autobús..." />
          </label>

          <label>
            Capacidad sugerida
            <input v-model.number="form.capacidad_limite" type="number" :min="pasajerosOrigen || 1" required />
          </label>

          <label>
            Código de unidad
            <input v-model.trim="form.codigo_unidad" type="text" placeholder="Opcional" />
          </label>
        </template>

        <label>
          Motivo
          <textarea
            v-model.trim="form.motivo"
            rows="3"
            placeholder="Motivo de la reasignación"
          />
        </label>

        <label v-if="accionRecomendada === 'cancelar_reasignar'" class="plan-checkbox">
          <input v-model="form.cancelar_origen" type="checkbox" />
          <span>Cancelar la programación origen después de mover todos los empleados</span>
        </label>

        <p v-if="error" class="estado-error">{{ error }}</p>

        <div class="crud-modal-actions">
          <button class="crud-modal-btn-primary" type="submit" :disabled="enviando">
            {{ enviando ? 'Ejecutando...' : 'Confirmar plan' }}
          </button>
          <button class="crud-modal-btn-secondary" type="button" :disabled="enviando" @click="cerrar">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { usePlanesIA, type CambiarUnidadPayload, type EjecutarPlanPayload } from '../composables/usePlanesIA';

export interface RutaPlanOption {
  id: string;
  ruta: number;
  label: string;
  tipo_unidad?: string | null;
  capacidad_limite?: number | null;
  capacidad_real?: number | null;
  asientos_ocupados?: number | null;
  codigo_unidad?: string | null;
}

export interface InsightPlan {
  recomendacion_id?: string;
  titulo: string;
  descripcion: string;
  prioridad: 'alta' | 'media' | 'baja';
  ruta_id?: string;
  ruta_alternativa_sugerida?: string | null;
  prob_cancelacion?: number | null;
  tipo_accion?: 'cancelar_reasignar' | 'cambiar_unidad' | string | null;
  tipo_unidad_sugerida?: string | null;
  capacidad_sugerida?: number | null;
  codigo_unidad_sugerido?: string | null;
}

const props = defineProps<{
  visible: boolean;
  insight: InsightPlan | null;
  rutas: RutaPlanOption[];
  fechaOperacion?: string;
  turnoOperacion?: string | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'plan-ejecutado': [];
}>();

const { cambiarUnidadProgramacion, ejecutarPlan, registrarFeedback } = usePlanesIA();
const enviando = ref(false);
const error = ref('');

const form = reactive({
  ruta_origen_id: '',
  ruta_destino_id: '',
  fecha: '',
  turno: '',
  motivo: '',
  cancelar_origen: false,
  tipo_unidad: '',
  capacidad_limite: 12,
  codigo_unidad: ''
});

const resolverIdRuta = (identificador?: string | null) => {
  if (!identificador) return '';
  const coincidencia = props.rutas.find(
    (ruta) => ruta.id === identificador || String(ruta.ruta) === String(identificador)
  );
  return coincidencia?.id || identificador;
};

const etiquetaOrigen = computed(() => {
  const idOrigen = resolverIdRuta(props.insight?.ruta_id);
  const ruta = props.rutas.find((item) => item.id === idOrigen);
  return ruta?.label || props.insight?.ruta_id || 'N/D';
});

const rutasDestino = computed(() => {
  const idOrigen = resolverIdRuta(props.insight?.ruta_id);
  return props.rutas.filter((ruta) => ruta.id !== idOrigen);
});

const accionRecomendada = computed<'cancelar_reasignar' | 'cambiar_unidad'>(() => {
  const accion = String(props.insight?.tipo_accion || '').toLowerCase();
  if (accion === 'cambiar_unidad') return 'cambiar_unidad';
  if (accion === 'cancelar_reasignar') return 'cancelar_reasignar';

  const texto = `${props.insight?.titulo || ''} ${props.insight?.descripcion || ''}`.toLowerCase();
  return texto.includes('van') || texto.includes('unidad') || texto.includes('vehiculo') || texto.includes('vehículo')
    ? 'cambiar_unidad'
    : 'cancelar_reasignar';
});

const etiquetaAccion = computed(() =>
  accionRecomendada.value === 'cambiar_unidad'
    ? 'Cambiar vehículo'
    : 'Cancelar y reasignar'
);

const rutaOrigen = computed(() => {
  const idOrigen = resolverIdRuta(props.insight?.ruta_id);
  return props.rutas.find((item) => item.id === idOrigen) || null;
});

const pasajerosOrigen = computed(() => Number(rutaOrigen.value?.asientos_ocupados) || 0);

const capacidadSugerida = () => {
  const capacidadInsight = Number(props.insight?.capacidad_sugerida);
  if (Number.isInteger(capacidadInsight) && capacidadInsight > 0) {
    return Math.max(capacidadInsight, pasajerosOrigen.value || 0);
  }

  const texto = `${props.insight?.titulo || ''} ${props.insight?.descripcion || ''}`.toLowerCase();
  if (texto.includes('van')) {
    return Math.max(pasajerosOrigen.value || 0, 12);
  }

  return Number(rutaOrigen.value?.capacidad_limite || rutaOrigen.value?.capacidad_real) || Math.max(pasajerosOrigen.value || 0, 12);
};

const inicializarFormulario = () => {
  const idOrigen = resolverIdRuta(props.insight?.ruta_id);
  const idDestinoSugerido = resolverIdRuta(props.insight?.ruta_alternativa_sugerida);
  const destinoValido = rutasDestino.value.some((ruta) => ruta.id === idDestinoSugerido);

  form.ruta_origen_id = idOrigen;
  form.ruta_destino_id = destinoValido
    ? idDestinoSugerido
    : (rutasDestino.value[0]?.id || '');
  form.fecha = props.fechaOperacion || new Date().toISOString().slice(0, 10);
  form.turno = props.turnoOperacion || '';
  form.motivo = props.insight?.descripcion || '';
  const textoInsight = `${props.insight?.titulo || ''} ${props.insight?.descripcion || ''}`.toLowerCase();
  form.cancelar_origen = accionRecomendada.value === 'cancelar_reasignar'
    && (textoInsight.includes('cancelar') || textoInsight.includes('baja ocup'));
  form.tipo_unidad = props.insight?.tipo_unidad_sugerida || (textoInsight.includes('van') ? 'VAN' : (rutaOrigen.value?.tipo_unidad || ''));
  form.capacidad_limite = capacidadSugerida();
  form.codigo_unidad = props.insight?.codigo_unidad_sugerido || rutaOrigen.value?.codigo_unidad || '';
  error.value = '';
};

watch(
  () => [props.visible, props.insight?.recomendacion_id],
  ([visible]) => {
    if (visible) {
      inicializarFormulario();
    }
  }
);

const cerrar = () => {
  if (enviando.value) return;
  emit('update:visible', false);
};

const confirmar = async () => {
  if (!props.insight || !form.ruta_origen_id || !form.fecha) {
    error.value = 'Completa ruta origen y fecha antes de continuar.';
    return;
  }

  if (accionRecomendada.value === 'cancelar_reasignar' && !form.ruta_destino_id) {
    error.value = 'Completa ruta destino antes de continuar.';
    return;
  }

  if (accionRecomendada.value === 'cambiar_unidad' && (!form.tipo_unidad || !Number.isInteger(Number(form.capacidad_limite)))) {
    error.value = 'Completa tipo de unidad y capacidad antes de continuar.';
    return;
  }

  enviando.value = true;
  error.value = '';

  try {
    if (accionRecomendada.value === 'cambiar_unidad') {
      const payload: CambiarUnidadPayload = {
        id_ruta: form.ruta_origen_id,
        fecha: form.fecha,
        turno: form.turno || null,
        tipo_unidad: form.tipo_unidad,
        capacidad_limite: Number(form.capacidad_limite),
        codigo_unidad: form.codigo_unidad || null,
        motivo: form.motivo || props.insight.titulo
      };
      await cambiarUnidadProgramacion(payload);
      if (props.insight.recomendacion_id) {
        await registrarFeedback({
          recomendacion_id: props.insight.recomendacion_id,
          ruta_id: form.ruta_origen_id,
          decision: 'ACEPTADA',
          razon: form.motivo || props.insight.titulo,
          prob_cancelacion: props.insight.prob_cancelacion ?? null,
          ruta_alternativa_sugerida: props.insight.ruta_alternativa_sugerida ?? null
        });
      }
    } else {
      const payload: EjecutarPlanPayload = {
        ruta_origen_id: form.ruta_origen_id,
        ruta_destino_id: form.ruta_destino_id,
        fecha: form.fecha,
        turno: form.turno || null,
        recomendacion_id: props.insight.recomendacion_id || null,
        motivo: form.motivo || props.insight.titulo,
        cancelar_origen: form.cancelar_origen
      };
      await ejecutarPlan(payload);
    }

    emit('plan-ejecutado');
    emit('update:visible', false);
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'No fue posible ejecutar el plan IA.';
  } finally {
    enviando.value = false;
  }
};
</script>

<style scoped>
.plan-modal {
  max-width: 520px;
}

.plan-resumen {
  margin: 0 0 1rem;
}

.plan-action-badge {
  margin: 0 0 1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.85rem;
}

.plan-modal label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: #334155;
}

.plan-modal input,
.plan-modal select,
.plan-modal textarea {
  font-weight: 400;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
}

.plan-checkbox {
  flex-direction: row !important;
  align-items: flex-start;
  gap: 0.5rem !important;
}

.plan-checkbox input {
  margin-top: 0.15rem;
  width: auto;
}

.estado-error {
  margin: 0 0 0.75rem;
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.85rem;
}
</style>
