<template>
  <div class="admin-layout">
    <AdminSidebar />

    <main class="main-content">
      <header class="content-header">
        <div class="header-flex">
          <div>
            <h2>Estado Operativo de Red</h2>
            <p>Aforo mínimo para justificar ruta: <strong>40%</strong></p>
            <p class="fuente-datos">
              <span v-if="filtroPeriodo === 'dia'" class="badge badge-live">Datos operativos — {{ filtroDia }}</span>
              <span v-else-if="filtroPeriodo === 'semana'" class="badge badge-live">Semana {{ filtroSemana }} — programación diaria</span>
              <span v-else class="badge badge-ref">Referencia histórica (catálogo Excel)</span>
            </p>
          </div>
          <div class="button-group">
            <button
              type="button"
              @click="exportarTablaExcel"
              :disabled="cargando || exportandoExcel || !!error"
              class="btn-exportar excel-btn btn-with-icon"
            >
              <AppIcon v-if="exportandoExcel" name="loader-2" :size="16" spin />
              <AppIcon v-else name="file-spreadsheet" :size="16" />
              <span>{{ exportandoExcel ? 'Exportando...' : 'Exportar programación' }}</span>
            </button>

            <button
              type="button"
              @click="exportarAsignacionesExcel"
              :disabled="cargando || exportandoAsignaciones || !!error"
              class="btn-exportar assignments-btn btn-with-icon"
            >
              <AppIcon v-if="exportandoAsignaciones" name="loader-2" :size="16" spin />
              <AppIcon v-else name="clipboard-list" :size="16" />
              <span>{{ exportandoAsignaciones ? 'Exportando...' : 'Exportar asignaciones' }}</span>
            </button>
          </div>
        </div>
      </header>

      <div v-if="error" class="status-box error-msg">
        <p class="ui-alert ui-alert--error">
          <AppIcon name="alert-triangle" :size="18" />
          <span>{{ error }}</span>
        </p>
        <button @click="recargarRutasSegunFiltro" class="btn-retry">Reintentar</button>
      </div>
      <div v-else class="dashboard-visuals">
        <div v-if="cargando" class="status-box">Cargando rutas...</div>
        <div class="charts-filter">
          <label for="chart-select">Visualización:</label>
          <select id="chart-select" v-model="selectedChart" class="minimal-select">
            <option value="todos">Todos los indicadores</option>
            <option value="ocupacion">Ocupación por Ruta</option>
            <option value="capacidad">Distribución de Capacidad</option>
            <option value="alertas">Estado de Alertas</option>
          </select>
        </div>

        <section class="filters-card">
          <div class="filters-header">
            <h3 class="section-title">Filtros de Rutas</h3>
            <button class="btn-manage" @click="limpiarFiltros">Limpiar</button>
          </div>

          <div class="filters-grid">
            <div class="filter-item">
              <label for="periodo-select">Periodo</label>
              <select id="periodo-select" v-model="filtroPeriodo" class="minimal-select">
                <option value="todos">Todos</option>
                <option value="dia">Por día</option>
                <option value="semana">Por semana</option>
              </select>
            </div>

            <div class="filter-item" v-if="filtroPeriodo === 'dia'">
              <label for="filtro-dia">Día</label>
              <input id="filtro-dia" v-model="filtroDia" type="date" class="minimal-select" />
            </div>

            <div class="filter-item" v-if="filtroPeriodo === 'semana'">
              <label for="filtro-semana">Semana</label>
              <input
                id="filtro-semana"
                v-model.number="filtroSemana"
                type="number"
                min="1"
                max="53"
                class="minimal-select"
              />
            </div>

            <div class="filter-item">
              <label for="filtro-ruta">Ruta</label>
              <AppAutocomplete
                input-id="filtro-ruta"
                v-model="filtroRutaTexto"
                mode="filter"
                variant="field"
                :options="opcionesRutasBusqueda"
                placeholder="Buscar ruta por número o zona..."
              />
            </div>

            <div class="filter-item">
              <label for="ocupacion-select">Ocupación</label>
              <select id="ocupacion-select" v-model="filtroOcupacion" class="minimal-select">
                <option value="todas">Todas</option>
                <option value="baja">Baja (&lt; 40%)</option>
                <option value="media">Media (40% a 79.9%)</option>
                <option value="alta">Alta (&gt;= 80%)</option>
              </select>
            </div>
          </div>

          <p class="filters-info">Mostrando {{ rutasFiltradas.length }} de {{ rutas.length }} rutas.</p>
        </section>

        <div class="charts-grid">
          <div v-show="selectedChart === 'todos' || selectedChart === 'ocupacion'" class="chart-item" id="chart-ocupacion">
            <ChartOcupacion :rutas="rutasOperativas" />
          </div>
          <div v-show="selectedChart === 'todos' || selectedChart === 'capacidad'" class="chart-item" id="chart-capacidad">
            <ChartCapacidad :rutas="rutasOperativas" />
          </div>
          <div v-show="selectedChart === 'todos' || selectedChart === 'alertas'" class="chart-item chart-item-small" id="chart-alertas">
            <ChartAlertas :rutas="rutasOperativas" />
          </div>
        </div>

        <section class="ia-block">
          <div class="section-header-inline">
            <h3 class="section-title">Recomendaciones</h3>
            <div class="btn-ia-wrapper">
              <button
                type="button"
                class="btn-ia-cargar"
                :class="{ 'is-loading': cargandoInsights }"
                @click="activarInsights"
                :disabled="cargandoInsights || mostrarInsights"
              >
                <svg class="btn-ia-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                  ></path>
                </svg>
                <span class="btn-ia-txt">
                  <span
                    v-for="(letra, idx) in btnIaLetras"
                    :key="idx"
                    class="btn-ia-letter"
                    :style="{ animationDelay: (idx * 0.06) + 's' }"
                  >{{ letra === ' ' ? ' ' : letra }}</span>
                </span>
              </button>
            </div>
          </div>
          <div v-if="mostrarInsights" class="ia-block-content">
            <RecomendacionesIA
              :rutas="rutasPlanOptions"
              :fecha-operacion="fechaOperacion"
              @cargando-change="onInsightsCargandoChange"
              @plan-ejecutado="onPlanActualizado"
              @feedback-registrado="onPlanActualizado"
            />
          </div>
          <p v-else class="ui-empty ia-block-empty">Pulse «Cargar» para ver recomendaciones.</p>
        </section>

        <div id="tabla-rutas-reporte" class="pdf-wrapper">
          <h3 class="section-title">Detalle Operativo de Rutas</h3>
          <div class="table-card">
            <table class="minimal-table">
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Unidad</th>
                  <th>Capacidad</th>
                  <th>Ocupación %</th>
                  <th>Estado</th>
                  <th class="no-print">Acción</th> 
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="ruta in rutasFiltradas"
                  :key="ruta.id || ruta.ruta"
                  :class="{
                    'row-alert': rutaTieneDatosOperativos(ruta) && !rutaEstaCancelada(ruta) && ruta.porcentaje_ocupacion_max < 40,
                    'row-cancelled': rutaEstaCancelada(ruta)
                  }"
                >
                  <td><strong>Ruta {{ ruta.ruta }}</strong></td>
                  <td>{{ tipoUnidadRuta(ruta) }}</td>
                  <td>{{ capacidadOperativa(ruta) }} asientos</td>
                  <td>
                    <div class="occupancy-cell">
                      <div class="bar-bg">
                        <div class="bar-fill" 
                             :style="{ width: Math.min(obtenerOcupacionSegura(ruta), 100) + '%' }"
                             :class="obtenerOcupacionSegura(ruta) < 40 ? 'low' : 'ok'">
                        </div>
                      </div>
                      <span>{{ formatearOcupacion(ruta) }}%</span>
                    </div>
                  </td>
                  <td>
                    <span :class="['tag', rutaEstaCancelada(ruta) ? 'tag-cancelled' : (!rutaTieneDatosOperativos(ruta) ? 'tag-pending' : (ruta.porcentaje_ocupacion_max < 40 ? 'tag-alert' : 'tag-ok'))]">
                      {{ rutaEstaCancelada(ruta) ? 'CANCELADA' : (!rutaTieneDatosOperativos(ruta) ? 'SIN PROGRAMACIÓN' : (ruta.porcentaje_ocupacion_max < 40 ? 'BAJA OCUPACIÓN' : 'ÓPTIMO')) }}
                    </span>
                  </td>
                  <td class="no-print">
                    <div v-if="!rutaEstaCancelada(ruta)" class="crud-actions ruta-acciones">
                      <button
                        type="button"
                        class="crud-action-btn crud-action-btn--edit"
                        :disabled="procesandoRutaId === ruta.id"
                        @click="abrirModalUnidad(ruta)"
                      >
                        <AppIcon name="truck" :size="13" />
                        Asignar unidad
                      </button>
                      <button
                        type="button"
                        class="crud-action-btn crud-action-btn--delete"
                        :disabled="procesandoRutaId === ruta.id"
                        @click="intentarDeshabilitarRuta(ruta)"
                      >
                        <AppIcon name="trash-2" :size="13" />
                        Deshabilitar
                      </button>
                    </div>
                    <span v-else class="ui-muted">—</span>
                  </td>
                </tr>
                <tr v-if="!rutasFiltradas.length">
                  <td colspan="6" class="empty-row">No hay rutas que coincidan con los filtros seleccionados.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <Teleport to="body">
      <div v-if="modalUnidadVisible && rutaUnidadSeleccionada" class="crud-modal-overlay" @click.self="cerrarModalUnidad">
        <form class="crud-modal unidad-modal" @submit.prevent="guardarUnidad">
          <h3>Asignar unidad operativa</h3>
          <p class="ui-muted unidad-intro">
            Ruta <strong>{{ rutaUnidadSeleccionada.ruta }}</strong> —
            {{ rutaUnidadSeleccionada.zona || 'Sin zona' }}
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

      <div v-if="modalBloqueoVisible && rutaBloqueoSeleccionada" class="crud-modal-overlay" @click.self="cerrarModalBloqueo">
        <div class="crud-modal bloqueo-modal">
          <h3>No se puede deshabilitar esta ruta</h3>
          <p class="ui-muted bloqueo-intro">
            La ruta <strong>Ruta {{ rutaBloqueoSeleccionada.ruta }}</strong> tiene pasajeros asignados.
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
                  v-for="empleado in rutaBloqueoSeleccionada.empleados_a_reasignar"
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
    </Teleport>

    <CopilotoChat scope="ADMIN" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { saveAs } from 'file-saver';

