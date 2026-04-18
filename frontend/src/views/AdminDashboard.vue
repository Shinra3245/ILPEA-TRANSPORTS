<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="brand">ILPEA <span>ADMIN</span></div>
      <nav class="nav-menu">
        <button class="nav-item active">Dashboard</button>
        <button @click="irARutasApi" class="nav-item">Gestionar Rutas</button>
        <button @click="irAUsuarios" class="nav-item">Usuarios</button>
      </nav>
      <button @click="cerrarSesion" class="logout-btn">Cerrar Sesión</button>
    </aside>

    <main class="main-content">
      <header class="content-header">
        <div>
          <h2>Estado Operativo de Red</h2>
          <p>Aforo mínimo para justificar ruta: <strong>40%</strong></p>
        </div>
      </header>

      <div v-if="cargando" class="status-box">Sincronizando con Backend...</div>
      <div v-else-if="error" class="status-box error-msg">
        <p>⚠️ {{ error }}</p>
        <button @click="obtenerRutas" class="btn-retry">Reintentar Conexión</button>
      </div>

      <template v-else>
        <section class="ia-container">
          <RecomendacionesIA />
        </section>

        <div class="tools-bar">
          <div class="charts-filter">
            <label for="chart-select">Visualización:</label>
            <select id="chart-select" v-model="selectedChart" class="minimal-select">
              <option value="todos">Todos los indicadores</option>
              <option value="ocupacion">Ocupación por Ruta</option>
              <option value="capacidad">Distribución de Capacidad</option>
              <option value="alertas">Estado de Alertas</option>
            </select>
          </div>
          <button @click="exportarTodosPDF" :disabled="cargando || !!error" class="btn-exportar">
            📄 Exportar PDF
          </button>
        </div>

        <div class="charts-grid">
          <div v-if="selectedChart === 'todos' || selectedChart === 'ocupacion'" class="chart-item" id="chart-ocupacion">
            <ChartOcupacion :rutas="rutas" />
          </div>

          <div v-if="selectedChart === 'todos' || selectedChart === 'capacidad'" class="chart-item" id="chart-capacidad">
            <ChartCapacidad :rutas="rutas" />
          </div>

          <div v-if="selectedChart === 'todos' || selectedChart === 'alertas'" class="chart-item" id="chart-alertas">
            <ChartAlertas :rutas="rutas" />
          </div>
        </div>

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
                <th>Acción</th>
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
                <td>
                  <button class="btn-manage">Control</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
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
import { exportMultipleToPDF } from '../utils/exportPdf';

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

const exportarTodosPDF = async () => {
  const fechaHoy = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
  const nombreArchivo = `Reporte_ILPEA_${fechaHoy}`;
  try {
    await exportMultipleToPDF(
      ['chart-ocupacion', 'chart-capacidad', 'chart-alertas'],
      nombreArchivo
    );
  } catch (error) {
    console.error('Error al exportar reporte:', error);
  }
};

const irARutasApi = () => {
  router.push('/admin/rutas');
};

const irAUsuarios = () => {
  router.push('/admin/usuarios');
};

const cerrarSesion = async () => {
  const { logout } = useAuth();
  await logout();
  router.push('/login');
};

onMounted(obtenerRutas);
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #fff;
  width: 100%;
}

.sidebar {
  width: 240px;
  background: #000;
  color: #fff;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #111;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.brand {
  font-weight: 800;
  font-size: 1.2rem;
  margin-bottom: 3rem;
}

.brand span {
  color: #666;
  font-weight: 400;
}

.nav-menu {
  flex: 1;
}

.nav-item {
  display: block;
  width: 100%;
  background: none;
  border: none;
  color: #888;
  text-align: left;
  padding: 0.8rem 0;
  cursor: pointer;
  transition: color 0.2s;
  font-size: 0.9rem;
}

.nav-item:hover {
  color: #fff;
}

.nav-item.active {
  color: #fff;
}

.logout-btn {
  background: none;
  border: 1px solid #333;
  color: #888;
  padding: 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.logout-btn:hover {
  color: #fff;
  border-color: #555;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 2.5rem 3rem;
}

.content-header {
  margin-bottom: 3rem;
}

.content-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
  font-weight: 600;
  color: #000;
}

.content-header p {
  margin: 0;
  color: #666;
  font-size: 0.95rem;
}

.ia-container {
  margin-bottom: 3rem;
}

.tools-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
  gap: 2rem;
}

.charts-filter {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.95rem;
}

.charts-filter label {
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

.minimal-select {
  padding: 0.6rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  background: white;
  cursor: pointer;
  color: #333;
  transition: border-color 0.2s;
}

.minimal-select:hover {
  border-color: #999;
}

.minimal-select:focus {
  outline: none;
  border-color: #333;
}

.btn-exportar {
  padding: 0.6rem 1.2rem;
  background: #000;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: background 0.2s;
  white-space: nowrap;
}

.btn-exportar:hover:not(:disabled) {
  background: #222;
}

.btn-exportar:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

@media (min-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr 1fr;
  }

  .charts-grid > :nth-child(3) {
    grid-column: 1;
  }
}

.chart-item {
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  min-height: 350px;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 3rem 0 1.5rem 0;
  color: #000;
}

.table-card {
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;
}

.minimal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.minimal-table thead {
  background: #f9f9f9;
}

.minimal-table th {
  padding: 1rem 1.2rem;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e5e5e5;
}

.minimal-table td {
  padding: 1rem 1.2rem;
  border-bottom: 1px solid #f5f5f5;
  color: #333;
}

.minimal-table tbody tr {
  transition: background 0.2s;
}

.minimal-table tbody tr:hover {
  background: #fafafa;
}

.minimal-table tbody tr.row-alert {
  background: #fef5f5;
}

.occupancy-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}

.bar-bg {
  flex: 1;
  height: 6px;
  background: #e5e5e5;
  border-radius: 3px;
  overflow: hidden;
  min-width: 80px;
}

.bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.bar-fill.ok {
  background: #333;
}

.bar-fill.low {
  background: #d32f2f;
}

.tag {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: 600;
}

.tag-ok {
  background: #f5f5f5;
  color: #333;
}

.tag-alert {
  background: #ffebee;
  color: #c62828;
}

.btn-manage {
  padding: 0.5rem 0.9rem;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  color: #333;
  transition: all 0.2s;
}

.btn-manage:hover {
  background: #eeeeee;
  border-color: #999;
}

.status-box {
  padding: 1.5rem;
  margin: 2rem 0;
  background: #f5f5f5;
  border-radius: 4px;
  text-align: center;
  color: #666;
  border-left: 3px solid #999;
}

.error-msg {
  color: #c62828;
  background: #ffebee !important;
  border-left-color: #c62828 !important;
}

.btn-retry {
  margin-top: 1rem;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  background: #000;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-retry:hover {
  background: #222;
}

@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    padding: 1rem;
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }

  .brand {
    padding: 0;
    margin-bottom: 0;
  }

  .nav-menu {
    flex-direction: row;
    flex: 1;
    display: flex;
    gap: 0;
  }

  .nav-item {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }

  .main-content {
    padding: 1.5rem;
  }

  .tools-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>