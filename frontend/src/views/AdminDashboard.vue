<template>
  <div class="dashboard-container">
    <header class="header">
      <h1>ILPEA | Admin Dashboard</h1>
      <p>Control de Optimización Logística y Right-Sizing</p>
    </header>

    <main>
        <RecomendacionesIA />
      <div v-if="cargando" class="loading">
        Cargando datos desde Firebase...
      </div>
      
      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <div v-else>
        <!-- Sección de Gráficos -->
        <div class="charts-section">
          <div class="charts-grid">
            <div class="chart-item">
              <ChartOcupacion :rutas="rutas" />
            </div>
            <div class="chart-item">
              <ChartCapacidad :rutas="rutas" />
            </div>
            <div class="chart-item chart-item-small">
              <ChartAlertas :rutas="rutas" />
            </div>
          </div>
        </div>

        <!-- Tabla de Detalle -->
        <h2 class="section-title">Detalle de Rutas</h2>
      </div>

      <div v-if="!cargando && !error" class="table-wrapper">
        <table class="rutas-table">
          <thead>
            <tr>
              <th>Ruta</th>
              <th>Tipo de Unidad</th>
              <th>Capacidad Real</th>
              <th>Pico Pasajeros</th>
              <th>Ocupación Máxima</th>
              <th>Alerta (Regla 40%)</th>
              <th>Right-Sizing</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="ruta in rutas" 
              :key="ruta.id"
              :class="{ 'fila-peligro': ruta.alerta_ocupacion.includes('CANCELAR') }"
            >
              <td><strong>{{ ruta.ruta }}</strong></td>
              <td>{{ ruta['tipo de unidad'] }}</td>
              <td>{{ ruta.capacidad_real }}</td>
              <td>{{ ruta.max_pasajeros_dia }}</td>
              
              <td>
                <div class="barra-contenedor">
                  <div 
                    class="barra-progreso" 
                    :style="{ width: Math.min(ruta.porcentaje_ocupacion_max, 100) + '%' }"
                    :class="{ 'bg-rojo': ruta.porcentaje_ocupacion_max < 40, 'bg-verde': ruta.porcentaje_ocupacion_max >= 40 }"
                  ></div>
                </div>
                <span class="porcentaje-texto">{{ ruta.porcentaje_ocupacion_max.toFixed(1) }}%</span>
              </td>
              
              <td>
                <span :class="['badge', ruta.alerta_ocupacion === 'OK' ? 'badge-ok' : 'badge-alerta']">
                  {{ ruta.alerta_ocupacion }}
                </span>
              </td>
              
              <td>
                <button 
                  v-if="ruta.sugerencia_right_sizing.includes('CAMBIAR')" 
                  class="btn-cambio"
                >
                  {{ ruta.sugerencia_right_sizing }}
                </button>
                <span v-else class="texto-mantener">
                  {{ ruta.sugerencia_right_sizing }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import RecomendacionesIA from '../components/RecomendacionesIA.vue';
import ChartOcupacion from '../components/ChartOcupacion.vue';
import ChartCapacidad from '../components/ChartCapacidad.vue';
import ChartAlertas from '../components/ChartAlertas.vue';
import { ref, onMounted } from 'vue';

// 1. Definición del Modelo de Datos (TypeScript)
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

// 2. Variables Reactivas
const rutas = ref<Ruta[]>([]);
const cargando = ref<boolean>(true);
const error = ref<string | null>(null);

// 3. Función para consumir la API de Node.js
const obtenerRutas = async () => {
  try {
    // Apuntamos al servidor de Node.js que creamos en el Frente 2
    const respuesta = await fetch('http://localhost:3000/api/rutas');
    
    if (!respuesta.ok) throw new Error('Error al conectar con el servidor');
    
    const json = await respuesta.json();
    
    // Asignamos la data cruda a nuestra variable reactiva
    // Ordenamos las rutas numéricamente para mejor lectura
    rutas.value = json.data.sort((a: Ruta, b: Ruta) => a.ruta - b.ruta);
    
  } catch (err) {
    error.value = 'No se pudieron cargar las rutas. Verifica que Node.js esté corriendo.';
    console.error(err);
  } finally {
    cargando.value = false;
  }
};

// 4. Ejecutar al montar el componente
onMounted(() => {
  obtenerRutas();
});
</script>

<style scoped>
/* Estilos Base para el MVP */
.dashboard-container {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  padding: 2rem;
  background-color: #f8fafc;
  min-height: 100vh;
  color: #0f172a; 
}

.header {
  margin-bottom: 2rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 1rem;
}

.header h1 {
  margin: 0;
  color: #1e293b;
}

.header p {
  color: #64748b;
  margin-top: 0.5rem;
}

/* Tabla Estilos */
.table-wrapper {
  overflow-x: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.rutas-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.rutas-table th, .rutas-table td {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  color: #334155; 
}

.rutas-table th {
  background-color: #f1f5f9;
  color: #475569;
  font-weight: 600;
}

/* Formato Condicional (Reglas de Negocio) */
.fila-peligro {
  background-color: #fef2f2;
}

/* Barra de Ocupación */
.barra-contenedor {
  width: 100%;
  background-color: #e2e8f0;
  border-radius: 4px;
  height: 8px;
  margin-bottom: 4px;
  overflow: hidden;
}

.barra-progreso {
  height: 100%;
  transition: width 0.3s ease;
}

.bg-rojo { background-color: #ef4444; }
.bg-verde { background-color: #22c55e; }
.porcentaje-texto { font-size: 0.85rem; color: #475569; }

/* Badges y Botones */
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: bold;
}

.badge-ok {
  background-color: #dcfce7;
  color: #166534;
}

.badge-alerta {
  background-color: #fee2e2;
  color: #991b1b;
}

.btn-cambio {
  background-color: #eab308;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.btn-cambio:hover {
  background-color: #ca8a04;
}

.texto-mantener {
  color: #64748b;
  font-size: 0.9rem;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
  color: #475569;
}

.error {
  color: #ef4444;
}

/* Sección de Gráficos */
.charts-section {
  margin-bottom: 2rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.chart-item {
  width: 100%;
}

.chart-item-small {
  grid-column: 1;
  max-width: 450px;
}

.section-title {
  color: #1e293b;
  font-size: 1.3rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5rem;
}

/* Responsive para pantallas pequeñas */
@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-item-small {
    grid-column: 1;
    max-width: 100%;
  }
}
</style>