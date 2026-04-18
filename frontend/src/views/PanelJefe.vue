<template>
  <div class="jefe-container">
    <header class="header">
      <div class="header-left">
        <button
          v-if="mostrarBotonVolverDashboard"
          type="button"
          class="btn-back"
          @click="volverADashboard"
          aria-label="Volver al dashboard"
          title="Volver al dashboard"
        >
          ←
        </button>
        <div class="brand">ILPEA <span>LOGÍSTICA</span></div>
      </div>
      <div class="user-info">
        <span>{{ tituloPanel }}</span>
        <button @click="salir" class="btn-logout">Salir</button>
      </div>
    </header>

    <main class="dashboard-grid">
      <section class="bus-section">
        <div class="section-card">
          <div class="bus-header">
            <h3>Interior: {{ rutaSeleccionada?.zona || 'Cargando Unidad...' }}</h3>
            <div class="indicators">
              <span class="ind"><i class="sq free"></i> Libre</span>
              <span class="ind"><i class="sq selected"></i> Seleccionado</span>
              <span class="ind"><i class="sq occupied"></i> Ocupado</span>
            </div>
          </div>

          <div class="bus-chassis">
            <div class="driver-seat">💺 Piloto</div>
            <div class="seats-grid">
              <div 
                v-for="n in (rutaSeleccionada?.capacidad_real || 30)" 
                :key="n" 
                class="seat-wrapper"
                :class="{ 'aisle-space': n % 4 === 2 }" 
              >
                <div 
                  class="seat" 
                  :class="getSeatClass(n)"
                  @click="manejarClickAsiento(n)"
                >
                  {{ n }}
                </div>
              </div>
            </div>
          </div>
          
          <div class="stats-footer" v-if="rutaSeleccionada">
            <p>Capacidad: {{ rutaSeleccionada.capacidad_real }} | Libres: {{ asientosLibres }}</p>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="section-card">
          <h3>Asignación de Empleado</h3>
          <p class="subtitle">{{ subtituloPanel }}</p>

          <p v-if="cargandoContexto" class="status-info">Cargando empleados y rutas...</p>
          
          <div class="form-group">
            <label>Empleado asignado</label>
            <select v-model="registro.idEmpleado" class="minimal-select" :disabled="!empleadosAsignados.length || cargandoContexto">
              <option value="" disabled>
                {{ empleadosAsignados.length ? 'Selecciona un empleado' : 'Sin empleados disponibles' }}
              </option>
              <option v-for="empleado in empleadosAsignados" :key="empleado.uid" :value="empleado.id_empleado">
                {{ empleado.id_empleado }} - {{ empleado.nombre }}
              </option>
            </select>
            <p v-if="empleadoSeleccionado" class="helper-note">{{ empleadoSeleccionado.email }}</p>
            <p v-if="empleadoYaAsignado" class="status-error" style="margin-top: 0.5rem; font-size: 0.85rem;">
              ⚠️ Este empleado ya está asignado a la Ruta {{ empleadoYaAsignado.ruta.ruta }} (Asiento {{ empleadoYaAsignado.asiento }}). Debes desasignarlo en la tabla inferior primero.
            </p>
          </div>

          <div class="form-group">
            <label>Ruta Activa</label>
            <select v-model="registro.ruta" class="minimal-select" :disabled="!rutasParaTurno.length || cargandoContexto">
              <option v-if="!rutasParaTurno.length" value="" disabled>
                Sin rutas disponibles
              </option>
              <option v-for="r in rutasParaTurno" :key="r.id" :value="r.id">
                {{ construirEtiquetaRuta(r) }}
              </option>
            </select>
            <p class="helper-note">{{ resumenRutasTurno }}</p>
            <p v-if="rutaRecomendada" class="helper-note">
              Recomendación: {{ construirEtiquetaRuta(rutaRecomendada) }}
            </p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Día</label>
              <input v-model="registro.dia" type="date" class="minimal-input">
            </div>
            <div class="form-group">
              <label>Turno</label>
              <select v-model="registro.horario" class="minimal-select">
                <option value="mixto_1">Mixto 1</option>
                <option value="mixto_2">Mixto 2</option>
                <option value="sab_3">Sábado 3er</option>
                <option value="dom_1">Domingo 1er</option>
                <option value="dom_2">Domingo 2do</option>
                <option value="dom_3">Domingo 3er</option>
              </select>
            </div>
          </div>

          <div class="selection-summary" v-if="registro.asiento">
            <p>Asiento Seleccionado: <strong>{{ registro.asiento }}</strong></p>
          </div>

          <button 
            @click="confirmarAsignacion" 
            :disabled="!isFormReady || procesandoAsignacion || cargandoContexto"
            class="btn-confirm"
          >
            {{ procesandoAsignacion ? 'Procesando...' : 'Confirmar Registro' }}
          </button>

          <p v-if="aviso" class="status-info">{{ aviso }}</p>
          <p v-if="mensaje" class="status-ok">{{ mensaje }}</p>
          <p v-if="error" class="status-error">{{ error }}</p>
          
          <button class="btn-report">Generar Reporte de Turno</button>
        </div>
      </section>
    </main>

    <div
      v-if="modalDesasignacion.visible && modalDesasignacion.detalle"
      class="modal-overlay"
      @click.self="cerrarModalDesasignacion"
    >
      <div class="modal-card">
        <h4>Eliminar Asignación</h4>
        <p class="helper-note">Confirma si deseas liberar este asiento y desasignar al empleado.</p>

        <div class="modal-detail-grid">
          <p><strong>Empleado:</strong> {{ modalDesasignacion.detalle.nombre }}</p>
          <p><strong>ID:</strong> {{ modalDesasignacion.detalle.id_empleado }}</p>
          <p><strong>Email:</strong> {{ modalDesasignacion.detalle.email }}</p>
          <p><strong>Asiento:</strong> {{ modalDesasignacion.detalle.asiento }}</p>
          <p><strong>Ruta:</strong> {{ modalDesasignacion.detalle.ruta }}</p>
          <p><strong>Día:</strong> {{ modalDesasignacion.detalle.fecha }}</p>
          <p><strong>Turno:</strong> {{ modalDesasignacion.detalle.turno }}</p>
        </div>

        <p v-if="errorModalDesasignacion" class="status-error">{{ errorModalDesasignacion }}</p>

        <div class="modal-actions">
          <button class="btn-secondary" type="button" :disabled="modalDesasignacion.procesando" @click="cerrarModalDesasignacion">
            Cancelar
          </button>
          <button class="btn-danger" type="button" :disabled="modalDesasignacion.procesando" @click="confirmarDesasignacion">
            {{ modalDesasignacion.procesando ? 'Eliminando...' : 'Eliminar asignación' }}
          </button>
        </div>
      </div>
    </div>

    <section class="crud-section">
      <EmpleadoCrudPanel />
    </section>

    <section class="assignment-overview-section">
      <div class="section-card">
        <div class="assignment-header">
          <h3>Asignación Actual por Empleado</h3>
          <p class="subtitle">Vista del día {{ registro.dia }} y turno {{ TURNOS_LABEL[registro.horario] || registro.horario }}.</p>
        </div>

        <div v-if="cargandoContexto" class="status-info">Preparando asignaciones actuales...</div>
        <div v-else-if="!empleadosAsignados.length" class="status-info">
          No hay empleados activos asignados a tu turno.
        </div>
        <div v-else class="assignment-table-wrap">
          <table class="assignment-table">
            <thead>
              <tr>
                <th>ID Empleado</th>
                <th>Nombre</th>
                <th>Ruta actual</th>
                <th>Asiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in empleadosConAsignacion" :key="fila.uid">
                <td>{{ fila.id_empleado }}</td>
                <td>{{ fila.nombre }}</td>
                <td>
                  {{ fila.asignacion ? construirEtiquetaRuta(fila.asignacion.ruta) : 'Sin asignar' }}
                </td>
                <td>{{ fila.asignacion?.asiento ?? '-' }}</td>
                <td class="assignment-actions">
                  <button
                    class="btn-mini"
                    type="button"
                    @click="prepararCambioRutaDesdeTabla(fila.id_empleado, fila.asignacion?.ruta.id || null)"
                  >
                    {{ fila.asignacion ? 'Cambiar ruta' : 'Asignar ruta' }}
                  </button>
                  <button
                    v-if="fila.asignacion"
                    class="btn-mini danger"
                    type="button"
                    :disabled="procesandoLiberacionEmpleado === fila.id_empleado"
                    @click="liberarAsignacionDesdeTabla(fila)"
                  >
                    {{ procesandoLiberacionEmpleado === fila.id_empleado ? 'Liberando...' : 'Desasignar' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <CopilotoChat :scope="scopeChat" :contexto="{ fecha: registro.dia, turno: registro.horario }" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import EmpleadoCrudPanel from '../components/EmpleadoCrudPanel.vue'
import CopilotoChat from '../components/CopilotoChat.vue'

interface EmpleadoAsignado {
  uid: string;
  id_empleado: string;
  nombre: string;
  email: string;
  activo?: boolean;
}

interface Ruta {
  id: string;
  ruta: number;
  zona?: string;
  nombre?: string;
  capacidad_real: number;
  capacidad_limite?: number;
  asientos_ocupados?: number;
  asientos_disponibles?: number;
  pasajeros_ids?: string[];
  asientos_reservados?: number[];
  asientos_por_empleado?: Record<string, number>;
  programada?: boolean;
}

interface ModalDesasignacionDetalle {
  id_empleado: string;
  nombre: string;
  email: string;
  asiento: number;
  ruta: string;
  fecha: string;
  turno: string;
}

interface AsignacionDetectada {
  ruta: Ruta;
  asiento: number | null;
}

interface FilaEmpleadoAsignacion extends EmpleadoAsignado {
  asignacion: AsignacionDetectada | null;
}

const TURNOS_LABEL: Record<string, string> = {
  mixto_1: 'Mixto 1',
  mixto_2: 'Mixto 2',
  sab_3: 'Sábado 3er',
  dom_1: 'Domingo 1er',
  dom_2: 'Domingo 2do',
  dom_3: 'Domingo 3er',
}

const route = useRoute()
const router = useRouter()
const { logout, authHeaders, obtenerRol } = useAuth()
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const esAdmin = computed(() => obtenerRol() === 'ADMIN')
const mostrarBotonVolverDashboard = computed(() => esAdmin.value && route.path === '/admin/asignaciones')
const tituloPanel = computed(() => (esAdmin.value ? 'Panel de Asignación: Administrador' : 'Panel de Asignación: Jefe de Turno'))
const subtituloPanel = computed(() => (
  esAdmin.value
    ? 'Selecciona un asiento y asigna empleados con acceso total a todas las rutas.'
    : 'Selecciona un asiento y asigna solo empleados bajo tu responsabilidad'
))
const scopeChat = computed(() => (esAdmin.value ? 'ADMIN' : 'JEFE'))

const volverADashboard = () => {
  router.push('/admin')
}

const registro = ref({
  idEmpleado: '',
  ruta: '',
  dia: new Date().toISOString().slice(0, 10),
  horario: 'mixto_1',
  asiento: null as number | null,
})

const empleadosCatalogo = ref<EmpleadoAsignado[]>([])
const empleadosAsignados = ref<EmpleadoAsignado[]>([])
const rutas = ref<Ruta[]>([])
const cargandoContexto = ref(true)
const procesandoAsignacion = ref(false)
const aviso = ref<string | null>(null)
const error = ref<string | null>(null)
const mensaje = ref<string | null>(null)
const errorModalDesasignacion = ref<string | null>(null)
const procesandoLiberacionEmpleado = ref<string | null>(null)
const modalDesasignacion = ref({
  visible: false,
  procesando: false,
  detalle: null as ModalDesasignacionDetalle | null,
})

const empleadoSeleccionado = computed(() => {
  return empleadosAsignados.value.find((empleado) => empleado.id_empleado === registro.value.idEmpleado) || null
})

const empleadoYaAsignado = computed(() => {
  if (!registro.value.idEmpleado) return null
  return detectarAsignacionEmpleado(registro.value.idEmpleado)
})

const rutasProgramadas = computed(() => rutas.value.filter((ruta) => ruta.programada))

const rutasParaTurno = computed(() => {
  // Mostrar siempre todas las rutas (programadas y base) para que el Jefe
  // pueda seguir asignando empleados a nuevas rutas libremente.
  return rutas.value
})

const rutaRecomendada = computed(() => {
  const candidatas = rutasParaTurno.value
    .filter((ruta) => (ruta.asientos_disponibles || 0) > 0)
    .slice()
    .sort((a, b) => {
      const diferenciaDisponibles = (b.asientos_disponibles || 0) - (a.asientos_disponibles || 0)
      if (diferenciaDisponibles !== 0) return diferenciaDisponibles
      return (a.ruta || 0) - (b.ruta || 0)
    })

  return candidatas[0] || null
})

const resumenRutasTurno = computed(() => {
  if (!rutas.value.length) {
    return 'No hay rutas registradas para mostrar.'
  }

  if (!rutasProgramadas.value.length) {
    return `No hay rutas programadas para ${TURNOS_LABEL[registro.value.horario] || registro.value.horario}. Se muestran rutas base para que sigas operando.`
  }

  return `${rutasProgramadas.value.length} rutas programadas para ${TURNOS_LABEL[registro.value.horario] || registro.value.horario}. (Todas las rutas disponibles)`
})

const rutaSeleccionada = computed(() => {
  return rutasParaTurno.value.find((ruta) => ruta.id === registro.value.ruta) || null
})

const empleadosConAsignacion = computed<FilaEmpleadoAsignacion[]>(() => {
  return empleadosAsignados.value.map((empleado) => ({
    ...empleado,
    asignacion: detectarAsignacionEmpleado(empleado.id_empleado),
  }))
})

const asientosLibres = computed(() => {
  if (!rutaSeleccionada.value) return 0
  return rutaSeleccionada.value.asientos_disponibles || 0
})

const isFormReady = computed(() => {
  return (
    registro.value.idEmpleado !== ''
    && registro.value.asiento !== null
    && registro.value.ruta !== ''
    && !cargandoContexto.value
    && !empleadoYaAsignado.value
  )
})

function obtenerIdEmpleadoVisual(empleado: any) {
  const idPersistido = String(empleado?.id_empleado || '').trim()
  if (idPersistido) {
    return idPersistido
  }

  return `EMP-${String(empleado?.uid || '').slice(-6).toUpperCase()}`
}

function normalizarRuta(raw: any): Ruta {
  const capacidadBase = Number(raw?.capacidad_limite) || Number(raw?.capacidad_real) || 30
  const asientosReservados: number[] = Array.isArray(raw?.asientos_reservados)
    ? [...new Set<number>(
      raw.asientos_reservados
        .map((valor: any) => Number(valor))
        .filter((valor: number) => Number.isInteger(valor) && valor > 0),
    )]
    : []
  const asientosPorEmpleado: Record<string, number> = {}
  Object.entries(raw?.asientos_por_empleado || {}).forEach(([idEmpleado, asiento]) => {
    const id = String(idEmpleado || '').trim()
    const asientoNumero = Number(asiento)
    if (id && Number.isInteger(asientoNumero) && asientoNumero > 0) {
      asientosPorEmpleado[id] = asientoNumero
    }
  })
  const pasajerosIds = Array.isArray(raw?.pasajeros_ids) ? raw.pasajeros_ids : []
  const asientosOcupadosDato = Number(raw?.asientos_ocupados)
  const asientosOcupados = Number.isFinite(asientosOcupadosDato)
    ? asientosOcupadosDato
    : Math.max(asientosReservados.length, pasajerosIds.length)

  return {
    id: String(raw?.id || raw?.ruta || ''),
    ruta: Number(raw?.ruta) || 0,
    zona: raw?.zona,
    nombre: raw?.nombre,
    capacidad_real: Number(raw?.capacidad_real) || capacidadBase,
    capacidad_limite: capacidadBase,
    asientos_ocupados: asientosOcupados,
    asientos_disponibles: Math.max(capacidadBase - asientosOcupados, 0),
    pasajeros_ids: pasajerosIds,
    asientos_reservados: asientosReservados,
    asientos_por_empleado: asientosPorEmpleado,
    programada: Boolean(raw?.programada),
  }
}

function construirEtiquetaRuta(ruta: Ruta) {
  const nombre = ruta.zona || ruta.nombre || 'Sin nombre'
  const libres = ruta.asientos_disponibles || 0
  const estado = ruta.programada ? 'Programada' : 'Base'
  return `Ruta ${ruta.ruta} - ${nombre} (${libres} libres, ${estado})`
}

function asegurarRutaSeleccionadaValida() {
  const rutasActuales = rutasParaTurno.value
  const rutaExiste = rutasActuales.some((ruta) => ruta.id === registro.value.ruta)

  if (!rutaExiste) {
    registro.value.ruta = rutaRecomendada.value?.id || rutasActuales[0]?.id || ''
    registro.value.asiento = null
  }
}

async function obtenerHeadersSeguros() {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    throw new Error('Sesión inválida. Inicia sesión nuevamente.')
  }
  return headers
}

async function cargarEmpleadosAsignados() {
  const headers = await obtenerHeadersSeguros()
  const respuesta = await fetch(`${API_BASE_URL}/api/empleados`, { headers })
  const payload = await respuesta.json().catch(() => ({}))

  if (!respuesta.ok) {
    throw new Error(payload?.message || 'No se pudieron cargar tus empleados asignados.')
  }

  const empleados = Array.isArray(payload?.data) ? payload.data : []
  const empleadosNormalizados = empleados
    .map((empleado: any) => ({
      uid: String(empleado.uid),
      id_empleado: obtenerIdEmpleadoVisual(empleado),
      nombre: String(empleado.nombre || 'Sin nombre'),
      email: String(empleado.email || 'Sin email'),
      activo: empleado.activo !== false,
    }))
    .sort((a: EmpleadoAsignado, b: EmpleadoAsignado) => a.nombre.localeCompare(b.nombre, 'es'))

  empleadosCatalogo.value = empleadosNormalizados
  empleadosAsignados.value = empleadosNormalizados.filter((empleado: EmpleadoAsignado) => empleado.activo !== false)

  if (!empleadosAsignados.value.length) {
    aviso.value = esAdmin.value
      ? 'No hay empleados activos registrados para asignar.'
      : 'No tienes empleados asignados activos. Pide al administrador que asigne al menos uno.'
    registro.value.idEmpleado = ''
    return
  }

  aviso.value = null

  const idSeleccionadoEsValido = empleadosAsignados.value.some(
    (empleado) => empleado.id_empleado === registro.value.idEmpleado,
  )

  if (!idSeleccionadoEsValido) {
    registro.value.idEmpleado = empleadosAsignados.value[0]?.id_empleado || ''
  }
}

async function cargarRutasDeDB() {
  const headers = await obtenerHeadersSeguros()
  const params = new URLSearchParams({
    fecha: registro.value.dia,
    turno: registro.value.horario,
  })

  const respuestaProgramadas = await fetch(`${API_BASE_URL}/api/rutas/programadas?${params.toString()}`, { headers })

  if (!respuestaProgramadas.ok) {
    const payloadError = await respuestaProgramadas.json().catch(() => ({}))
    throw new Error(payloadError?.message || 'No se pudieron cargar rutas por turno y día.')
  }

  const payloadProgramadas = await respuestaProgramadas.json().catch(() => ({}))
  const rutasRecibidas = Array.isArray(payloadProgramadas?.data) ? payloadProgramadas.data : []

  rutas.value = rutasRecibidas.map(normalizarRuta)
  asegurarRutaSeleccionadaValida()
}

function obtenerEmpleadoPorId(idEmpleado: string) {
  return empleadosCatalogo.value.find((empleado) => empleado.id_empleado === idEmpleado) || null
}

function obtenerAsientoEmpleadoEnRuta(ruta: Ruta, idEmpleado: string): number | null {
  const asientosPorEmpleado = ruta.asientos_por_empleado || {}
  const asientoDesdeMapa = Number(asientosPorEmpleado[idEmpleado])
  if (Number.isInteger(asientoDesdeMapa) && asientoDesdeMapa > 0) {
    return asientoDesdeMapa
  }

  const pasajeros = Array.isArray(ruta.pasajeros_ids) ? ruta.pasajeros_ids : []
  const asientos = Array.isArray(ruta.asientos_reservados) ? ruta.asientos_reservados : []
  if (!pasajeros.length || !asientos.length || pasajeros.length !== asientos.length) {
    return null
  }

  const indice = pasajeros.findIndex((id) => id === idEmpleado)
  if (indice < 0) {
    return null
  }

  const asiento = Number(asientos[indice])
  return Number.isInteger(asiento) && asiento > 0 ? asiento : null
}

function detectarAsignacionEmpleado(idEmpleado: string): AsignacionDetectada | null {
  for (const ruta of rutasParaTurno.value) {
    const pasajeros = Array.isArray(ruta.pasajeros_ids) ? ruta.pasajeros_ids : []
    const asientosPorEmpleado = ruta.asientos_por_empleado || {}

    if (pasajeros.includes(idEmpleado) || Object.prototype.hasOwnProperty.call(asientosPorEmpleado, idEmpleado)) {
      return {
        ruta,
        asiento: obtenerAsientoEmpleadoEnRuta(ruta, idEmpleado),
      }
    }
  }

  return null
}

function obtenerIdEmpleadoEnAsiento(ruta: Ruta, asiento: number) {
  const asientoPorEmpleado = ruta.asientos_por_empleado || {}
  const entrada = Object.entries(asientoPorEmpleado).find(([, asientoActual]) => Number(asientoActual) === asiento)
  if (entrada) {
    return entrada[0]
  }

  const asientos = ruta.asientos_reservados || []
  const pasajeros = ruta.pasajeros_ids || []
  if (asientos.length === pasajeros.length) {
    const indice = asientos.findIndex((asientoActual) => asientoActual === asiento)
    if (indice >= 0) {
      return pasajeros[indice] || null
    }
  }

  return null
}

function cerrarModalDesasignacion() {
  modalDesasignacion.value.visible = false
  modalDesasignacion.value.procesando = false
  modalDesasignacion.value.detalle = null
  errorModalDesasignacion.value = null
}

function abrirModalDesasignacion(asiento: number) {
  const ruta = rutaSeleccionada.value
  if (!ruta) return

  const idEmpleado = obtenerIdEmpleadoEnAsiento(ruta, asiento)
  if (!idEmpleado) {
    aviso.value = 'No se pudo identificar al empleado en ese asiento. Recarga las rutas y vuelve a intentar.'
    return
  }

  const empleado = obtenerEmpleadoPorId(idEmpleado)
  const turnoTexto = TURNOS_LABEL[registro.value.horario] || registro.value.horario

  modalDesasignacion.value.detalle = {
    id_empleado: idEmpleado,
    nombre: empleado?.nombre || 'Empleado asignado',
    email: empleado?.email || 'Sin email disponible',
    asiento,
    ruta: construirEtiquetaRuta(ruta),
    fecha: registro.value.dia,
    turno: turnoTexto,
  }
  modalDesasignacion.value.visible = true
  modalDesasignacion.value.procesando = false
  errorModalDesasignacion.value = null
  registro.value.asiento = null
}

const manejarClickAsiento = (n: number) => {
  const asientosOcupados = rutaSeleccionada.value?.asientos_reservados || []
  if (asientosOcupados.includes(n)) {
    abrirModalDesasignacion(n)
    return
  }

  if (rutaSeleccionada.value) {
    registro.value.asiento = n
  }
}

const getSeatClass = (n: number) => {
  if (rutaSeleccionada.value?.asientos_reservados?.includes(n)) return 'occupied'
  if (registro.value.asiento === n) return 'selected'
  return 'free'
}

const confirmarAsignacion = async () => {
  if (!isFormReady.value || !rutaSeleccionada.value || registro.value.asiento === null) return

  procesandoAsignacion.value = true
  error.value = null
  mensaje.value = null

  try {
    const headers = await obtenerHeadersSeguros()
    const respuesta = await fetch(`${API_BASE_URL}/api/asignar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        id_empleado: registro.value.idEmpleado,
        id_ruta: rutaSeleccionada.value.id,
        fecha: registro.value.dia,
        turno: registro.value.horario,
        asiento: registro.value.asiento,
      }),
    })

    const payload = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) {
      throw new Error(payload?.message || 'No se pudo registrar la asignación.')
    }

    const asientoAsignado = registro.value.asiento
    const empleadoAsignado = registro.value.idEmpleado

    mensaje.value = `Empleado ${empleadoAsignado} asignado al asiento ${asientoAsignado}.`
    error.value = null
    registro.value.asiento = null

    await cargarRutasDeDB()
  } catch (err: any) {
    error.value = err.message || 'No se pudo registrar la asignación.'
    mensaje.value = null
  } finally {
    procesandoAsignacion.value = false
  }
}

const confirmarDesasignacion = async () => {
  const detalle = modalDesasignacion.value.detalle
  const ruta = rutaSeleccionada.value
  if (!detalle || !ruta) return

  modalDesasignacion.value.procesando = true
  errorModalDesasignacion.value = null

  try {
    const headers = await obtenerHeadersSeguros()
    const respuesta = await fetch(`${API_BASE_URL}/api/asignar/cancelar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        id_empleado: detalle.id_empleado,
        id_ruta: ruta.id,
        fecha: registro.value.dia,
        turno: registro.value.horario,
        asiento: detalle.asiento,
      }),
    })

    const payload = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) {
      throw new Error(payload?.message || 'No se pudo eliminar la asignación del asiento.')
    }

    mensaje.value = `Asignación eliminada para ${detalle.id_empleado} en asiento ${detalle.asiento}.`
    error.value = null
    cerrarModalDesasignacion()
    await cargarRutasDeDB()
  } catch (err: any) {
    errorModalDesasignacion.value = err.message || 'No se pudo eliminar la asignación.'
  } finally {
    modalDesasignacion.value.procesando = false
  }
}