import AdminSidebar from '../components/layout/AdminSidebar.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import RecomendacionesIA from '../components/RecomendacionesIA.vue';
import ChartOcupacion from '../components/ChartOcupacion.vue';
import ChartCapacidad from '../components/ChartCapacidad.vue';
import ChartAlertas from '../components/ChartAlertas.vue';
import CopilotoChat from '../components/CopilotoChat.vue';
import AppAutocomplete, { type AutocompleteOption } from '../components/ui/AppAutocomplete.vue';
import { coincideBusqueda } from '../utils/busqueda';
import {
  capacidadPorTipoUnidad,
  useProgramacionUnidad,
} from '../composables/useProgramacionUnidad';

// --- INTERFACES ---
interface Ruta {
  id: string;
  ruta: number;
  zona?: string;
  "tipo de unidad": string;
  tipo_unidad?: string | null;
  codigo_unidad?: string | null;
  capacidad_real: number;
  capacidad_limite?: number;
  asientos_ocupados?: number;
  asientos_disponibles?: number;
  pasajeros_ids?: string[];
  max_pasajeros_dia: number;
  porcentaje_ocupacion_max: number;
  alerta_ocupacion: string;
  sugerencia_right_sizing: string;
  fecha_operacion: string | null;
  semana_operacion: number | null;
  programada?: boolean;
  programacion_id?: string;
  turno_programado?: string | null;
  estado?: string;
  estado_programacion?: string;
  cancelada?: boolean;
  motivo_cancelacion?: string | null;
  fuente_datos?: string;
  ocupacion_pct?: number;
}

interface EmpleadoReasignar {
  id_empleado: string;
  nombre: string;
  email?: string | null;
  fecha: string;
  turno?: string | null;
  asiento?: number | null;
}

interface RutaBloqueo extends Ruta {
  empleados_a_reasignar: EmpleadoReasignar[];
}
interface UsuarioAsignado {
  num_control: string;
  nombre: string;
  puesto: string;
  dpto: string;
  turno: string;
  empresa: string;
  horario_entrada: string;
  horario_salida: string;
  dias_trabajo: string;
  domicilio: string;
  colonia: string;
  referencia: string;
  ruta_asignada: string; // Columna M en la imagen
  parada_asignada: string;
  estatus: string;
}

