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
            <h2>Estado Operativo de Red</h2>
            <p>Aforo mínimo para justificar ruta: <strong>40%</strong></p>
          </div>
          <div class="button-group">
            <button 
              @click="exportarTablaExcel" 
              :disabled="cargando || exportandoExcel || !!error" 
              class="btn-exportar excel-btn"
            >
              {{ exportandoExcel ? '⏳ Generando Programación...' : '📊 Exportar Programación Rutas' }}
            </button>

            <button 
              @click="exportarAsignacionesExcel" 
              :disabled="cargando || exportandoAsignaciones || !!error" 
              class="btn-exportar assignments-btn"
            >
              {{ exportandoAsignaciones ? '⏳ Generando Catálogo...' : '📋 Exportar Catálogo Asignaciones' }}
            </button>
          </div>
        </div>
      </header>

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
          <div v-show="selectedChart === 'todos' || selectedChart === 'ocupacion'" class="chart-item" id="chart-ocupacion">
            <ChartOcupacion :rutas="rutas" />
          </div>
          <div v-show="selectedChart === 'todos' || selectedChart === 'capacidad'" class="chart-item" id="chart-capacidad">
            <ChartCapacidad :rutas="rutas" />
          </div>
          <div v-show="selectedChart === 'todos' || selectedChart === 'alertas'" class="chart-item chart-item-small" id="chart-alertas">
            <ChartAlertas :rutas="rutas" />
          </div>
        </div>

        <section class="ia-block">
          <h3 class="section-title">Recomendaciones IA</h3>
          <RecomendacionesIA />
        </section>

        <section class="ia-block">
          <div class="section-header-inline">
            <h3 class="section-title">Planes IA Ejecutados Recientes</h3>
            <button
              class="btn-manage"
              @click="obtenerPlanesIA"
              :disabled="cargandoPlanes"
            >
              {{ cargandoPlanes ? 'Actualizando...' : 'Actualizar' }}
            </button>
          </div>

          <div v-if="cargandoPlanes" class="status-box">Cargando planes IA...</div>
          <div v-else-if="errorPlanes" class="status-box error-msg">{{ errorPlanes }}</div>
          <div v-else-if="!planesIA.length" class="status-box">No hay planes IA ejecutados para mostrar.</div>

          <div v-else class="planes-grid">
            <article v-for="plan in planesIA" :key="plan.id" class="plan-card">
              <div class="plan-card-head">
                <h4>{{ plan.ruta_origen_id }} -> {{ plan.ruta_destino_id }}</h4>
                <span :class="['tag', `impact-${plan.estado_impacto}`]">{{ plan.estado_impacto.toUpperCase() }}</span>
              </div>
              <p><strong>Fecha:</strong> {{ plan.fecha }} ({{ plan.turno || 'sin turno' }})</p>
              <p><strong>Movidos:</strong> {{ plan.cantidad_empleados_movidos }} empleados</p>
              <p><strong>Motivo:</strong> {{ plan.motivo || 'Sin motivo' }}</p>
            </article>
          </div>
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
                  <th>Estado IA</th>
                  <th class="no-print">Acción</th> 
                </tr>
              </thead>
              <tbody>
                <tr v-for="ruta in rutas" :key="ruta.ruta" :class="{ 'row-alert': ruta.porcentaje_ocupacion_max < 40 }">
                  <td><strong>Ruta {{ ruta.ruta }}</strong></td>
                  <td>{{ ruta['tipo de unidad'] }}</td>
                  <td>{{ ruta.capacidad_real }} asientos</td>
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
                    <span :class="['tag', ruta.porcentaje_ocupacion_max < 40 ? 'tag-alert' : 'tag-ok']">
                      {{ ruta.porcentaje_ocupacion_max < 40 ? 'BAJA OCUPACIÓN' : 'ÓPTIMO' }}
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

    <CopilotoChat scope="ADMIN" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useRouter } from 'vue-router';
// Importamos ExcelJS y FileSaver
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import RecomendacionesIA from '../components/RecomendacionesIA.vue';
import ChartOcupacion from '../components/ChartOcupacion.vue';
import ChartCapacidad from '../components/ChartCapacidad.vue';
import ChartAlertas from '../components/ChartAlertas.vue';
import CopilotoChat from '../components/CopilotoChat.vue';