function prepararCambioRutaDesdeTabla(idEmpleado: string, rutaId: string | null) {
  registro.value.idEmpleado = idEmpleado
  registro.value.ruta = rutaId || rutaRecomendada.value?.id || rutasParaTurno.value[0]?.id || ''
  registro.value.asiento = null
  mensaje.value = `Empleado ${idEmpleado} seleccionado. Elige asiento para confirmar la asignación.`
  error.value = null
}

async function liberarAsignacionDesdeTabla(fila: FilaEmpleadoAsignacion) {
  if (!fila.asignacion) {
    return
  }

  const ruta = fila.asignacion.ruta
  const asientoNumero = Number(fila.asignacion.asiento)

  if (!Number.isInteger(asientoNumero) || asientoNumero <= 0) {
    error.value = 'No se pudo determinar el asiento asignado para este empleado.'
    return
  }

  const confirmar = window.confirm(
    `¿Deseas desasignar a ${fila.nombre} de la Ruta ${ruta.ruta} (asiento ${asientoNumero})?`,
  )

  if (!confirmar) {
    return
  }

  procesandoLiberacionEmpleado.value = fila.id_empleado
  error.value = null
  mensaje.value = null

  try {
    const headers = await obtenerHeadersSeguros()
    const respuesta = await fetch(`${API_BASE_URL}/api/asignar/cancelar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        id_empleado: fila.id_empleado,
        id_ruta: ruta.id,
        fecha: registro.value.dia,
        turno: registro.value.horario,
        asiento: asientoNumero,
      }),
    })

    const payload = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) {
      throw new Error(payload?.message || 'No se pudo eliminar la asignación del empleado.')
    }

    mensaje.value = `Asignación eliminada para ${fila.id_empleado} (Ruta ${ruta.ruta}, asiento ${asientoNumero}).`
    await cargarRutasDeDB()
  } catch (err: any) {
    error.value = err.message || 'No se pudo eliminar la asignación.'
  } finally {
    procesandoLiberacionEmpleado.value = null
  }
}

const salir = () => {
  logout().finally(() => router.push('/login'))
}

async function cargarContextoInicial() {
  cargandoContexto.value = true
  error.value = null

  try {
    await Promise.all([cargarEmpleadosAsignados(), cargarRutasDeDB()])
  } catch (err: any) {
    error.value = err.message || `No se pudo cargar el contexto del panel de ${esAdmin.value ? 'administración' : 'jefe'}.`
  } finally {
    cargandoContexto.value = false
  }
}

watch(
  [() => registro.value.dia, () => registro.value.horario],
  async () => {
    if (cargandoContexto.value) {
      return
    }

    try {
      error.value = null
      mensaje.value = null
      cerrarModalDesasignacion()
      await cargarRutasDeDB()
    } catch (err: any) {
      error.value = err.message || 'No se pudieron actualizar las rutas para el turno seleccionado.'
    }
  },
)

onMounted(cargarContextoInicial)
</script>

<style scoped>
/* ESTILOS RESTAURADOS - ILPEA CLEAN TECH */
.jefe-container { min-height: 100vh; background: #f8fafc; font-family: 'Inter', sans-serif; color: #1e293b; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 3rem; background: #fff; border-bottom: 1px solid #e2e8f0; }
.header-left { display: flex; align-items: center; gap: 0.75rem; }
.brand { font-weight: 800; font-size: 1.2rem; }
.brand span { color: #2563eb; }
.btn-back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}
.btn-back:hover { background: #f1f5f9; border-color: #94a3b8; }
.btn-logout { background: none; border: 1px solid #ef4444; color: #ef4444; padding: 6px 16px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
.btn-logout:hover { background: #fef2f2; }

.dashboard-grid { display: grid; grid-template-columns: 1fr 420px; gap: 2.5rem; padding: 2.5rem 3rem; }
@media (max-width: 1024px) {
  .dashboard-grid { grid-template-columns: 1fr; }
}
.section-card { background: #fff; border-radius: 16px; padding: 2rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }

/* BUS TACTICAL MAP */
.bus-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.indicators { display: flex; gap: 1rem; font-size: 0.75rem; color: #64748b; }
.sq { width: 12px; height: 12px; display: inline-block; border-radius: 3px; vertical-align: middle; margin-right: 4px; }
.free { border: 1px solid #cbd5e1; background: #fff; }
.selected { background: #2563eb; }
.occupied { background: #94a3b8; }

.bus-chassis { background: #f1f5f9; padding: 25px; border-radius: 30px 30px 10px 10px; max-width: 380px; margin: 0 auto; border: 2px solid #e2e8f0; }
.driver-seat { text-align: right; margin-bottom: 25px; font-size: 0.8rem; font-weight: 700; color: #94a3b8; padding-right: 15px; }

.seats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.seat-wrapper { display: flex; justify-content: center; }
.aisle-space { margin-right: 22px; }

.seat { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.2s; border: 1px solid #e2e8f0; background: #fff; }
.seat.selected { background: #2563eb; color: #fff; border-color: #1e40af; transform: scale(1.05); }
.seat.occupied { background: #94a3b8; color: #fff; border-color: #64748b; cursor: pointer; }
.seat:hover:not(.occupied) { border-color: #2563eb; color: #2563eb; }
.seat.occupied:hover { opacity: 0.9; }

/* FORM STYLING */
h3 { margin: 0 0 0.5rem 0; font-size: 1.25rem; }
.subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }
.helper-note { margin: 0.5rem 0 0; color: #64748b; font-size: 0.8rem; }
.status-info { margin-top: 0.8rem; color: #1d4ed8; font-size: 0.85rem; font-weight: 500; }
.form-group { margin-bottom: 1.5rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
label { display: block; font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem; text-transform: uppercase; }
.minimal-input, .minimal-select { width: 100%; padding: 0.8rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; color: #1e293b; background: #f8fafc; outline: none; transition: 0.2s; }
.minimal-input:focus { border-color: #2563eb; background: #fff; }

.selection-summary { background: #eff6ff; padding: 1.2rem; border-radius: 10px; border: 1px dashed #2563eb; text-align: center; margin-bottom: 1.5rem; color: #1e40af; }
.btn-confirm { width: 100%; padding: 1.1rem; background: #1e293b; color: #fff; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-confirm:hover:not(:disabled) { background: #0f172a; }
.btn-confirm:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
.btn-report { width: 100%; background: none; border: 1px solid #e2e8f0; color: #64748b; padding: 0.9rem; border-radius: 10px; margin-top: 0.8rem; cursor: pointer; font-weight: 500; }
.btn-secondary { background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.7rem 1rem; cursor: pointer; font-weight: 600; }
.btn-danger { background: #b91c1c; color: #fff; border: 1px solid #991b1b; border-radius: 10px; padding: 0.7rem 1rem; cursor: pointer; font-weight: 700; }
.btn-danger:disabled, .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
.stats-footer { margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: #94a3b8; }
.status-ok { margin-top: 1rem; color: #166534; font-weight: 600; }
.status-error { margin-top: 1rem; color: #b91c1c; font-weight: 600; }
.crud-section { padding: 0 3rem 2.5rem; }

.assignment-overview-section { padding: 0 3rem 2.5rem; }
.assignment-header { margin-bottom: 1rem; }
.assignment-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
.assignment-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  min-width: 720px;
}
.assignment-table thead th {
  text-align: left;
  padding: 0.8rem;
  background: #f8fafc;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.75rem;
}
.assignment-table tbody td {
  padding: 0.8rem;
  border-top: 1px solid #e2e8f0;
  color: #1f2937;
}
.assignment-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.btn-mini {
  background: #0f172a;
  color: #fff;
  border: 1px solid #0f172a;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
}
.btn-mini:hover { background: #1e293b; }
.btn-mini.danger {
  background: #fff;
  color: #b91c1c;
  border-color: #fecaca;
}
.btn-mini.danger:hover { background: #fef2f2; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 50;
}

.modal-card {
  width: min(520px, 100%);
  background: #fff;
  border-radius: 14px;
  border: 1px solid #cbd5e1;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.25);
  padding: 1.25rem 1.25rem 1rem;
}

.modal-card h4 {
  margin: 0;
  font-size: 1.1rem;
  color: #0f172a;
}

.modal-detail-grid {
  margin-top: 0.9rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.9rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: #334155;
}

.modal-detail-grid p {
  margin: 0;
}

.modal-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}

/* RESPONSIVIDAD PARA MÓVILES Y TABLETS */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }
  .user-info {
    flex-direction: column;
    width: 100%;
    gap: 0.8rem;
  }
  .btn-logout {
    width: 100%;
  }
  .dashboard-grid {
    padding: 1.5rem 1rem;
    gap: 1.5rem;
  }
  .crud-section,
  .assignment-overview-section {
    padding: 0 1rem 1.5rem;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .bus-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  .bus-chassis {
    padding: 15px 10px;
  }
  .seat {
    width: 36px;
    height: 36px;
    font-size: 0.75rem;
  }
  .aisle-space {
    margin-right: 12px;
  }
  .modal-actions {
    flex-direction: column;
  }
  .modal-actions button {
    width: 100%;
  }
}
</style>