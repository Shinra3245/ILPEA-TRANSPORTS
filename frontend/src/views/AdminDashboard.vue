<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="brand">ILPEA <span>ADMIN</span></div>
      <nav class="nav-menu">
        <button 
          @click="irADashboard" 
          :class="['nav-item', { active: $route.path === '/admin' }]">
          Dashboard
        </button>
        <button 
          @click="irARutasApi" 
          :class="['nav-item', { active: $route.path === '/admin/rutas' }]">
          Gestionar Rutas
        </button>
        <button class="nav-item">Usuarios</button>
      </nav>
      <button @click="cerrarSesion" class="logout-btn">Cerrar Sesión</button>
    </aside>

    <main class="main-content">
      <header class="content-header">
        <div class="header-flex">
          <div>
            <h2>Estado Operativo de Red</h2>
            <p>Aforo mínimo para justificar ruta: <strong>40%</strong></p>
          </div>
          <button 
            @click="exportarTablaExcel" 
            :disabled="cargando || exportandoExcel || !!error" 
            class="btn-exportar excel-btn"
          >
            {{ exportandoExcel ? '⏳ Generando Excel...' : '📊 Exportar a Excel' }}
          </button>
        </div>
      </header>

      <section class="ia-container">
        <RecomendacionesIA />
      </section>

      <div v-if="cargando" class="status-box">Sincronizando con Backend...</div>
      <div v-else-if="error" class="status-box error-msg">
        <p>⚠️ {{ error }}</p>
        <button @click="obtenerRutas" class="btn-retry">Reintentar Conexión</button>
      </div>

      <div v-else class="dashboard-visuals">
        <div class="charts-filter">
          <label for="chart-select">Visualización:</label>
          <select id="chart-select" v-model="selectedChart" class="minimal-select">
            <option value="todos">Todos los indicadores</option>
            <option value="ocupacion">Ocupación por Ruta</option>
            <option value="capacidad">Distribución de Capacidad</option>
            <option value="alertas">Estado de Alertas</option>
          </select>
        </div>

        <div class="charts-grid">
          <div v-if="selectedChart === 'todos' || selectedChart === 'ocupacion'" class="chart-item" id="chart-ocupacion">
            <ChartOcupacion :rutas="rutas" />
          </div>
          <div v-if="selectedChart === 'todos' || selectedChart === 'capacidad'" class="chart-item" id="chart-capacidad">
            <ChartCapacidad :rutas="rutas" />
          </div>
          <div v-if="selectedChart === 'todos' || selectedChart === 'alertas'" class="chart-item chart-item-small" id="chart-alertas">
            <ChartAlertas :rutas="rutas" />
          </div>
        </div>

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
                <tr v-for="ruta in rutas" :key="ruta.id" :class="{ 'row-alert': ruta.porcentaje_ocupacion_max < 40 }">
                  <td><strong>Ruta {{ ruta.ruta }}</strong></td>
                  <td>{{ ruta['tipo de unidad'] }}</td>
                  <td>{{ ruta.capacidad_real }}</td>
                  <td>
                    <div class="occupancy-cell">
                      <div class="bar-bg">
                        <div class="bar-fill" 
                             :style="{ width: Math.min(ruta.porcentaje_ocupacion_max, 100) + '%' }"
                             :class="ruta.porcentaje_ocupacion_max < 40 ? 'low' : 'ok'">
                        </div>
                      </div>
                      <span>{{ ruta.porcentaje_ocupacion_max.toFixed(1) }}%</span>
                    </div>
                  </td>
                  <td>
                    <span :class="['tag', ruta.alerta_ocupacion === 'OK' ? 'tag-ok' : 'tag-alert']">
                      {{ ruta.alerta_ocupacion }}
                    </span>
                  </td>
                  <td class="no-print">
                    <button class="btn-manage">Control</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from 'vue-router';
import RecomendacionesIA from '../components/RecomendacionesIA.vue';
import ChartOcupacion from '../components/ChartOcupacion.vue';
import ChartCapacidad from '../components/ChartCapacidad.vue';
import ChartAlertas from '../components/ChartAlertas.vue';

interface Ruta {
  id: string;
  ruta: number;
  "tipo de unidad": string;
  capacidad_real: number;
  max_pasajeros_dia: number;
  porcentaje_ocupacion_max: number;
  alerta_ocupacion: string;
  sugerencia_right_sizing: string;
}

