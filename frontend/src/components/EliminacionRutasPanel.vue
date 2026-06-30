<template>
  <section class="crud-page">
    <div class="crud-toolbar">
      <div class="crud-filters">
        <button
          type="button"
          :class="['crud-filter-btn', { active: filtroEstado === 'todas' }]"
          @click="filtroEstado = 'todas'"
        >
          Todas ({{ rutas.length }})
        </button>
        <button
          type="button"
          :class="['crud-filter-btn', { active: filtroEstado === 'activas' }]"
          @click="filtroEstado = 'activas'"
        >
          Activas
        </button>
        <button
          type="button"
          :class="['crud-filter-btn', { active: filtroEstado === 'deshabilitadas' }]"
          @click="filtroEstado = 'deshabilitadas'"
        >
          Deshabilitadas
        </button>
      </div>

      <div class="crud-operacion-filtros">
        <label class="crud-field-inline">
          <span>Fecha</span>
          <input v-model="fechaOperacion" type="date" class="crud-input-inline" />
        </label>
        <label class="crud-field-inline">
          <span>Turno</span>
          <select v-model="turnoOperacion" class="crud-input-inline">
            <option value="">Todos</option>
            <option v-for="turno in turnosDisponibles" :key="turno.value" :value="turno.value">
              {{ turno.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="crud-search crud-search--autocomplete">
        <AppAutocomplete
          v-model="terminoBusqueda"
          variant="toolbar"
          mode="filter"
          :options="opcionesBusqueda"
          placeholder="Buscar por número o zona..."
        />
      </div>
    </div>

    <div v-if="mensaje || error" class="crud-alerts">
      <p v-if="mensaje" class="ui-alert ui-alert--success">{{ mensaje }}</p>
      <p v-if="error" class="ui-alert ui-alert--error">{{ error }}</p>
    </div>

    <div class="crud-table-wrap">
      <div v-if="cargando" class="crud-empty">Cargando rutas...</div>
      <div v-else-if="!rutasFiltradas.length" class="crud-empty">
        {{ terminoBusqueda ? 'Sin resultados para la búsqueda.' : 'No hay rutas registradas.' }}
      </div>
      <div v-else class="crud-table-scroll">
        <table class="crud-table">
          <thead>
            <tr>
              <th>Ruta</th>
              <th>Zona</th>
              <th>Tipo catálogo</th>
              <th>Unidad del día</th>
              <th>Código</th>
              <th>Capacidad</th>
              <th>Ocupación</th>
              <th>Pasajeros pend.</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ruta in rutasFiltradas" :key="ruta.id">
              <td><span class="crud-id">Ruta {{ ruta.ruta ?? '—' }}</span></td>
              <td>{{ ruta.zona || '—' }}</td>
              <td>{{ ruta.tipo_unidad || '—' }}</td>
              <td>{{ ruta.operacion?.tipo_unidad || '—' }}</td>
              <td>{{ ruta.operacion?.codigo_unidad || '—' }}</td>
              <td>{{ ruta.operacion?.capacidad_limite ?? '—' }}</td>
              <td>
                <span v-if="ruta.operacion?.capacidad_limite">
                  {{ ruta.operacion?.asientos_ocupados ?? 0 }}/{{ ruta.operacion?.capacidad_limite }}
                </span>
                <span v-else>—</span>
              </td>
              <td>
                <span :class="ruta.total_pasajeros > 0 ? 'crud-status-no' : 'crud-status-yes'">
                  {{ ruta.total_pasajeros }}
                </span>
              </td>
              <td>
                <span v-if="!ruta.activa" class="crud-status-no">Deshabilitada</span>
                <span v-else-if="ruta.operacion?.cancelada" class="crud-status-no">Cancelada</span>
                <span v-else class="crud-status-yes">
                  <AppIcon name="check" :size="12" />
                  Activa
                </span>
              </td>
              <td>
                <div class="crud-actions">
                  <button
                    v-if="ruta.activa && !ruta.operacion?.cancelada"
                    type="button"
                    class="crud-action-btn crud-action-btn--edit"
                    :disabled="procesandoId === ruta.id"
                    @click="abrirModalUnidad(ruta)"
                  >
                    <AppIcon name="truck" :size="13" />
                    Asignar unidad
                  </button>
                  <button
                    v-if="ruta.activa"
                    type="button"
                    class="crud-action-btn crud-action-btn--delete"
                    :disabled="procesandoId === ruta.id"
                    @click="intentarDeshabilitar(ruta)"
                  >
                    <AppIcon name="trash-2" :size="13" />
                    Deshabilitar
                  </button>
                  <button
                    v-else
                    type="button"
                    class="crud-action-btn crud-action-btn--edit"
                    :disabled="procesandoId === ruta.id"
                    @click="habilitarRuta(ruta)"
                  >
                    <AppIcon name="check" :size="13" />
                    Habilitar
                  </button>
                  <button
                    v-if="ruta.total_pasajeros > 0 && ruta.activa"
                    type="button"
                    class="crud-action-btn"
                    @click="mostrarBloqueo(ruta)"
                  >
                    Ver pasajeros
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="modalBloqueoAbierto" class="crud-modal-overlay" @click.self="cerrarModalBloqueo">
        <div class="crud-modal bloqueo-modal">
          <h3>No se puede deshabilitar esta ruta</h3>
          <p class="ui-muted bloqueo-intro">
            La ruta <strong>Ruta {{ rutaSeleccionada?.ruta }}</strong> tiene pasajeros asignados desde hoy en adelante.
            Reasígnalos antes de deshabilitarla.
          </p>

          <div class="crud-table-scroll bloqueo-tabla">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>ID empleado</th>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Asiento</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="empleado in rutaSeleccionada?.empleados_a_reasignar || []"
                  :key="`${empleado.id_empleado}-${empleado.fecha}-${empleado.turno || ''}`"
                >
                  <td><span class="crud-id">{{ empleado.id_empleado }}</span></td>
                  <td>{{ empleado.nombre }}</td>
                  <td>{{ empleado.fecha }}</td>
                  <td>{{ empleado.turno || '—' }}</td>
                  <td>{{ empleado.asiento ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="crud-modal-actions">
            <button type="button" class="crud-btn-secondary" @click="cerrarModalBloqueo">Cerrar</button>
            <button type="button" class="crud-btn-new" @click="irAAsignaciones">Ir a asignaciones</button>
          </div>
        </div>
      </div>

      <div v-if="modalUnidadAbierto && rutaUnidadSeleccionada" class="crud-modal-overlay" @click.self="cerrarModalUnidad">
        <form class="crud-modal unidad-modal" @submit.prevent="guardarUnidad">
          <h3>Asignar unidad operativa</h3>
          <p class="ui-muted unidad-intro">
            Ruta <strong>{{ rutaUnidadSeleccionada.ruta }}</strong> — {{ rutaUnidadSeleccionada.zona || 'Sin zona' }}
          </p>

          <label>
            Fecha
            <input v-model="formUnidad.fecha" type="date" required />
          </label>

          <label>
            Turno
            <select v-model="formUnidad.turno">
              <option value="">Sin turno específico</option>
              <option v-for="turno in turnosDisponibles" :key="turno.value" :value="turno.value">
                {{ turno.label }}
              </option>
            </select>
          </label>

          <label>
            Tipo de unidad
            <select v-model="formUnidad.tipoPreset" required @change="aplicarPresetCapacidad">
              <option value="Van">Van</option>
              <option value="Sprinter">Sprinter</option>
              <option value="Autobús">Autobús</option>
              <option value="Camión">Camión</option>
              <option value="Otro">Otro</option>
            </select>
          </label>

          <label v-if="formUnidad.tipoPreset === 'Otro'">
            Nombre de unidad
            <input v-model.trim="formUnidad.tipoUnidad" type="text" required placeholder="Tipo personalizado" />
          </label>

          <label>
            Capacidad
            <input
              v-model.number="formUnidad.capacidadLimite"
              type="number"
              :min="pasajerosActualesUnidad || 1"
              required
            />
          </label>

          <label>
            Código de unidad
            <input v-model.trim="formUnidad.codigoUnidad" type="text" placeholder="Ej. E0234" />
          </label>

          <label>
            Motivo
            <textarea v-model.trim="formUnidad.motivo" rows="3" placeholder="Motivo de la asignación manual" />
          </label>

          <p v-if="errorModalUnidad" class="ui-alert ui-alert--error">{{ errorModalUnidad }}</p>

          <div class="crud-modal-actions">
            <button type="submit" class="crud-btn-new" :disabled="guardandoUnidad">
              {{ guardandoUnidad ? 'Guardando...' : 'Guardar unidad' }}
            </button>
            <button type="button" class="crud-btn-secondary" :disabled="guardandoUnidad" @click="cerrarModalUnidad">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from './ui/AppIcon.vue';
import AppAutocomplete, { type AutocompleteOption } from './ui/AppAutocomplete.vue';
import { coincideBusqueda } from '../utils/busqueda';
import { useAuth } from '../composables/useAuth';
import {
  capacidadPorTipoUnidad,
  type RutaProgramadaOperativa,
  useProgramacionUnidad,
} from '../composables/useProgramacionUnidad';

interface EmpleadoReasignar {
  id_empleado: string;
  nombre: string;
  email?: string | null;
  fecha: string;
  turno?: string | null;
  asiento?: number | null;
}

interface RutaEliminacion {
  id: string;
  ruta?: number | null;
  zona?: string | null;
  tipo_unidad?: string | null;
  codigo_unidad?: string | null;
  activa: boolean;
  eliminada_en?: string | null;
  puede_deshabilitar?: boolean;
  puede_habilitar?: boolean;
  total_pasajeros: number;
  empleados_a_reasignar: EmpleadoReasignar[];
  operacion?: RutaProgramadaOperativa | null;
}

const TURNOS = [
  { value: 'mixto_1', label: 'Mixto 1' },
  { value: 'mixto_2', label: 'Mixto 2' },
  { value: 'sab_3', label: 'Sábado 3er' },
  { value: 'dom_1', label: 'Domingo 1er' },
  { value: 'dom_2', label: 'Domingo 2do' },
  { value: 'dom_3', label: 'Domingo 3er' },
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const router = useRouter();
const { authHeaders } = useAuth();
const { listarRutasProgramadas, cambiarUnidadProgramacion } = useProgramacionUnidad();

const rutas = ref<RutaEliminacion[]>([]);
const programacionPorRuta = ref<Record<string, RutaProgramadaOperativa>>({});
const cargando = ref(false);
const procesandoId = ref<string | null>(null);
const error = ref<string | null>(null);
const mensaje = ref<string | null>(null);
const terminoBusqueda = ref('');
const filtroEstado = ref<'todas' | 'activas' | 'deshabilitadas'>('todas');
const fechaOperacion = ref(new Date().toISOString().slice(0, 10));
const turnoOperacion = ref('');
const modalBloqueoAbierto = ref(false);
const modalUnidadAbierto = ref(false);
const rutaSeleccionada = ref<RutaEliminacion | null>(null);
const rutaUnidadSeleccionada = ref<RutaEliminacion | null>(null);
const guardandoUnidad = ref(false);
const errorModalUnidad = ref<string | null>(null);

const formUnidad = ref({
  fecha: '',
  turno: '',
  tipoPreset: 'Van',
  tipoUnidad: 'Van',
  capacidadLimite: 12,
  codigoUnidad: '',
  motivo: '',
});

const turnosDisponibles = TURNOS;

const rutasConOperacion = computed(() =>
  rutas.value.map((ruta) => ({
    ...ruta,
    operacion: programacionPorRuta.value[ruta.id] || null,
  })),
);

const opcionesBusqueda = computed<AutocompleteOption[]>(() =>
  rutasConOperacion.value.map((ruta) => ({
    value: String(ruta.id),
    label: `Ruta ${ruta.ruta ?? 'N/D'} — ${ruta.zona || 'Sin zona'}`,
    hint: ruta.operacion?.codigo_unidad || ruta.tipo_unidad || undefined,
    keywords: `ruta ${ruta.ruta ?? ''} ${ruta.zona ?? ''} ${ruta.tipo_unidad ?? ''} ${ruta.operacion?.codigo_unidad ?? ''}`,
  })),
);

const rutasFiltradas = computed(() => {
  const termino = terminoBusqueda.value;

  return rutasConOperacion.value.filter((ruta) => {
    if (filtroEstado.value === 'activas' && !ruta.activa) return false;
    if (filtroEstado.value === 'deshabilitadas' && ruta.activa) return false;

    return coincideBusqueda(
      termino,
      'ruta',
      ruta.ruta,
      ruta.zona,
      ruta.tipo_unidad,
      ruta.operacion?.codigo_unidad,
      ruta.id,
    );
  });
});

const pasajerosActualesUnidad = computed(() => {
  const ruta = rutaUnidadSeleccionada.value;
  if (!ruta) return 0;
  return ruta.operacion?.asientos_ocupados ?? 0;
});

async function obtenerHeaders() {
  const headers = await authHeaders();
  if (!headers.Authorization) {
    throw new Error('No hay sesión activa.');
  }

  return {
    'Content-Type': 'application/json',
    ...headers,
  };
}

async function cargarProgramacionOperativa() {
  try {
    const programadas = await listarRutasProgramadas(
      fechaOperacion.value,
      turnoOperacion.value || null,
    );
    const mapa: Record<string, RutaProgramadaOperativa> = {};
    programadas.forEach((ruta) => {
      mapa[ruta.id] = ruta;
    });
    programacionPorRuta.value = mapa;
  } catch (err: unknown) {
    programacionPorRuta.value = {};
    error.value = err instanceof Error ? err.message : 'No se pudo cargar la programación operativa.';
  }
}

async function cargarRutas() {
  cargando.value = true;
  error.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/rutas/eliminacion`, {
      headers: await obtenerHeaders(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detalle = payload?.message
        || (response.status === 404
          ? 'El endpoint no está disponible. Reinicia el servidor backend (npm run dev en /backend).'
          : null);
      throw new Error(detalle || `No se pudieron cargar las rutas (HTTP ${response.status}).`);
    }

    rutas.value = Array.isArray(payload?.data) ? payload.data : [];
    await cargarProgramacionOperativa();
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Error cargando rutas.';
  } finally {
    cargando.value = false;
  }
}

function resolverTipoUnidadFormulario() {
  return formUnidad.value.tipoPreset === 'Otro'
    ? formUnidad.value.tipoUnidad
    : formUnidad.value.tipoPreset;
}

function aplicarPresetCapacidad() {
  const tipo = resolverTipoUnidadFormulario();
  formUnidad.value.tipoUnidad = tipo;
  const minima = Math.max(pasajerosActualesUnidad.value, capacidadPorTipoUnidad(tipo));
  formUnidad.value.capacidadLimite = minima;
}

function abrirModalUnidad(ruta: RutaEliminacion) {
  rutaUnidadSeleccionada.value = ruta;
  const operacion = programacionPorRuta.value[ruta.id];
  const tipoInicial = operacion?.tipo_unidad || ruta.tipo_unidad || 'Van';
  const preset = ['Van', 'Sprinter', 'Autobús', 'Camión'].includes(tipoInicial) ? tipoInicial : 'Otro';

  formUnidad.value = {
    fecha: fechaOperacion.value,
    turno: turnoOperacion.value,
    tipoPreset: preset,
    tipoUnidad: tipoInicial,
    capacidadLimite: operacion?.capacidad_limite || capacidadPorTipoUnidad(tipoInicial),
    codigoUnidad: operacion?.codigo_unidad || ruta.codigo_unidad || '',
    motivo: 'Asignación manual de unidad operativa.',
  };

  if (formUnidad.value.capacidadLimite < pasajerosActualesUnidad.value) {
    formUnidad.value.capacidadLimite = pasajerosActualesUnidad.value;
  }

  errorModalUnidad.value = null;
  modalUnidadAbierto.value = true;
}

function cerrarModalUnidad() {
  if (guardandoUnidad.value) return;
  modalUnidadAbierto.value = false;
  rutaUnidadSeleccionada.value = null;
  errorModalUnidad.value = null;
}

async function guardarUnidad() {
  const ruta = rutaUnidadSeleccionada.value;
  if (!ruta) return;

  const tipoUnidad = resolverTipoUnidadFormulario();
  const capacidad = Number(formUnidad.value.capacidadLimite);

  if (!tipoUnidad || !Number.isInteger(capacidad) || capacidad <= 0) {
    errorModalUnidad.value = 'Completa tipo de unidad y capacidad válida.';
    return;
  }

  if (capacidad < pasajerosActualesUnidad.value) {
    errorModalUnidad.value = 'La capacidad no puede ser menor a los pasajeros actuales.';
    return;
  }

  guardandoUnidad.value = true;
  errorModalUnidad.value = null;

  try {
    await cambiarUnidadProgramacion({
      id_ruta: ruta.id,
      fecha: formUnidad.value.fecha,
      turno: formUnidad.value.turno || null,
      tipo_unidad: tipoUnidad,
      capacidad_limite: capacidad,
      codigo_unidad: formUnidad.value.codigoUnidad || null,
      motivo: formUnidad.value.motivo || 'Asignación manual de unidad operativa.',
    });

    mensaje.value = `Unidad asignada correctamente a la Ruta ${ruta.ruta}.`;
    cerrarModalUnidad();
    await cargarProgramacionOperativa();
  } catch (err: unknown) {
    errorModalUnidad.value = err instanceof Error ? err.message : 'No se pudo asignar la unidad.';
  } finally {
    guardandoUnidad.value = false;
  }
}

function mostrarBloqueo(ruta: RutaEliminacion) {
  rutaSeleccionada.value = ruta;
  modalBloqueoAbierto.value = true;
}

function cerrarModalBloqueo() {
  modalBloqueoAbierto.value = false;
  rutaSeleccionada.value = null;
}

function irAAsignaciones() {
  cerrarModalBloqueo();
  router.push('/admin/asignaciones');
}

async function intentarDeshabilitar(ruta: RutaEliminacion) {
  if (ruta.total_pasajeros > 0) {
    mostrarBloqueo(ruta);
    return;
  }

  const confirmar = window.confirm(
    `¿Deshabilitar la Ruta ${ruta.ruta}? Dejará de aparecer en asignaciones, pero podrás habilitarla después.`
  );
  if (!confirmar) return;

  procesandoId.value = ruta.id;
  error.value = null;
  mensaje.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/rutas/${encodeURIComponent(ruta.id)}`, {
      method: 'DELETE',
      headers: await obtenerHeaders(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (Array.isArray(payload?.empleados_a_reasignar) && payload.empleados_a_reasignar.length) {
        rutaSeleccionada.value = {
          ...ruta,
          empleados_a_reasignar: payload.empleados_a_reasignar,
          total_pasajeros: payload.empleados_a_reasignar.length,
        };
        modalBloqueoAbierto.value = true;
      }

      throw new Error(payload?.message || 'No se pudo deshabilitar la ruta.');
    }

    mensaje.value = payload?.message || 'Ruta deshabilitada correctamente.';
    await cargarRutas();
  } catch (err: unknown) {
    if (!modalBloqueoAbierto.value) {
      error.value = err instanceof Error ? err.message : 'Error deshabilitando la ruta.';
    } else {
      error.value = err instanceof Error ? err.message : 'La ruta tiene pasajeros pendientes de reasignar.';
    }
  } finally {
    procesandoId.value = null;
  }
}

async function habilitarRuta(ruta: RutaEliminacion) {
  const confirmar = window.confirm(`¿Habilitar nuevamente la Ruta ${ruta.ruta}?`);
  if (!confirmar) return;

  procesandoId.value = ruta.id;
  error.value = null;
  mensaje.value = null;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/rutas/${encodeURIComponent(ruta.id)}/restaurar`,
      {
        method: 'POST',
        headers: await obtenerHeaders(),
      },
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudo habilitar la ruta.');
    }

    mensaje.value = payload?.message || 'Ruta habilitada correctamente.';
    await cargarRutas();
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Error habilitando la ruta.';
  } finally {
    procesandoId.value = null;
  }
}

watch([fechaOperacion, turnoOperacion], async () => {
  if (!rutas.value.length) return;
  await cargarProgramacionOperativa();
});

onMounted(() => {
  cargarRutas();
});
</script>

<style scoped>
.crud-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.crud-filter-btn {
  border: 1px solid var(--ilpea-gray-200, #e5e7eb);
  background: #fff;
  color: #4b5563;
  border-radius: 999px;
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  cursor: pointer;
}

.crud-filter-btn.active {
  background: #111827;
  border-color: #111827;
  color: #fff;
}

.crud-operacion-filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}

.crud-field-inline {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
}

.crud-input-inline {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  font-size: 0.85rem;
  min-width: 150px;
}

.bloqueo-modal,
.unidad-modal {
  width: min(760px, 95vw);
}

.bloqueo-intro,
.unidad-intro {
  margin: 0 0 1rem;
  line-height: 1.5;
}

.bloqueo-tabla {
  max-height: 320px;
  margin-bottom: 1rem;
}

.unidad-modal label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: #334155;
}

.unidad-modal input,
.unidad-modal select,
.unidad-modal textarea {
  font-weight: 400;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
}
</style>
