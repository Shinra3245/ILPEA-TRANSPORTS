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
                             :style="{ width: Math.min(ruta.porcentaje_ocupacion_max, 100) + '%' }"
                             :class="ruta.porcentaje_ocupacion_max < 40 ? 'low' : 'ok'">
                        </div>
                      </div>
                      <span>{{ (ruta.porcentaje_ocupacion_max || 0).toFixed(1) }}%</span>
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

// Interfaces existentes
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

// NUEVA Interface para el Catálogo de Asignaciones (según imagen)
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
  ruta_asignada: string;
  parada_asignada: string;
  estatus: string;
}

const rutas = ref<Ruta[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const router = useRouter();
const selectedChart = ref<string>('todos');

// Estados de carga para exportaciones
const exportandoExcel = ref(false);
const exportandoAsignaciones = ref(false);

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
    const dataCruda = Array.isArray(json?.data) ? json.data : [];

    // Blindaje de Datos.
    rutas.value = dataCruda.map((ruta: any) => ({
      ...ruta,
      porcentaje_ocupacion_max: Number(ruta.porcentaje_ocupacion_max) || 0,
      capacidad_real: Number(ruta.capacidad_real) || 0,
      max_pasajeros_dia: Number(ruta.max_pasajeros_dia) || 0,
      alerta_ocupacion: ruta.alerta_ocupacion || '', 
      sugerencia_right_sizing: ruta.sugerencia_right_sizing || '',
      "tipo de unidad": ruta["tipo de unidad"] || 'Desconocido'
    })).sort((a: any, b: any) => a.ruta - b.ruta);

  } catch (err: any) {
    console.error('Falla en API:', err);
    error.value = err.message || 'No se pudieron cargar las rutas.';
  } finally {
    cargando.value = false;
  }
};

// --- FUNCIÓN EXISTENTE ACTUALIZADA (Programación de Rutas) ---
const exportarTablaExcel = async () => {
  exportandoExcel.value = true;
  
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Programación de Rutas');

    // 1. Encabezado Corporativo (Negro)
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'ILPEA - PROGRAMACIÓN DE RUTAS'; 
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 2. Columnas
    worksheet.columns = [
      { header: 'RUTA', key: 'ruta', width: 12 },
      { header: 'UNIDAD', key: 'unidad', width: 18 },
      { header: 'CAPACIDAD', key: 'cap', width: 15 },
      { header: 'OCUPACIÓN (%)', key: 'ocupacion', width: 18 },
      { header: 'ESTADO DE RUTA', key: 'estado', width: 25 }
    ];

    // 3. Estilo Encabezados (Verde)
    const headerRow = worksheet.getRow(2);
    headerRow.values = ['RUTA', 'TIPO UNIDAD', 'CAP. REAL', '% OCUPACIÓN', 'ESTADO DE RUTA'];
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF107C41' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      cell.alignment = { horizontal: 'center' };
    });

    // 4. Datos
    rutas.value.forEach(ruta => {
      const porcentaje = ruta.porcentaje_ocupacion_max;
      const estadoOperativo = porcentaje < 40 ? 'CANCELADA' : 'ACTIVADA';
      
      const row = worksheet.addRow({
        ruta: `Ruta ${ruta.ruta}`,
        unidad: ruta['tipo de unidad'],
        cap: ruta.capacidad_real,
        ocupacion: (porcentaje / 100), 
        estado: estadoOperativo
      });

      row.getCell('ocupacion').numFmt = '0.0%';
      row.getCell('ocupacion').alignment = { horizontal: 'center' };
      row.getCell('cap').alignment = { horizontal: 'center' };
      row.getCell('estado').alignment = { horizontal: 'center', vertical: 'middle' };

      // Alerta visual
      if (porcentaje < 40) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cell.font = { color: { argb: 'FF991B1B' }, bold: true };
        });
      } else {
        row.getCell('estado').font = { color: { argb: 'FF166534' }, bold: true };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fechaHoy = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
    saveAs(new Blob([buffer]), `Programacion_de_Rutas_ILPEA_${fechaHoy}.xlsx`);

  } catch (error) {
    console.error('Error Excel:', error);
    alert('Error al exportar programación de rutas.');
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

      // Resaltado visual para "SIN RUTA"
      if (asig.ruta_asignada === 'SIN RUTA') {
         row.getCell('ruta_asignada').font = { color: { argb: 'FFFF0000' }, bold: true };
         row.getCell('ruta_asignada').fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFEE2E2'} };
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

const irADashboard = () => router.push('/admin');
const irARutasApi = () => router.push('/admin/rutas');
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
@media print { .no-print { display: none !important; } }
</style>