type RutaApi = Partial<Ruta> & Record<string, unknown>;

const TURNOS = [
  { value: 'mixto_1', label: 'Mixto 1' },
  { value: 'mixto_2', label: 'Mixto 2' },
  { value: 'sab_3', label: 'Sábado 3er' },
  { value: 'dom_1', label: 'Domingo 1er' },
  { value: 'dom_2', label: 'Domingo 2do' },
  { value: 'dom_3', label: 'Domingo 3er' },
];

const turnosDisponibles = TURNOS;
const router = useRouter();
const { cambiarUnidadProgramacion } = useProgramacionUnidad();

// --- ESTADOS REACtivos ---
const rutas = ref<Ruta[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const selectedChart = ref<string>('todos');
const mostrarInsights = ref(false);
const cargandoInsights = ref(false);
const btnIaLabel = computed(() => (
  cargandoInsights.value ? 'Cargando...' : (mostrarInsights.value ? 'Cargadas' : 'Cargar')
));
const btnIaLetras = computed(() => btnIaLabel.value.split(''));
const filtroPeriodo = ref<'todos' | 'dia' | 'semana'>('dia');
const filtroDia = ref(new Date().toISOString().slice(0, 10));
const filtroSemana = ref<number>(1);
const filtroOcupacion = ref<'todas' | 'baja' | 'media' | 'alta'>('todas');
const filtroRutaTexto = ref('');
const procesandoRutaId = ref<string | null>(null);
const modalUnidadVisible = ref(false);
const modalBloqueoVisible = ref(false);
const rutaUnidadSeleccionada = ref<Ruta | null>(null);
const rutaBloqueoSeleccionada = ref<RutaBloqueo | null>(null);
const guardandoUnidad = ref(false);
const errorModalUnidad = ref<string | null>(null);
const formUnidad = ref({
  fecha: '',
  turno: '',
  tipoPreset: 'Van',
  tipoUnidad: 'Van',
  capacidadLimite: 12,
  codigoUnidad: '',
  motivo: 'Asignación manual de unidad operativa.',
});

const opcionesRutasBusqueda = computed<AutocompleteOption[]>(() =>
  rutas.value.map((ruta) => ({
    value: String(ruta.ruta),
    label: `Ruta ${ruta.ruta}${ruta.zona ? ` — ${ruta.zona}` : ''}`,
    hint: ruta['tipo de unidad'],
    keywords: `ruta ${ruta.ruta} ${ruta.zona || ''} ${ruta.id}`,
  })),
);

const rutasPlanOptions = computed(() =>
  rutas.value.map((ruta) => ({
    id: ruta.id,
    ruta: ruta.ruta,
    label: ruta.zona ? `Ruta ${ruta.ruta} - ${ruta.zona}` : `Ruta ${ruta.ruta}`,
    tipo_unidad: tipoUnidadRuta(ruta),
    capacidad_limite: capacidadOperativa(ruta),
    capacidad_real: ruta.capacidad_real,
    asientos_ocupados: ruta.asientos_ocupados || 0,
    codigo_unidad: ruta.codigo_unidad || null
  }))
);

const fechaOperacion = computed(() => {
  if (filtroPeriodo.value === 'dia') return filtroDia.value;
  if (filtroPeriodo.value === 'semana') return new Date().toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
});

const anioOperacion = computed(() => new Date(filtroDia.value).getFullYear());

const cantidadPasajerosRuta = (ruta: Ruta | null) => {
  if (!ruta) return 0;
  if (Array.isArray(ruta.pasajeros_ids)) return ruta.pasajeros_ids.length;
  return numeroSeguro(ruta.asientos_ocupados, 0);
};

const pasajerosActualesUnidad = computed(() => cantidadPasajerosRuta(rutaUnidadSeleccionada.value));

// Estados de carga específicos para las exportaciones
const exportandoExcel = ref(false);
const exportandoAsignaciones = ref(false); // Estado para el segundo botón

// --- UTILIDADES ---
const numeroSeguro = (valor: unknown, fallback = 0): number => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
};