const rutas = ref<Ruta[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const router = useRouter();
const selectedChart = ref<string>('todos');

const obtenerRutas = async () => {
  cargando.value = true;
  error.value = null;

  try {
    const headers = await authHeaders();
    if (!headers.Authorization) {
      throw new Error('Sesión inválida. Inicia sesión de nuevo.');
    }

    const respuesta = await fetch(`${API_BASE_URL}/api/rutas`, { headers });
    
    if (!respuesta.ok) {
      throw new Error(`No fue posible cargar rutas (status ${respuesta.status}).`);
    }
    
    const json = await respuesta.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    rutas.value = data.sort((a: Ruta, b: Ruta) => a.ruta - b.ruta);
  } catch (err: any) {
    console.error('Falla en API:', err);
    error.value = err.message || 'No se pudieron cargar las rutas.';
  } finally {
    cargando.value = false;
  }
};

const exportandoExcel = ref(false);

const exportarTablaExcel = () => {
  exportandoExcel.value = true;
  
  try {
    const encabezados = ['Ruta', 'Tipo de Unidad', 'Capacidad', 'Ocupacion (%)', 'Sugerencia Sistema', 'Estado Logistico (Umbral 40%)'];

    const filas = rutas.value.map(ruta => {
      const estadoOperativo = ruta.porcentaje_ocupacion_max < 40 ? 'CANCELADA' : 'ACTIVADA';
      
      return [
        `"Ruta ${ruta.ruta}"`,
        `"${ruta['tipo de unidad']}"`,
        ruta.capacidad_real,
        ruta.porcentaje_ocupacion_max.toFixed(2),
        `"${ruta.sugerencia_right_sizing}"`,
        `"${estadoOperativo}"`
      ].join(','); 
    });

    const contenidoCsv = "\uFEFF" + encabezados.join(',') + '\n' + filas.join('\n');
    
    const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fechaHoy = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    link.setAttribute("download", `Reporte_ILPEA_${fechaHoy}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error('Error al generar Excel:', error);
    alert('Ocurrió un error al intentar exportar el reporte.');
  } finally {
    exportandoExcel.value = false;
  }
};

const irADashboard = () => router.push('/admin');
const irARutasApi = () => router.push('/admin/rutas');

const cerrarSesion = async () => {
  const { logout } = useAuth();
  await logout();
  router.push('/login');
};

onMounted(obtenerRutas);
</script>

<style scoped>
/* 1. RESTAURAMOS EL SCROLL NATURAL DE LA PÁGINA */
.admin-layout { 
  display: flex; 
  min-height: 100vh; /* Permite que la pantalla crezca hacia abajo de forma natural */
  background: #f8f9fa; 
  font-family: 'Inter', system-ui, sans-serif; 
  color: #1a1a1a; 
}

/* 2. EL MENÚ LATERAL AHORA ACOMPAÑA AL DOCUMENTO */
.sidebar { 
  width: 240px; 
  background: #000; 
  color: #fff; 
  padding: 2rem 1.5rem; 
  display: flex; 
  flex-direction: column; 
}

.brand { font-weight: 800; font-size: 1.2rem; margin-bottom: 3rem; }
.brand span { color: #666; font-weight: 400; }

/* 3. QUITAMOS EL FLEX:1 PARA QUE NO EMPUJE EL BOTÓN HACIA ABAJO */
.nav-menu { 
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 2rem; /* Separación directa entre "Usuarios" y "Cerrar Sesión" */
}

.nav-item { display: block; width: 100%; background: none; border: none; color: #888; text-align: left; padding: 0.8rem 0; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.nav-item.active, .nav-item:hover { color: #fff; }

/* 4. BOTÓN CERRAR SESIÓN (Sin margin-top: auto) */
.logout-btn { 
  background: #ef4444; 
  color: #ffffff; 
  padding: 0.8rem; 
  border: none;
  border-radius: 6px; 
  cursor: pointer; 
  font-weight: 700; 
  transition: background 0.3s; 
  width: 100%;
}
.logout-btn:hover { background: #dc2626; }

/* 5. CONTENIDO PRINCIPAL FLUYE NATURALMENTE */
.main-content { 
  flex: 1; 
  padding: 3rem; 
  /* Ya no necesita overflow-y: auto porque el body general se encarga del scroll */
}

.header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
.content-header { margin-bottom: 2rem; }
.content-header h2 { margin: 0; font-size: 1.5rem; }
.content-header p { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }

.btn-exportar { background: #000; color: #fff; border: none; padding: 0.7rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem; transition: 0.3s; }
.btn-exportar:hover { background: #333; }
.btn-exportar:disabled { background: #888; cursor: not-allowed; }
.excel-btn { background: #107c41; } 
.excel-btn:hover { background: #0c5e31; }

.charts-filter { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; font-size: 0.9rem; }
.minimal-select { padding: 0.5rem; border-radius: 6px; border: 1px solid #ddd; outline: none; background: #fff; }
.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
.chart-item { background: #fff; padding: 1.5rem; border-radius: 12px; border: 1px solid #e0e0e0; min-height: 300px; }
.chart-item-small { grid-column: span 1; }
.section-title { font-size: 1.1rem; margin-bottom: 1rem; color: #333; }

.pdf-wrapper { background-color: #ffffff; padding: 1.5rem; border-radius: 8px; }
.table-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 0; }
.minimal-table { width: 100%; border-collapse: collapse; }
.minimal-table th { background: #fafafa; padding: 1rem; text-align: left; font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
.minimal-table td { padding: 1.2rem 1rem; border-top: 1px solid #f0f0f0; font-size: 0.9rem; }

.minimal-table tr.row-alert td { background-color: #fef2f2 !important; }

.occupancy-cell { display: flex; align-items: center; gap: 12px; }
.bar-bg { flex: 1; background: #eee; height: 6px; border-radius: 10px; overflow: hidden; min-width: 100px; }
.bar-fill { height: 100%; transition: 0.4s ease; }
.bar-fill.ok { background-color: #10b981 !important; }
.bar-fill.low { background-color: #ef4444 !important; }

.tag { padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.tag-ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.tag-alert { background: #fff1f2; color: #991b1b; border: 1px solid #fecdd3; }

.status-box { padding: 4rem; text-align: center; color: #888; }
.error-msg { color: #ef4444; }
.btn-manage { background: none; border: 1px solid #ddd; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.btn-retry { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px; }

@media print {
  .no-print { display: none !important; }
}
</style>