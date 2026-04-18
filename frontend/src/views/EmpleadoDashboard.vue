<template>
  <ProtectedRoute requiere-rol="EMPLEADO">
    <div class="dashboard-container">
      <header class="header">
        <h1>ILPEA | Panel del Empleado</h1>
        <p>Tu ruta asignada y estado de viaje</p>
        <div class="usuario-info">
          <span>Bienvenido, {{ obtenerNombre() }}</span>
          <button @click="handleLogout" class="btn-logout">Cerrar Sesión</button>
        </div>
      </header>

      <main>
        <ProtectedRoute requiere-permiso="rutas:ver">
          <section class="rutas-section">
            <h2>Mi Ruta Asignada</h2>
            
            <div v-if="cargando" class="loading">
              Cargando tu ruta...
            </div>
            
            <div v-else-if="error" class="error">
              {{ error }}
            </div>
            
            <div v-else-if="miRuta" class="ruta-card">
              <div class="ruta-header">
                <h3>Ruta {{ miRuta.ruta }}</h3>
                <span :class="['estado-badge', estadoRuta]">{{ estadoRuta }}</span>
              </div>

              <div class="ruta-details">
                <div class="detail">
                  <span class="label">Tipo de Unidad:</span>
                  <span class="value">{{ miRuta['tipo de unidad'] }}</span>
                </div>
                <div class="detail">
                  <span class="label">Capacidad Real:</span>
                  <span class="value">{{ miRuta.capacidad_real }} pasajeros</span>
                </div>
                <div class="detail">
                  <span class="label">Ocupación Máxima del Día:</span>
                  <span class="value">{{ miRuta.max_pasajeros_dia }} pasajeros</span>
                </div>
                <div class="detail">
                  <span class="label">Porcentaje de Ocupación:</span>
                  <div class="progress-bar">
                    <div 
                      class="progress-fill"
                      :class="{ 'critical': miRuta.porcentaje_ocupacion_max < 40 }"
                      :style="{ width: Math.min(miRuta.porcentaje_ocupacion_max, 100) + '%' }"
                    ></div>
                  </div>
                  <span class="percentage">{{ miRuta.porcentaje_ocupacion_max.toFixed(1) }}%</span>
                </div>
                <div class="detail">
                  <span class="label">Alerta:</span>
                  <span :class="['alert-text', miRuta.alerta_ocupacion === 'OK' ? 'ok' : 'critical']">
                    {{ miRuta.alerta_ocupacion }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else class="no-data">
              <p>No tienes una ruta asignada en este momento.</p>
              <p>Contacta con tu Jefe de Turno para obtener una asignación.</p>
            </div>
          </section>
        </ProtectedRoute>

        <section class="info-section">
          <h2>ℹ️ Información Útil</h2>
          <div class="info-cards">
            <div class="card">
              <h4>¿Qué significa la ocupación?</h4>
              <p>
                Muestra qué porcentaje de la capacidad total de tu ruta está siendo utilizado.
                Si es mayor al 40%, la ruta es eficiente.
              </p>
            </div>
            <div class="card">
              <h4>Estado de tu Ruta</h4>
              <p>
                <strong>OK:</strong> Tu ruta está operando normalmente.<br>
                <strong>CRÍTICA:</strong> Tu ruta podría ser cancelada o modificada.
              </p>
            </div>
            <div class="card">
              <h4>¿Necesitas Ayuda?</h4>
              <p>Contacta directamente con tu Jefe de Turno para cualquier consulta sobre tu ruta asignada.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  </ProtectedRoute>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import ProtectedRoute from '../components/ProtectedRoute.vue';

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

const router = useRouter();
const { logout, obtenerNombre, authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const rutas = ref<Ruta[]>([]);
const miRuta = ref<Ruta | null>(null);
const cargando = ref(true);
const error = ref<string | null>(null);

const estadoRuta = computed(() => {
  if (!miRuta.value) return 'SIN ASIGNAR';
  return miRuta.value.alerta_ocupacion === 'OK' ? 'ACTIVA' : 'CRÍTICA';
});

const obtenerRutas = async () => {
  try {
    cargando.value = true;
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/rutas`, { headers });

    if (!respuesta.ok) throw new Error('Error obteniendo rutas');

    const datos = await respuesta.json();
    rutas.value = datos.data || [];

    // Simular que el empleado tiene asignada la primera ruta (o aleatoria)
    if (rutas.value.length > 0) {
      const primeraRuta = rutas.value[0];
      if (primeraRuta) {
        miRuta.value = primeraRuta;
      }
    }
  } catch (err: any) {
    error.value = err.message || 'Error cargando rutas';
    console.error('Error:', err);
  } finally {
    cargando.value = false;
  }
};

const handleLogout = () => {
  logout();
  router.push('/');
};

onMounted(() => {
  obtenerRutas();
});
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background-color: #f3f4f6;
}

.header {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}

.header h1 {
  margin: 0;
  font-size: 1.8rem;
}

.header p {
  margin: 0.5rem 0 0 0;
  opacity: 0.9;
}

.usuario-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-logout {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

main {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.rutas-section,
.info-section {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.rutas-section h2,
.info-section h2 {
  color: #1f2937;
  margin: 0 0 1.5rem 0;
}

.loading,
.error {
  padding: 2rem;
  text-align: center;
  background-color: #f9fafb;
  border-radius: 4px;
}

.error {
  background-color: #fee2e2;
  color: #991b1b;
}

.ruta-card {
  border: 2px solid #10b981;
  border-radius: 8px;
  overflow: hidden;
}

.ruta-header {
  background-color: #f0fdf4;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #10b981;
}

.ruta-header h3 {
  margin: 0;
  color: #047857;
}

.estado-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
}

.ruta-details {
  padding: 1.5rem;
}

.detail {
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.detail:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.label {
  font-weight: 600;
  color: #4b5563;
}

.value {
  color: #1f2937;
}

.progress-bar {
  width: 100%;
  height: 24px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
  transition: width 0.3s;
}

.progress-fill.critical {
  background: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
}

.percentage {
  font-size: 0.9rem;
  color: #4b5563;
  font-weight: 600;
}

.alert-text {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-weight: 600;
}

.alert-text.ok {
  background-color: #dcfce7;
  color: #166534;
}

.alert-text.critical {
  background-color: #fee2e2;
  color: #991b1b;
}

.no-data {
  padding: 2rem;
  text-align: center;
  background-color: #f9fafb;
  border-radius: 4px;
  color: #4b5563;
}

.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  background-color: #f9fafb;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #10b981;
}

.card h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.card p {
  margin: 0;
  color: #4b5563;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