const obtenerNumeroSemana = (fecha: Date): number => {
  const fechaUTC = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = fechaUTC.getUTCDay() || 7;
  fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));
  return Math.ceil((((fechaUTC.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
};

const normalizarFechaISO = (valor: unknown): string | null => {
  if (!valor) return null;
  const fecha = new Date(String(valor));
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
};

filtroSemana.value = obtenerNumeroSemana(new Date());

const normalizarRuta = (ruta: RutaApi): Ruta => {
  const capacidadLimite = numeroSeguro(ruta.capacidad_limite, 0);
  const asientosOcupados = numeroSeguro(ruta.asientos_ocupados, 0);
  const capacidadOperativaRuta = capacidadLimite > 0 ? capacidadLimite : numeroSeguro(ruta.capacidad_real, 0);
  const estadoProgramacion = String(ruta.estado_programacion ?? ruta.estado ?? 'activa').toLowerCase();
  const tipoUnidad = String(ruta.tipo_unidad ?? ruta['tipo de unidad'] ?? 'N/D');

  const ocupacionBackend = numeroSeguro(ruta.ocupacion_pct, -1);
  const ocupacionCalculada = ocupacionBackend >= 0
    ? ocupacionBackend
    : capacidadLimite > 0
      ? (asientosOcupados / capacidadLimite) * 100
      : numeroSeguro(ruta.porcentaje_ocupacion_max, 0);

  const maxPasajerosOperativo = capacidadLimite > 0 || asientosOcupados > 0
    ? asientosOcupados
    : numeroSeguro(ruta.max_pasajeros_dia, 0);

  return {
  id: String(ruta.id ?? ''),
  ruta: numeroSeguro(ruta.ruta, 0),
  zona: ruta.zona ? String(ruta.zona) : undefined,
  'tipo de unidad': tipoUnidad,
  tipo_unidad: tipoUnidad,
  codigo_unidad: ruta.codigo_unidad ? String(ruta.codigo_unidad) : null,
  capacidad_real: capacidadOperativaRuta,
  capacidad_limite: capacidadLimite > 0 ? capacidadLimite : undefined,
  asientos_ocupados: capacidadLimite > 0 ? asientosOcupados : undefined,
  asientos_disponibles: numeroSeguro(ruta.asientos_disponibles, Math.max(capacidadOperativaRuta - asientosOcupados, 0)),
  pasajeros_ids: Array.isArray(ruta.pasajeros_ids) ? ruta.pasajeros_ids.map((id) => String(id)) : [],
  max_pasajeros_dia: maxPasajerosOperativo,
  porcentaje_ocupacion_max: ocupacionCalculada,
  ocupacion_pct: ocupacionCalculada,
  fuente_datos: ruta.fuente_datos ? String(ruta.fuente_datos) : undefined,
  alerta_ocupacion: String(ruta.alerta_ocupacion ?? 'N/D'),
  sugerencia_right_sizing: String(ruta.sugerencia_right_sizing ?? 'Sin sugerencia'),
  fecha_operacion: normalizarFechaISO(ruta.fecha_operacion ?? ruta.fecha ?? ruta.dia),
  semana_operacion: numeroSeguro(ruta.semana_operacion ?? ruta.semana ?? ruta.week, 0) || null,
  programada: typeof ruta.programada === 'boolean' ? ruta.programada : undefined,
  programacion_id: ruta.programacion_id ? String(ruta.programacion_id) : undefined,
  turno_programado: ruta.turno_programado ? String(ruta.turno_programado) : null,
  estado: estadoProgramacion,
  estado_programacion: estadoProgramacion,
  cancelada: ruta.cancelada === true || estadoProgramacion === 'cancelada',
  motivo_cancelacion: ruta.motivo_cancelacion ? String(ruta.motivo_cancelacion) : null
  };
};

const obtenerOcupacionSegura = (ruta: Ruta): number => numeroSeguro(ruta.porcentaje_ocupacion_max, 0);
const formatearOcupacion = (ruta: Ruta): string => obtenerOcupacionSegura(ruta).toFixed(1);
const capacidadOperativa = (ruta: Ruta): number => numeroSeguro(ruta.capacidad_limite, ruta.capacidad_real || 0);
const tipoUnidadRuta = (ruta: Ruta): string => String(ruta.tipo_unidad || ruta['tipo de unidad'] || 'N/D');
const rutaEstaCancelada = (ruta: Ruta): boolean => ruta.cancelada === true || ruta.estado_programacion === 'cancelada' || ruta.estado === 'cancelada';

const rutaTieneDatosOperativos = (ruta: Ruta): boolean =>
  ruta.programada === true || numeroSeguro(ruta.asientos_ocupados, 0) > 0;

const obtenerEstadoOperativo = (ruta: Ruta): string => {
  if (rutaEstaCancelada(ruta)) return 'CANCELADA';
  if (!rutaTieneDatosOperativos(ruta)) return 'SIN PROGRAMACIÓN';
  return obtenerOcupacionSegura(ruta) < 40 ? 'CRÍTICO (< 40%)' : 'ÓPTIMO';
};

const obtenerRecomendacionOperativa = (ruta: Ruta): string => {
  if (rutaEstaCancelada(ruta)) return 'RUTA CANCELADA';
  if (!rutaTieneDatosOperativos(ruta)) return 'SIN DATOS DEL DÍA';

  const ocupacion = obtenerOcupacionSegura(ruta);
  if (ocupacion >= 40) return 'MANTENER';

  const sugerencia = String(ruta.sugerencia_right_sizing || '').toUpperCase();
  if (sugerencia.includes('CAMBIAR')) return 'CAMBIAR UNIDAD';
  if (sugerencia.includes('CANCELAR') || String(ruta.alerta_ocupacion || '').includes('CANCELAR')) {
    return 'EVALUAR CANCELACIÓN';
  }

  return 'REVISAR AFORO';
};

const rutasOperativas = computed(() => {
  if (filtroPeriodo.value === 'todos') {
    return rutasFiltradas.value;
  }

  return rutasFiltradas.value.filter((ruta) => rutaTieneDatosOperativos(ruta));
});

const rutasFiltradas = computed(() => {
  return rutas.value.filter((ruta) => {
    const terminoRuta = filtroRutaTexto.value;
    if (terminoRuta.trim() && !coincideBusqueda(terminoRuta, 'ruta', ruta.ruta, ruta.zona, ruta.id, ruta['tipo de unidad'])) {
      return false;
    }

    const ocupacion = obtenerOcupacionSegura(ruta);

    const cumpleOcupacion =
      filtroOcupacion.value === 'todas' ||
      (filtroOcupacion.value === 'baja' && ocupacion < 40) ||
      (filtroOcupacion.value === 'media' && ocupacion >= 40 && ocupacion < 80) ||
      (filtroOcupacion.value === 'alta' && ocupacion >= 80);

    if (!cumpleOcupacion) return false;

    if (filtroPeriodo.value === 'dia') {
      return true;
    }

    if (filtroPeriodo.value === 'semana') {
      return true;
    }

    return true;
  });
});

const limpiarFiltros = () => {
  filtroPeriodo.value = 'dia';
  filtroOcupacion.value = 'todas';
  filtroRutaTexto.value = '';
  filtroDia.value = new Date().toISOString().slice(0, 10);
  filtroSemana.value = obtenerNumeroSemana(new Date());
};

// --- MÉTODOS API (Frente 2) ---
const obtenerRutas = async () => {
  cargando.value = true;
  error.value = null;

  try {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/rutas`, { headers });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const json = await respuesta.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    rutas.value = data
      .map((ruta: RutaApi) => normalizarRuta(ruta))
      .sort((a: Ruta, b: Ruta) => a.ruta - b.ruta);
  } catch (err: any) {
    error.value = err.message || 'Error al cargar rutas.';
  } finally {
    cargando.value = false;
  }
};

const obtenerRutasProgramadasPorDia = async (fecha: string) => {
  cargando.value = true;
  error.value = null;

  try {
    const headers = await authHeaders();
    const params = new URLSearchParams({ fecha });
    const respuesta = await fetch(`${API_BASE_URL}/api/rutas/programadas?${params.toString()}`, { headers });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const json = await respuesta.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    rutas.value = data
      .map((ruta: RutaApi) => normalizarRuta(ruta))
      .sort((a: Ruta, b: Ruta) => a.ruta - b.ruta);
  } catch (err: any) {
    error.value = err.message || 'Error al cargar rutas programadas por día.';
  } finally {
    cargando.value = false;
  }
};

const obtenerRutasProgramadasPorSemana = async (semana: number) => {
  cargando.value = true;
  error.value = null;

  try {
    const headers = await authHeaders();
    const params = new URLSearchParams({
      semana: String(semana),
      anio: String(anioOperacion.value)
    });
    const respuesta = await fetch(`${API_BASE_URL}/api/rutas/programadas/rango?${params.toString()}`, { headers });
    if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
    const json = await respuesta.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    rutas.value = data
      .map((ruta: RutaApi) => normalizarRuta(ruta))
      .sort((a: Ruta, b: Ruta) => a.ruta - b.ruta);
  } catch (err: any) {
    error.value = err.message || 'Error al cargar rutas programadas por semana.';
  } finally {
    cargando.value = false;
  }
};

const recargarRutasSegunFiltro = async () => {
  if (filtroPeriodo.value === 'dia') {
    await obtenerRutasProgramadasPorDia(filtroDia.value);
    return;
  }

  if (filtroPeriodo.value === 'semana') {
    await obtenerRutasProgramadasPorSemana(filtroSemana.value);
    return;
  }

  await obtenerRutas();
};

watch(
  () => [filtroPeriodo.value, filtroDia.value, filtroSemana.value],
  async ([periodoActual], [periodoAnterior]) => {
    if (periodoActual === 'dia') {
      await obtenerRutasProgramadasPorDia(filtroDia.value);
      return;
    }

    if (periodoActual === 'semana') {
      await obtenerRutasProgramadasPorSemana(filtroSemana.value);
      return;
    }

    if (periodoAnterior === 'dia' || periodoAnterior === 'semana') {
      await obtenerRutas();
    }
  }
);

const onPlanActualizado = async () => {
  await recargarRutasSegunFiltro();
};

const abrirModalUnidad = (ruta: Ruta) => {
  rutaUnidadSeleccionada.value = ruta;
  const tipoInicial = tipoUnidadRuta(ruta);
  const preset = ['Van', 'Sprinter', 'Autobús', 'Camión'].includes(tipoInicial) ? tipoInicial : 'Otro';

  formUnidad.value = {
    fecha: fechaOperacion.value,
    turno: ruta.turno_programado || '',
    tipoPreset: preset,
    tipoUnidad: tipoInicial,
    capacidadLimite: ruta.capacidad_limite || capacidadPorTipoUnidad(tipoInicial) || capacidadOperativa(ruta),
    codigoUnidad: ruta.codigo_unidad || '',
    motivo: ruta.porcentaje_ocupacion_max < 40
      ? 'Ajuste operativo por bajo aforo.'
      : 'Asignación manual de unidad operativa.',
  };

  if (formUnidad.value.capacidadLimite < pasajerosActualesUnidad.value) {
    formUnidad.value.capacidadLimite = Math.max(pasajerosActualesUnidad.value, formUnidad.value.capacidadLimite);
  }

  errorModalUnidad.value = null;
  modalUnidadVisible.value = true;
};

const cerrarModalUnidad = () => {
  if (guardandoUnidad.value) return;
  modalUnidadVisible.value = false;
  rutaUnidadSeleccionada.value = null;
  errorModalUnidad.value = null;
};

const resolverTipoUnidadFormulario = () =>
  formUnidad.value.tipoPreset === 'Otro'
    ? formUnidad.value.tipoUnidad
    : formUnidad.value.tipoPreset;

const aplicarPresetCapacidad = () => {
  const tipo = resolverTipoUnidadFormulario();
  formUnidad.value.tipoUnidad = tipo;
  const minima = Math.max(pasajerosActualesUnidad.value, capacidadPorTipoUnidad(tipo));
  formUnidad.value.capacidadLimite = minima;
};

const guardarUnidad = async () => {
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
  procesandoRutaId.value = ruta.id;
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

    cerrarModalUnidad();
    await recargarRutasSegunFiltro();
  } catch (err: unknown) {
    errorModalUnidad.value = err instanceof Error ? err.message : 'No se pudo asignar la unidad.';
  } finally {
    guardandoUnidad.value = false;
    procesandoRutaId.value = null;
  }
};

const intentarDeshabilitarRuta = async (ruta: Ruta) => {
  const confirmar = window.confirm(
    `¿Deshabilitar la Ruta ${ruta.ruta}? Dejará de aparecer en asignaciones, pero podrás habilitarla después.`
  );
  if (!confirmar) return;

  procesandoRutaId.value = ruta.id;

  try {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/rutas/${encodeURIComponent(ruta.id)}`, {
      method: 'DELETE',
      headers,
    });

    const payload = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      if (Array.isArray(payload?.empleados_a_reasignar) && payload.empleados_a_reasignar.length) {
        rutaBloqueoSeleccionada.value = {
          ...ruta,
          empleados_a_reasignar: payload.empleados_a_reasignar,
        };
        modalBloqueoVisible.value = true;
      }
      throw new Error(payload?.message || 'No se pudo deshabilitar la ruta.');
    }

    await recargarRutasSegunFiltro();
  } catch (err: unknown) {
    if (!modalBloqueoVisible.value) {
      alert(err instanceof Error ? err.message : 'Error deshabilitando la ruta.');
    }
  } finally {
    procesandoRutaId.value = null;
  }
};

const cerrarModalBloqueo = () => {
  modalBloqueoVisible.value = false;
  rutaBloqueoSeleccionada.value = null;
};

const irAAsignaciones = () => {
  cerrarModalBloqueo();
  router.push('/admin/asignaciones');
};

const activarInsights = () => {
  if (mostrarInsights.value || cargandoInsights.value) {
    return;
  }

  cargandoInsights.value = true;
  mostrarInsights.value = true;
};

const onInsightsCargandoChange = (cargando: boolean) => {
  cargandoInsights.value = cargando;
};

// --- EXPORTACIONES (ExcelJS) ---

// Función 1: Exportar Programación Operativa (Rutas)
const exportarTablaExcel = async () => {
  exportandoExcel.value = true;
  try {
    const rutasExportar = rutasOperativas.value;
    if (!rutasExportar.length) {
      alert('No hay rutas con programación operativa para exportar en el periodo seleccionado.');
      exportandoExcel.value = false;
      return;
    }

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Programación de Rutas');

    // Definir anchos y llaves de columnas SIN la propiedad "header"
    // para evitar que ExcelJS sobrescriba la Fila 1 automáticamente
    worksheet.columns = [
      { key: 'ruta', width: 15 },
      { key: 'tipo_unidad', width: 18 },
      { key: 'cap_real', width: 12 },
      { key: 'ocupacion', width: 15 },
      { key: 'estado', width: 20 },
      { key: 'recomendacion', width: 25 }
    ];

    // Estilos Corporativos (Encabezado Negro en Fila 1)
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'ILPEA - PROGRAMACIÓN DE RUTAS'; 
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // Encabezados Reales en la Fila 2 (Verde)
    const headerRow = worksheet.getRow(2);
    headerRow.values = ['RUTA', 'TIPO UNIDAD', 'CAP. REAL', '% OCUPACIÓN', 'ESTADO', 'RECOMENDACIÓN SISTEMA'];
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF107C41' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    headerRow.height = 25;

    // Datos
    rutasExportar.forEach(ruta => {
      const ocupacion = obtenerOcupacionSegura(ruta);
      const estado = obtenerEstadoOperativo(ruta);
      const recomendacion = obtenerRecomendacionOperativa(ruta);

      const row = worksheet.addRow({
        ruta: `Ruta ${ruta.ruta}`,
        tipo_unidad: tipoUnidadRuta(ruta),
        cap_real: capacidadOperativa(ruta),
        ocupacion: `${ocupacion.toFixed(1)}%`,
        estado: estado,
        recomendacion: recomendacion
      });

      // Estilo base para las filas de datos (alineación centrada)
      row.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: {style:'thin', color: {argb: 'FFEEEEEE'}} };
      });

      // Resaltado ROJO si está en estado crítico
      if (rutaEstaCancelada(ruta)) {
        row.eachCell((cell) => {
          cell.font = { color: { argb: 'FF475569' }, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });
      } else if (rutaTieneDatosOperativos(ruta) && ocupacion < 40) {
        row.eachCell((cell) => {
          cell.font = { color: { argb: 'FFFF0000' }, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Programacion_Rutas_ILPEA_${fechaOperacion.value}.xlsx`);
  } catch (error) {
    console.error(error);
    alert('Error al exportar rutas.');
  } finally {
    exportandoExcel.value = false;
  }
};

// --- NUEVA FUNCIÓN: Catálogo de Asignaciones (Basado en imagen image_e0da00.png) ---
const exportarAsignacionesExcel = async () => {
  exportandoAsignaciones.value = true;
  
  try {
    const { default: ExcelJS } = await import('exceljs');
    // 1. Consultar datos al Backend (Asumiendo endpoint en Frente 2/OCI)
    const headers = await authHeaders();
    // NOTA OPERATIVA: Asegúrate de tener este endpoint '/api/usuarios-asignados' configurado en tu backend
    const params = new URLSearchParams({ fecha: fechaOperacion.value });
    const respuesta = await fetch(`${API_BASE_URL}/api/usuarios-asignados?${params.toString()}`, { headers });
    
    if (!respuesta.ok) throw new Error('No se pudieron obtener los datos de asignaciones.');
    
    const json = await respuesta.json();
    const asignacionesCrudas: any[] = Array.isArray(json?.data) ? json.data : [];

    // Normalización/Blindaje de datos de asignación
    const asignaciones: UsuarioAsignado[] = asignacionesCrudas.map(asig => ({
      num_control: asig.num_control || 'S/N',
      nombre: asig.nombre || 'Desconocido',
      puesto: asig.puesto || '',
      dpto: asig.dpto || '',
      turno: asig.turno || '',
      empresa: asig.empresa || 'ILPEA',
      horario_entrada: asig.horario_entrada || '',
      horario_salida: asig.horario_salida || '',
      dias_trabajo: asig.dias_trabajo || '',
      domicilio: asig.domicilio || '',
      colonia: asig.colonia || '',
      referencia: asig.referencia || '',
      ruta_asignada: asig.ruta_asignada ? `Ruta ${asig.ruta_asignada}` : 'SIN RUTA',
      parada_asignada: asig.parada_asignada || 'S/P',
      estatus: asig.estatus || 'REGISTRADO'
    }));

    const asignacionesExportar = filtroPeriodo.value === 'todos'
      ? asignaciones
      : asignaciones.filter((asig) => asig.ruta_asignada !== 'SIN RUTA');

    if (!asignacionesExportar.length) {
      alert('No hay asignaciones registradas para la fecha seleccionada.');
      exportandoAsignaciones.value = false;
      return;
    }

    // 2. Configurar Workbook ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Asignaciones Personal');

    // 3. Encabezado Corporativo (Negro) - Abarca las 15 columnas
    worksheet.mergeCells('A1:O1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'ILPEA - CATÁLOGO DE ASIGNACIONES DE PERSONAL';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // 4. Definición exacta de Columnas (según imagen)
    worksheet.columns = [
      { header: 'NUM CONTROL', key: 'num_control', width: 15 },
      { header: 'NOMBRE', key: 'nombre', width: 35 },
      { header: 'PUESTO', key: 'puesto', width: 20 },
      { header: 'DPTO', key: 'dpto', width: 15 },
      { header: 'TURNO', key: 'turno', width: 12 },
      { header: 'EMPRESA', key: 'empresa', width: 12 },
      { header: 'HORARIO ENTRADA', key: 'horario_entrada', width: 18 },
      { header: 'HORARIO SALIDA', key: 'horario_salida', width: 18 },
      { header: 'DÍAS TRABAJO', key: 'dias_trabajo', width: 20 },
      { header: 'DOMICILIO', key: 'domicilio', width: 40 },
      { header: 'COLONIA', key: 'colonia', width: 25 },
      { header: 'REFERENCIA', key: 'referencia', width: 30 },
      { header: 'RUTA ASIGNADA', key: 'ruta_asignada', width: 18 },
      { header: 'PARADA ASIGNADA', key: 'parada_asignada', width: 30 },
      { header: 'ESTATUS', key: 'estatus', width: 15 }
    ];

    // 5. Estilo Encabezados de Columna (Verde)
    const headerRow = worksheet.getRow(2);
    // Asignamos valores manualmente para asegurar mayúsculas exactas de la imagen
    headerRow.values = [
      'NUM CONTROL', 'NOMBRE', 'PUESTO', 'DPTO', 'TURNO', 'EMPRESA', 
      'HORARIO ENTRADA', 'HORARIO SALIDA', 'DÍAS TRABAJO', 
      'DOMICILIO', 'COLONIA', 'REFERENCIA', 
      'RUTA ASIGNADA', 'PARADA ASIGNADA', 'ESTATUS'
    ];
    
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF107C41' } }; // Verde Excel
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    headerRow.height = 25;

    // 6. Agregar Datos con estilos básicos
    asignacionesExportar.forEach(asig => {
      const row = worksheet.addRow(asig);
      
      // Estilo por defecto para la fila de datos
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: {style:'thin', color: {argb: 'FFEEEEEE'}} };
      });

      // Alineación centrada para columnas específicas
      row.getCell('num_control').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('turno').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('empresa').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('horario_entrada').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('horario_salida').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('ruta_asignada').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('estatus').alignment = { horizontal: 'center', vertical: 'middle' };

      // --- RESALTADO CONDICIONAL (Clave de la imagen) ---
      // Si la RUTA ASIGNADA (Columna M) es "SIN RUTA", aplicamos texto rojo y fondo rosa pálido
      if (asig.ruta_asignada === 'SIN RUTA') {
         // Accedemos a la celda específica M (columna 13)
         row.getCell('ruta_asignada').font = { color: { argb: 'FFFF0000' }, bold: true }; // Rojo bold
         row.getCell('ruta_asignada').fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFEE2E2'} }; // Rosa suave alert
      }
    });

    // 7. Descargar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Catalogo_Asignaciones_ILPEA_${fechaOperacion.value}.xlsx`);

  } catch (error: any) {
    console.error('Error Catálogo Excel:', error);
    alert(`Ocurrió un error al generar el catálogo: ${error.message}`);
  } finally {
    exportandoAsignaciones.value = false;
  }
};

// --- CICLO DE VIDA ---
onMounted(() => {
  obtenerRutasProgramadasPorDia(filtroDia.value);
});
</script>

<style scoped>
/* Estilos existentes intactos */
.admin-layout { display: flex; min-height: 100vh; background: #f8f9fa; font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; }
.main-content { flex: 1; padding: 3rem; }
.header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
.content-header { margin-bottom: 2rem; }
.content-header h2 { margin: 0; font-size: 1.5rem; }
.content-header p { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }
.fuente-datos { margin-top: 0.35rem; }
.badge { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.badge-live { background: #dcfce7; color: #166534; }
.badge-ref { background: #e2e8f0; color: #475569; }

/* NUEVOS Estilos para el grupo de botones */
.button-group { display: flex; gap: 10px; align-items: center; }

.btn-exportar { background: #000; color: #fff; border: none; padding: 0.7rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem; transition: 0.3s; }
.btn-exportar:hover { background: #333; }
.btn-exportar:disabled { background: #888; cursor: not-allowed; opacity: 0.7; }

/* Estilo Verde Excel existente */
.excel-btn { background: #107c41; } 
.excel-btn:hover { background: #0c5e31; }

/* NUEVO Estilo para botón de asignaciones (Azul oscuro corporativo) */
.assignments-btn { background: #1e3a8a; } 
.assignments-btn:hover { background: #1e40af; }

/* Resto de estilos intactos... */
.charts-filter { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; font-size: 0.9rem; }
.minimal-select { padding: 0.5rem; border-radius: 6px; border: 1px solid #ddd; outline: none; background: #fff; }
.filters-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; }
.filters-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.9rem; margin-top: 0.8rem; }
.filter-item { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; color: #374151; }
.filters-info { margin: 0.8rem 0 0; font-size: 0.85rem; color: #6b7280; }
.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
.chart-item { background: #fff; padding: 1.5rem; border-radius: 12px; border: 1px solid #e0e0e0; min-height: 300px; }
.chart-item-small { grid-column: span 1; }
.section-title { font-size: 1.1rem; margin-bottom: 1rem; color: #333; }
.ia-block {
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0;
}

.section-header-inline .section-title {
  margin-bottom: 0;
}

.ia-block-content,
.ia-block-empty {
  margin: 0;
}

.ia-block-empty {
  padding: 1.5rem 1rem;
}

.pdf-wrapper { background-color: #ffffff; padding: 1.5rem; border-radius: 8px; }
.table-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 0; }
.minimal-table { width: 100%; border-collapse: collapse; }
.minimal-table th { background: #fafafa; padding: 1rem; text-align: left; font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
.minimal-table td { padding: 1.2rem 1rem; border-top: 1px solid #f0f0f0; font-size: 0.9rem; }
.minimal-table tr.row-alert td { background-color: #fef2f2 !important; }
.minimal-table tr.row-cancelled td { background-color: #f8fafc !important; color: #64748b; }
.occupancy-cell { display: flex; align-items: center; gap: 12px; }
.bar-bg { flex: 1; background: #eee; height: 6px; border-radius: 10px; overflow: hidden; min-width: 100px; }
.bar-fill { height: 100%; transition: 0.4s ease; }
.bar-fill.ok { background-color: #10b981 !important; }
.bar-fill.low { background-color: #ef4444 !important; }
.tag { padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.tag-ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.tag-alert { background: #fff1f2; color: #991b1b; border: 1px solid #fecdd3; }
.tag-cancelled { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
.tag-pending { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
.status-box { padding: 4rem; text-align: center; color: #888; }
.error-msg { color: #ef4444; }
.btn-manage { background: none; border: 1px solid #ddd; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.btn-manage:disabled { cursor: not-allowed; opacity: 0.5; }

/* Botón "Cargar" de Recomendaciones IA — chispa animada con letras (estilo UIVerse, hue ILPEA) */
.btn-ia-wrapper {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  align-self: flex-start;
}

.btn-ia-cargar {
  --border-radius: 24px;
  --padding: 4px;
  --transition: 0.4s;
  --button-color: #101010;
  --highlight-color-hue: 147deg;

  position: relative;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.55em 0.9em 0.55em 0.9em;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background-color: var(--button-color);
  box-shadow:
    inset 0px 1px 1px rgba(255, 255, 255, 0.2),
    inset 0px 2px 2px rgba(255, 255, 255, 0.15),
    inset 0px 4px 4px rgba(255, 255, 255, 0.1),
    inset 0px 8px 8px rgba(255, 255, 255, 0.05),
    inset 0px 16px 16px rgba(255, 255, 255, 0.05),
    0px -1px 1px rgba(0, 0, 0, 0.02),
    0px -2px 2px rgba(0, 0, 0, 0.03),
    0px -4px 4px rgba(0, 0, 0, 0.05),
    0px -8px 8px rgba(0, 0, 0, 0.06),
    0px -16px 16px rgba(0, 0, 0, 0.08);
  border: solid 1px #fff2;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: box-shadow var(--transition), border var(--transition), background-color var(--transition);
}

.btn-ia-cargar::before {
  content: '';
  position: absolute;
  top: calc(0px - var(--padding));
  left: calc(0px - var(--padding));
  width: calc(100% + var(--padding) * 2);
  height: calc(100% + var(--padding) * 2);
  border-radius: calc(var(--border-radius) + var(--padding));
  pointer-events: none;
  background-image: linear-gradient(0deg, #0004, #000a);
  z-index: -1;
  transition: box-shadow var(--transition), filter var(--transition);
  box-shadow:
    0 -8px 8px -6px #0000 inset,
    0 -16px 16px -8px #00000000 inset,
    1px 1px 1px #fff2,
    2px 2px 2px #fff1,
    -1px -1px 1px #0002,
    -2px -2px 2px #0001;
}

.btn-ia-cargar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
  background-image: linear-gradient(
    0deg,
    #fff,
    hsl(var(--highlight-color-hue), 100%, 70%),
    hsla(var(--highlight-color-hue), 100%, 70%, 50%),
    8%,
    transparent
  );
  background-position: 0 0;
  opacity: 0;
  transition: opacity var(--transition), filter var(--transition);
}

.btn-ia-svg {
  width: 18px;
  height: 18px;
  margin-right: 0.45rem;
  fill: #e8e8e8;
  animation: btn-ia-flicker 2s linear infinite;
  animation-delay: 0.5s;
  filter: drop-shadow(0 0 2px #fff9);
  transition: fill var(--transition), filter var(--transition), opacity var(--transition);
}

@keyframes btn-ia-flicker {
  50% { opacity: 0.35; }
}

.btn-ia-txt {
  position: relative;
  z-index: 1;
  display: inline-block;
  white-space: nowrap;
}

.btn-ia-letter {
  display: inline-block;
  color: #fff5;
  animation: btn-ia-letter-anim 2s ease-in-out infinite;
  transition: color var(--transition), text-shadow var(--transition);
}

@keyframes btn-ia-letter-anim {
  50% {
    text-shadow: 0 0 3px #fff8;
    color: #fff;
  }
}

.btn-ia-cargar:hover {
  border: solid 1px hsla(var(--highlight-color-hue), 100%, 80%, 40%);
}

.btn-ia-cargar:hover::before {
  box-shadow:
    0 -8px 8px -6px #fffa inset,
    0 -16px 16px -8px hsla(var(--highlight-color-hue), 100%, 70%, 30%) inset,
    1px 1px 1px #fff2,
    2px 2px 2px #fff1,
    -1px -1px 1px #0002,
    -2px -2px 2px #0001;
}

.btn-ia-cargar:hover::after {
  opacity: 1;
  mask-image: linear-gradient(0deg, #fff, transparent);
}

.btn-ia-cargar:hover .btn-ia-svg {
  fill: #fff;
  filter: drop-shadow(0 0 3px hsl(var(--highlight-color-hue), 100%, 70%)) drop-shadow(0 -4px 6px #0009);
  animation: none;
}

.btn-ia-cargar:active:not(:disabled) {
  border: solid 1px hsla(var(--highlight-color-hue), 100%, 80%, 70%);
  background-color: hsla(var(--highlight-color-hue), 50%, 20%, 0.5);
}

.btn-ia-cargar:active:not(:disabled)::before {
  box-shadow:
    0 -8px 12px -6px #fffa inset,
    0 -16px 16px -8px hsla(var(--highlight-color-hue), 100%, 70%, 80%) inset,
    1px 1px 1px #fff4,
    2px 2px 2px #fff2,
    -1px -1px 1px #0002,
    -2px -2px 2px #0001;
}

.btn-ia-cargar:active:not(:disabled)::after {
  opacity: 1;
  mask-image: linear-gradient(0deg, #fff, transparent);
  filter: brightness(200%);
}

.btn-ia-cargar:active:not(:disabled) .btn-ia-letter {
  text-shadow: 0 0 1px hsla(var(--highlight-color-hue), 100%, 90%, 90%);
  animation: none;
}

.btn-ia-cargar.is-loading::after {
  opacity: 0.6;
  mask-image: linear-gradient(0deg, #fff, transparent);
}

.btn-ia-cargar.is-loading .btn-ia-letter {
  animation: btn-ia-letter-anim 0.9s ease-in-out infinite;
}

.btn-ia-cargar.is-loading .btn-ia-svg {
  animation-duration: 1s;
}

.btn-ia-cargar:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.btn-retry { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px; }
.empty-row { text-align: center; color: #6b7280; font-style: italic; }

.ruta-acciones {
  min-width: 220px;
}

.unidad-modal {
  width: min(560px, 95vw);
}

.bloqueo-modal {
  width: min(760px, 95vw);
}

.unidad-intro,
.bloqueo-intro {
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

.estado-ok,
.estado-error {
  margin: 0 0 0.75rem;
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  font-size: 0.85rem;
}

.estado-ok {
  background: #ecfdf5;
  color: #065f46;
}

.estado-error {
  background: #fee2e2;
  color: #991b1b;
}
@media print { .no-print { display: none !important; } }

/* RESPONSIVIDAD PARA MÓVILES Y TABLETS */
@media (max-width: 768px) {
  .admin-layout { flex-direction: column; }
  .main-content { padding: 1.5rem 1rem; }
  
  .header-flex { flex-direction: column; gap: 1.5rem; align-items: stretch; }
  .button-group { flex-direction: column; width: 100%; }
  .btn-exportar { width: 100%; }
  
  .filters-header { flex-direction: column; align-items: flex-start; }
  .filters-grid { grid-template-columns: 1fr; }
  .section-header-inline { flex-direction: column; align-items: stretch; gap: 1rem; }
  
  .charts-filter { flex-direction: column; align-items: flex-start; }
  .charts-filter select { width: 100%; }
  
  /* Habilita scroll en la tabla para no romper la pantalla */
  .table-card { overflow-x: auto; }
  .minimal-table { min-width: 800px; }
}
</style>