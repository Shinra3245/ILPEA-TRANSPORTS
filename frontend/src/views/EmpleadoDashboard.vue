<template>
  <ProtectedRoute requiere-rol="EMPLEADO">
    <div class="dashboard-container">
      <header class="header">
        <h1>ILPEA | Panel del Empleado</h1>
        <p>Consulta y gestiona tu asiento asignado</p>
        <div class="usuario-info">
          <span>Bienvenido, {{ obtenerNombre() }}</span>
          <button @click="handleLogout" class="btn-logout">Cerrar Sesión</button>
        </div>
      </header>

      <main>
        <ProtectedRoute requiere-permiso="rutas:ver">
          <section class="rutas-section">
            <h2>Mi Asignación</h2>

            <div v-if="cargando" class="loading">Cargando tu asignación...</div>

            <div v-else-if="error" class="error">{{ error }}</div>

            <div v-else-if="asignacion" class="ruta-card">
              <div class="ruta-header">
                <h3>Detalle del viaje</h3>
              </div>

              <div class="ruta-details">
                <div class="detail">
                  <span class="label">Ruta:</span>
                  <span class="value">{{ asignacion.ruta }}</span>
                </div>
                <div class="detail">
                  <span class="label">Asiento:</span>
                  <span class="value">{{ asignacion.asiento }}</span>
                </div>
                <div class="detail">
                  <span class="label">Día:</span>
                  <span class="value">{{ asignacion.fecha }}</span>
                </div>
                <div class="detail">
                  <span class="label">Turno:</span>
                  <span class="value">{{ asignacion.turno }}</span>
                </div>
              </div>

              <div class="acciones-card">
                <button
                  class="btn-cancelar"
                  :disabled="cancelando"
                  @click="cancelarAsiento"
                >
                  {{ cancelando ? 'Cancelando...' : 'Cancelar asiento' }}
                </button>
                <p v-if="mensaje" class="status-ok">{{ mensaje }}</p>
              </div>
            </div>

            <div v-else class="no-data">
              <p>No tienes una asignación activa.</p>
              <p>Contacta a tu Jefe de Turno para una nueva asignación.</p>
            </div>
          </section>
        </ProtectedRoute>
      </main>
    </div>
  </ProtectedRoute>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import ProtectedRoute from '../components/ProtectedRoute.vue';

interface Asignacion {
  idRuta: string;
  ruta: string;
  asiento: number;
  fecha: string;
  turno: string;
}

type MiRutaApi = {
  id_ruta?: unknown;
  ruta?: unknown;
  asiento_asignado?: unknown;
  nombre?: unknown;
  zona?: unknown;
  nombre_ruta?: unknown;
} & Record<string, unknown>;

const router = useRouter();
const { logout, obtenerNombre, authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const asignacion = ref<Asignacion | null>(null);
const cargando = ref(true);
const error = ref<string | null>(null);
const mensaje = ref<string | null>(null);
const cancelando = ref(false);

const numeroSeguro = (valor: unknown, fallback = 0): number => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
};

const textoSeguro = (valor: unknown, fallback = 'N/D'): string => {
  const texto = String(valor ?? '').trim();
  return texto || fallback;
};

const obtenerRutas = async () => {
  try {
    cargando.value = true;
    error.value = null;
    mensaje.value = null;

    const headers = await authHeaders();
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams({ fecha: fechaHoy });

    const respuesta = await fetch(`${API_BASE_URL}/api/empleado/mi-ruta?${params.toString()}`, { headers });

    if (!respuesta.ok) throw new Error('Error obteniendo tu ruta asignada');

    const datos = await respuesta.json();
    const data: MiRutaApi | null = datos?.data || null;
    const asiento = numeroSeguro(data?.asiento_asignado, 0);

    if (!data || !data.id_ruta || asiento <= 0) {
      asignacion.value = null;
      return;
    }

    asignacion.value = {
      idRuta: textoSeguro(data.id_ruta, ''),
      ruta: textoSeguro(
        data.nombre_ruta,
        textoSeguro(
          data.zona,
          textoSeguro(data.nombre, `Ruta ${numeroSeguro(data.ruta, 0)}`)
        )
      ),
      asiento,
      fecha: textoSeguro(datos?.fecha, fechaHoy),
      turno: textoSeguro(datos?.turno, 'Sin turno')
    };
  } catch (err: any) {
    error.value = err.message || 'Error cargando rutas';
    asignacion.value = null;
    console.error('Error:', err);
  } finally {
    cargando.value = false;
  }
};

const cancelarAsiento = async () => {
  if (!asignacion.value) {
    return;
  }

  try {
    cancelando.value = true;
    error.value = null;
    mensaje.value = null;

    const headers = await authHeaders();

    const respuesta = await fetch(`${API_BASE_URL}/api/asignar/cancelar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        id_ruta: asignacion.value.idRuta,
        fecha: asignacion.value.fecha,
        turno: asignacion.value.turno,
        asiento: asignacion.value.asiento
      })
    });

    const payload = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || payload?.success === false) {
      throw new Error(payload?.message || 'No se pudo cancelar tu asiento.');
    }

    mensaje.value = 'Asiento cancelado correctamente.';
    asignacion.value = null;
  } catch (err: any) {
    error.value = err.message || 'No se pudo cancelar el asiento.';
  } finally {
    cancelando.value = false;
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

.acciones-card {
  padding: 0 1.5rem 1.5rem;
}

.btn-cancelar {
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 0.8rem 1rem;
  background-color: #dc2626;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.btn-cancelar:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.status-ok {
  margin: 0.75rem 0 0;
  color: #166534;
  font-weight: 600;
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

/* RESPONSIVIDAD PARA MÓVILES Y TABLETS */
@media (max-width: 768px) {
  .header { flex-direction: column; align-items: flex-start; gap: 1.5rem; padding: 1.5rem 1rem; }
  .usuario-info { flex-direction: column; width: 100%; align-items: stretch; gap: 1rem; }
  .btn-logout { width: 100%; text-align: center; }
  
  main { padding: 1rem; }
  .rutas-section, .info-section { padding: 1.5rem 1rem; }
  
  .ruta-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .detail { grid-template-columns: 1fr; gap: 0.2rem; border-bottom: none; margin-bottom: 1.5rem; }
  .ruta-details { padding: 1rem; }
  .acciones-card { padding: 0 1rem 1rem; }
  
  .info-cards { grid-template-columns: 1fr; }
}
</style>
