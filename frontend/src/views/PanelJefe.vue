<template>
  <div class="jefe-container">
    <header class="header">
      <div class="brand">ILPEA <span>LOGÍSTICA</span></div>
      <div class="user-info">
        <span>Panel de Asignación: Jefe de Turno</span>
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
                  @click="seleccionarAsiento(n)"
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
          <p class="subtitle">Selecciona un asiento en el mapa y llena los datos</p>
          
          <div class="form-group">
            <label>ID Empleado</label>
            <input v-model="registro.idEmpleado" type="text" placeholder="Ej. 2496" class="minimal-input">
          </div>

          <div class="form-group">
            <label>Ruta Activa</label>
            <select v-model="registro.ruta" class="minimal-select">
              <option v-for="r in rutas" :key="r.id" :value="r.id || r.ruta.toString()">
                Ruta {{ r.ruta }} - {{ r.zona || r.nombre }}
              </option>
            </select>
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
            :disabled="!isFormReady"
            class="btn-confirm"
          >
            Confirmar Registro
          </button>
          
          <button class="btn-report">Generar Reporte de Turno</button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
// Importamos el nuevo componente del chatbot
import CopilotoChat from '../components/CopilotoChat.vue'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { logout } = useAuth()

// 1. Estado Reactivo
const registro = ref({
  idEmpleado: '',
  ruta: '',
  dia: new Date().toISOString().substr(0, 10),
  horario: 'mixto_1',
  asiento: null as number | null
})

const rutas = ref<any[]>([])
const cargando = ref(true)
const error = ref<string | null>(null)

// 2. Carga de Datos
const obtenerRutasDeDB = async () => {
  try {
    cargando.value = true
    const respuesta = await fetch('http://localhost:3000/api/rutas')
    if (!respuesta.ok) throw new Error('Falla en API')
    const json = await respuesta.json()
    rutas.value = json.data || json
    if (rutas.value.length > 0) {
      registro.value.ruta = (rutas.value[0].id || rutas.value[0].ruta).toString()
    }
  } catch (err) {
    error.value = "Error de conexión"
  } finally {
    cargando.value = false
  }
}

// 3. Lógica Computada
const rutaSeleccionada = computed(() => {
  return rutas.value.find(r => (r.id || r.ruta).toString() === registro.value.ruta)
})

const asientosLibres = computed(() => {
  if (!rutaSeleccionada.value) return 0
  const ocupados = rutaSeleccionada.value.asientos_ocupados?.length || 0
  return rutaSeleccionada.value.capacidad_real - ocupados
})

const isFormReady = computed(() => {
  return registro.value.idEmpleado !== '' && registro.value.asiento !== null
})

// 4. Métodos de Interacción
const seleccionarAsiento = (n: number) => {
  if (!rutaSeleccionada.value?.asientos_ocupados?.includes(n)) {
    registro.value.asiento = n
  }
}

const getSeatClass = (n: number) => {
  if (rutaSeleccionada.value?.asientos_ocupados?.includes(n)) return 'occupied'
  if (registro.value.asiento === n) return 'selected'
  return 'free'
}

const confirmarAsignacion = () => {
  if (rutaSeleccionada.value && registro.value.asiento) {
    if (!rutaSeleccionada.value.asientos_ocupados) rutaSeleccionada.value.asientos_ocupados = []
    rutaSeleccionada.value.asientos_ocupados.push(registro.value.asiento)
    alert(`Éxito: Empleado ${registro.value.idEmpleado} registrado.`)
    registro.value.asiento = null
    registro.value.idEmpleado = ''
  }
}

const cerrarSesion = async () => {
  await logout()
const salir = () => {
  localStorage.removeItem('userRole')
  router.push('/login')
}

onMounted(obtenerRutasDeDB)
</script>

<style scoped>
/* ESTILOS RESTAURADOS - ILPEA CLEAN TECH */
.jefe-container { min-height: 100vh; background: #f8fafc; font-family: 'Inter', sans-serif; color: #1e293b; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 3rem; background: #fff; border-bottom: 1px solid #e2e8f0; }
.brand { font-weight: 800; font-size: 1.2rem; }
.brand span { color: #2563eb; }
.btn-logout { background: none; border: 1px solid #ef4444; color: #ef4444; padding: 6px 16px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
.btn-logout:hover { background: #fef2f2; }

.dashboard-grid { display: grid; grid-template-columns: 1fr 420px; gap: 2.5rem; padding: 2.5rem 3rem; }
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
.seat.occupied { background: #94a3b8; color: #fff; border-color: #64748b; cursor: not-allowed; }
.seat:hover:not(.occupied) { border-color: #2563eb; color: #2563eb; }

/* FORM STYLING */
h3 { margin: 0 0 0.5rem 0; font-size: 1.25rem; }
.subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }
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
.stats-footer { margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: #94a3b8; }
</style>