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
          :class="['nav-item', { active: $route.path === '/admin/rutas' }]">
          Gestionar Rutas
        </button>
        
        <button 
  @click="irAUsuarios" 
  :class="['nav-item', { active: $route.path === '/admin/usuarios' }]">
  Usuarios
</button>

        <button
          @click="irAAsignaciones"
          :class="['nav-item', { active: $route.path === '/admin/asignaciones' }]">
          Asignaciones
        </button>
      </nav>
      <button @click="cerrarSesion" class="logout-btn">Cerrar Sesión</button>
    </aside>

    <main class="main-content">
      <header class="content-header">
        <div class="header-flex">
          <div>
            <h2>Gestión y Monitoreo en Tiempo Real</h2>
            <p>Rastreo GPS de unidades operativas mediante <strong>Samsara</strong>.</p>
          </div>
        </div>
      </header>

      <h3 class="section-title">Rutas Activas</h3>
      <div class="table-card">
        <table class="minimal-table">
          <thead>
            <tr>
              <th>ID Ruta</th>
              <th>Destino / Zona</th>
              <th>Código de Unidad</th>
              <th>Estado de Rastreo</th>
              <th>Acción GPS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ruta in rutasSamsara" :key="ruta.id">
              <td><strong>Ruta {{ ruta.numero }}</strong></td>
              <td>{{ ruta.destino }}</td>
              <td><span class="tag tag-ok">{{ ruta.codigo_unidad }}</span></td>
              <td>
                <div class="status-cell">
                  <span class="dot-live"></span> Transmitiendo
                </div>
              </td>
              <td>
                <a :href="ruta.link" target="_blank" rel="noopener noreferrer" class="btn-samsara">
                  📍 Ver en Mapa
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();

// Interfaz TypeScript para el tipado estricto
interface RutaSamsara {
  id: string;
  numero: string;
  destino: string;
  codigo_unidad: string;
  link: string;
}

// Catálogo estático de rutas proporcionado
const rutasSamsara = ref<RutaSamsara[]>([
  { id: '1', numero: '01', destino: 'APASEO EL GRANDE', codigo_unidad: 'E0234', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/lBalLAGH1nOFRMquWZtj' },
  { id: '2', numero: '02', destino: 'RANCHERIAS', codigo_unidad: 'E0322', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/SOMheubsCHWA8dXcgb4e' },
  { id: '3', numero: '03', destino: 'QUERETARO OBRERA', codigo_unidad: 'C0008', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/lx8gXOozwGTPq0tZNOEA' },
  { id: '4', numero: '04', destino: 'QUERETARO CARRILLO', codigo_unidad: 'C0068', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/VMGMOM6ukDVfR2QaWaoQ' },
  { id: '6', numero: '06', destino: 'FUENTES DE BALVANERA', codigo_unidad: 'C0036', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/gjlNSxi5GEgDu7fKZYZn' },
  { id: '7', numero: '07', destino: 'CELAYA', codigo_unidad: 'C0056', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/TXuwHMotHrvxnBOc6BXb' },
  { id: '8', numero: '08', destino: 'SAN MIGUEL OCTOPAN', codigo_unidad: 'E0334', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/9feSjFeZN7RqjxOergxl' },
  { id: '9', numero: '09', destino: 'APASEO EL ALTO', codigo_unidad: 'E0372', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/1VUuTytBwuaO0UNjpaTY' },
  { id: '10', numero: '10', destino: 'TIERRA BLANCA', codigo_unidad: 'C0126', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/route/32848/2MaAXc5bDi6iLOvUrewL' },
  { id: '14', numero: '14', destino: 'PICACHO', codigo_unidad: 'C0118', link: 'https://cloud.samsara.com/o/32848/fleet/viewer/Glz8p8yZR51uiVx6bvXQ' },
]);

// Navegación y Sesión
const irADashboard = () => {
  router.push('/admin');
};

// Agrega esta función debajo de irADashboard
const irAUsuarios = () => {
  router.push('/admin/usuarios');
};

const irAAsignaciones = () => {
  router.push('/admin/asignaciones');
};

const cerrarSesion = async () => {
  const { logout } = useAuth();
  await logout();
  router.push('/login');
};
</script>

<style scoped>
/* 1. SCROLL NATURAL DE LA PÁGINA (Igual al Dashboard) */
.admin-layout { 
  display: flex; 
  min-height: 100vh; 
  background: #f8f9fa; 
  font-family: 'Inter', system-ui, sans-serif; 
  color: #1a1a1a; 
}

/* 2. MENÚ LATERAL ACOMPAÑA AL DOCUMENTO */
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

/* 3. ALINEACIÓN DEL MENÚ */
.nav-menu { 
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 2rem; 
}

.nav-item { display: block; width: 100%; background: none; border: none; color: #888; text-align: left; padding: 0.8rem 0; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.nav-item.active, .nav-item:hover { color: #fff; }

/* 4. BOTÓN CERRAR SESIÓN ESTANDARIZADO ROJO */
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
}

.header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
.content-header { margin-bottom: 2rem; }
.content-header h2 { margin: 0; font-size: 1.5rem; }
.content-header p { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }
.section-title { font-size: 1.1rem; margin-bottom: 1rem; color: #333; }

/* Tabla y Cards Específicos de esta vista */
.table-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; }
.minimal-table { width: 100%; border-collapse: collapse; }
.minimal-table th { background: #fafafa; padding: 1rem; text-align: left; font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
.minimal-table td { padding: 1.2rem 1rem; border-top: 1px solid #f0f0f0; font-size: 0.9rem; vertical-align: middle; }

/* Tags de Estado */
.tag { padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
.tag-ok { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

/* Indicador Live Samsara */
.status-cell { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #059669; font-weight: 500; }
.dot-live { width: 8px; height: 8px; background-color: #10b981; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; }

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

/* Botón Samsara */
.btn-samsara { display: inline-block; background: #0f172a; color: #fff; padding: 0.6rem 1rem; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 600; transition: background 0.3s; }
.btn-samsara:hover { background: #334155; }

/* RESPONSIVIDAD PARA MÓVILES Y TABLETS */
@media (max-width: 768px) {
  .admin-layout { flex-direction: column; }
  .sidebar { width: 100%; padding: 1.5rem; flex-direction: column; align-items: center; }
  .brand { margin-bottom: 1.5rem; }
  .nav-menu { width: 100%; }
  .nav-item { text-align: center; }
  .main-content { padding: 1.5rem 1rem; }
  .header-flex { flex-direction: column; gap: 1rem; }
  
  /* Habilita scroll horizontal en la tabla de unidades GPS */
  .table-card { overflow-x: auto; }
  .minimal-table { min-width: 600px; }
}
</style>