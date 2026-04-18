<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="brand">ILPEA <span>ADMIN</span></div>
      <nav class="nav-menu">
        <button class="nav-item active">Dashboard</button>
        <button @click="irARutasApi" class="nav-item">Gestionar Rutas</button>
        <button class="nav-item">Usuarios</button>
      </nav>
      <button @click="cerrarSesion" class="logout-btn">Cerrar Sesión</button>
    </aside>

    <main class="main-content">
      <header class="content-header">
        <h2>Estado Operativo de Red</h2>
        <p>Aforo mínimo para justificar ruta: <strong>40%</strong></p>
      </header>

      <section class="ia-container">
        <RecomendacionesIA />
      </section>

      <div v-if="cargando" class="status-box">Sincronizando con Backend...</div>
      <div v-else-if="error" class="status-box error-msg">
        <p>⚠️ {{ error }}</p>
        <button @click="obtenerRutas" class="btn-retry">Reintentar Conexión</button>
      </div>

      <div v-else class="table-card">
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import RecomendacionesIA from '../components/RecomendacionesIA.vue';

const router = useRouter();
const rutas = ref<any[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);

const obtenerRutas = async () => {
  try {
    cargando.value = true;
    error.value = null;

    // Asegúrate que el backend de Node esté corriendo en el puerto 3000
    const res = await fetch('http://localhost:3000/api/rutas');
    
    if (!res.ok) throw new Error(`Servidor no disponible (Status: ${res.status})`);
    
    const json = await res.json();
    
    // Validación de estructura de datos
    if (json && json.data) {
      rutas.value = json.data.sort((a: any, b: any) => a.ruta - b.ruta);
    } else {
      rutas.value = json; // Caso donde el array venga directo
    }
  } catch (e: any) {
    console.error("Falla en API:", e);
    error.value = "No se pudo conectar con la base de datos. Verifica el Backend.";
  } finally {
    cargando.value = false;
  }
};

const irARutasApi = () => console.log("Llamando a módulo de rutas...");
const cerrarSesion = () => {
  localStorage.removeItem('userRole');
  router.push('/login');
};

onMounted(obtenerRutas);
</script>

<style scoped>
/* Reset Minimalista */
.admin-layout { display: flex; min-height: 100vh; background: #f8f9fa; font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; }

/* Sidebar Estilo OCI */
.sidebar { width: 240px; background: #000; color: #fff; padding: 2rem 1.5rem; display: flex; flex-direction: column; }
.brand { font-weight: 800; font-size: 1.2rem; margin-bottom: 3rem; }
.brand span { color: #666; font-weight: 400; }
.nav-menu { flex: 1; }
.nav-item { display: block; width: 100%; background: none; border: none; color: #888; text-align: left; padding: 0.8rem 0; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.nav-item.active, .nav-item:hover { color: #fff; }
.logout-btn { background: none; border: 1px solid #333; color: #888; padding: 0.6rem; border-radius: 6px; cursor: pointer; }

/* Main Content */
.main-content { flex: 1; padding: 3rem; overflow-y: auto; }
.content-header { margin-bottom: 2rem; }
.content-header h2 { margin: 0; font-size: 1.5rem; }
.content-header p { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }

/* Tablas y Cards */
.table-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; }
.minimal-table { width: 100%; border-collapse: collapse; }
.minimal-table th { background: #fafafa; padding: 1rem; text-align: left; font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
.minimal-table td { padding: 1.2rem 1rem; border-top: 1px solid #f0f0f0; font-size: 0.9rem; }

/* Barras de Ocupación */
.occupancy-cell { display: flex; align-items: center; gap: 12px; }
.bar-bg { flex: 1; background: #eee; height: 6px; border-radius: 10px; overflow: hidden; }
.bar-fill { height: 100%; transition: 0.4s ease; }
.bar-fill.ok { background: #10b981; }
.bar-fill.low { background: #ef4444; }

/* Tags de Estado */
.tag { padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }
.tag-ok { background: #ecfdf5; color: #065f46; }
.tag-alert { background: #fef2f2; color: #991b1b; }

.row-alert { background-color: #fffafa; }
.status-box { padding: 4rem; text-align: center; color: #888; }
.error-msg { color: #ef4444; }
.btn-manage { background: none; border: 1px solid #ddd; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.btn-retry { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px; }
</style>