// --- INTERFACES ---
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

interface PlanIA {
  id: string;
  fecha: string;
  turno: string | null;
  ruta_origen_id: string;
  ruta_destino_id: string;
  cantidad_empleados_movidos: number;
  estado_impacto: 'alto' | 'medio' | 'bajo';
  motivo: string | null;
}

// Nueva interfaz basada en la imagen proporcionada (Catálogo Asignaciones)
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

// --- ESTADOS REACtivos ---
const rutas = ref<Ruta[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const router = useRouter();
const selectedChart = ref<string>('todos');
const planesIA = ref<PlanIA[]>([]);
const cargandoPlanes = ref(false);
const errorPlanes = ref<string | null>(null);

// Estados de carga específicos para las exportaciones
const exportandoExcel = ref(false);
const exportandoAsignaciones = ref(false); // Estado para el segundo botón

// --- UTILIDADES ---
const numeroSeguro = (valor: unknown, fallback = 0): number => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
};

const normalizarRuta = (ruta: RutaApi): Ruta => ({
  id: String(ruta.id ?? ''),
  ruta: numeroSeguro(ruta.ruta, 0),
  'tipo de unidad': String(ruta['tipo de unidad'] ?? 'N/D'),
  capacidad_real: numeroSeguro(ruta.capacidad_real, 0),
  max_pasajeros_dia: numeroSeguro(ruta.max_pasajeros_dia, 0),
  porcentaje_ocupacion_max: numeroSeguro(ruta.porcentaje_ocupacion_max, 0),
  alerta_ocupacion: String(ruta.alerta_ocupacion ?? 'N/D'),
  sugerencia_right_sizing: String(ruta.sugerencia_right_sizing ?? 'Sin sugerencia')
});

const obtenerOcupacionSegura = (ruta: Ruta): number => numeroSeguro(ruta.porcentaje_ocupacion_max, 0);
const formatearOcupacion = (ruta: Ruta): string => obtenerOcupacionSegura(ruta).toFixed(1);

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

const obtenerPlanesIA = async () => {
  cargandoPlanes.value = true;
  errorPlanes.value = null;
  try {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/ai/planes-ejecutados?limit=6`, { headers });
    const json = await respuesta.json();
    if (!respuesta.ok || !json?.success) throw new Error(json?.message || 'Error en planes IA');
    const data = Array.isArray(json?.data) ? json.data : [];
    planesIA.value = data.map((plan: any) => ({
      id: String(plan.id ?? ''),
      fecha: String(plan.fecha ?? ''),
      turno: plan.turno ? String(plan.turno) : null,
      ruta_origen_id: String(plan.ruta_origen_id ?? 'N/D'),
      ruta_destino_id: String(plan.ruta_destino_id ?? 'N/D'),
      cantidad_empleados_movidos: numeroSeguro(plan.cantidad_empleados_movidos, 0),
      estado_impacto: (['alto', 'medio', 'bajo'].includes(String(plan.estado_impacto)) ? plan.estado_impacto : 'bajo'),
      motivo: plan.motivo ? String(plan.motivo) : null
    }));
  } catch (err: any) {
    errorPlanes.value = err.message || 'Error en planes IA.';
    planesIA.value = [];
  } finally {
    cargandoPlanes.value = false;
  }
};

// --- EXPORTACIONES (ExcelJS) ---

// Función 1: Exportar Programación Operativa (Rutas)
const exportarTablaExcel = async () => {
  exportandoExcel.value = true;
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Programación de Rutas');

    // Estilos Corporativos (Encabezado Negro)
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'ILPEA - PROGRAMACIÓN DE RUTAS'; 
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center' };

    // Columnas y Encabezados (Verde)
    worksheet.columns = [
      { header: 'RUTA', key: 'ruta', width: 15 },
      { header: 'UNIDAD', key: 'unidad', width: 20 },
      { header: 'CAPACIDAD', key: 'cap', width: 15 },
      { header: 'OCUPACIÓN (%)', key: 'ocupacion', width: 20 },
      { header: 'ESTADO IA', key: 'estado', width: 25 }
    ];

    const headerRow = worksheet.getRow(2);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF107C41' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    // Datos
    rutas.value.forEach(ruta => {
      worksheet.addRow({
        ruta: `Ruta ${ruta.ruta}`,
        unidad: ruta['tipo de unidad'],
        cap: ruta.capacidad_real,
        ocupacion: `${obtenerOcupacionSegura(ruta).toFixed(2)}%`,
        estado: ruta.sugerencia_right_sizing
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Programacion_Rutas_ILPEA_${new Date().toISOString().slice(0,10)}.xlsx`);
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
    // 1. Consultar datos al Backend (Asumiendo endpoint en Frente 2/OCI)
    const headers = await authHeaders();
    // NOTA OPERATIVA: Asegúrate de tener este endpoint '/api/usuarios-asignados' configurado en tu backend
    const respuesta = await fetch(`${API_BASE_URL}/api/usuarios-asignados`, { headers });
    
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
    asignaciones.forEach(asig => {
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
    const fechaHoy = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    saveAs(new Blob([buffer]), `Catalogo_Asignaciones_ILPEA_${fechaHoy}.xlsx`);

  } catch (error: any) {
    console.error('Error Catálogo Excel:', error);
    alert(`Ocurrió un error al generar el catálogo: ${error.message}`);
  } finally {
    exportandoAsignaciones.value = false;
  }
};

// --- NAVEGACIÓN ---
const irADashboard = () => router.push('/admin');
const irARutasApi = () => router.push('/admin/rutas');
const irAUsuarios = () => router.push('/admin/usuarios');
const irAAsignaciones = () => router.push('/admin/asignaciones');

const cerrarSesion = async () => {
  const { logout } = useAuth();
  await logout();
  router.push('/login');
};

// --- CICLO DE VIDA ---
onMounted(() => {
  obtenerRutas();
  obtenerPlanesIA();
});
</script>

<style scoped>
/* Estilos existentes intactos */
.admin-layout { display: flex; min-height: 100vh; background: #f8f9fa; font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; }
.sidebar { width: 240px; background: #000; color: #fff; padding: 2rem 1.5rem; display: flex; flex-direction: column; }
.brand { font-weight: 800; font-size: 1.2rem; margin-bottom: 3rem; }
.brand span { color: #666; font-weight: 400; }
.nav-menu { display: flex; flex-direction: column; gap: 5px; margin-bottom: 2rem; }
.nav-item { display: block; width: 100%; background: none; border: none; color: #888; text-align: left; padding: 0.8rem 0; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
.nav-item.active, .nav-item:hover { color: #fff; }
.logout-btn { background: #ef4444; color: #ffffff; padding: 0.8rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; transition: background 0.3s; width: 100%;}
.logout-btn:hover { background: #dc2626; }
.main-content { flex: 1; padding: 3rem; }
.header-flex { display: flex; justify-content: space-between; align-items: flex-start; }
.content-header { margin-bottom: 2rem; }
.content-header h2 { margin: 0; font-size: 1.5rem; }
.content-header p { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }

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
.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
.chart-item { background: #fff; padding: 1.5rem; border-radius: 12px; border: 1px solid #e0e0e0; min-height: 300px; }
.chart-item-small { grid-column: span 1; }
.section-title { font-size: 1.1rem; margin-bottom: 1rem; color: #333; }
.ia-block { margin-bottom: 2rem; }
.section-header-inline { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.planes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.plan-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; }
.plan-card h4 { margin: 0; font-size: 1rem; color: #1f2937; }
.plan-card p { margin: 0.35rem 0; font-size: 0.88rem; color: #374151; }
.plan-card-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
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
.impact-alto { background: #fff1f2; color: #991b1b; border: 1px solid #fecdd3; }
.impact-medio { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; }
.impact-bajo { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.status-box { padding: 4rem; text-align: center; color: #888; }
.error-msg { color: #ef4444; }
.btn-manage { background: none; border: 1px solid #ddd; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.btn-retry { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px; }
@media print { .no-print { display: none !important; } }
</style>