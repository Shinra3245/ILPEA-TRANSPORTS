<template>
  <section class="samsara-panel">
    <div v-if="cargando" class="estado">Cargando rutas...</div>
    <div v-else-if="error" class="estado estado-error">
      <p>{{ error }}</p>
      <button type="button" class="btn-retry" @click="cargarRutas">Reintentar</button>
    </div>
    <template v-else>
      <div class="table-toolbar">
        <AppAutocomplete
          v-model="terminoBusqueda"
          mode="filter"
          variant="field"
          :options="opcionesBusqueda"
          placeholder="Buscar ruta por destino o código..."
        />
      </div>

      <div v-if="!rutasSamsara.length" class="estado">No hay rutas activas en el catálogo.</div>
      <div v-else class="table-card">
        <table class="minimal-table">
          <thead>
            <tr>
              <th>ID Ruta</th>
              <th>Destino / Zona</th>
              <th>Código de Unidad</th>
              <th>Estado</th>
              <th>Mapa</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ruta in rutasFiltradas" :key="ruta.id">
              <td><strong>Ruta {{ ruta.numero }}</strong></td>
              <td>{{ ruta.destino }}</td>
              <td>
                <span v-if="ruta.codigo_unidad" class="tag tag-ok">{{ ruta.codigo_unidad }}</span>
                <span v-else class="tag">Sin código</span>
              </td>
              <td>
                <div class="status-cell">
                  <span v-if="ruta.link" class="dot-live"></span>
                  <span>{{ ruta.link ? 'Enlace disponible' : 'Sin enlace' }}</span>
                </div>
              </td>
              <td>
                <a
                  v-if="ruta.link"
                  :href="ruta.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-samsara btn-with-icon"
                >
                  <AppIcon name="map-pin" :size="14" />
                  <span>Ver mapa</span>
                </a>
                <span v-else class="sin-enlace">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppIcon from './ui/AppIcon.vue';
import AppAutocomplete, { type AutocompleteOption } from './ui/AppAutocomplete.vue';
import { coincideBusqueda } from '../utils/busqueda';
import { useAuth } from '../composables/useAuth';

interface RutaSamsara {
  id: string;
  numero: string;
  destino: string;
  codigo_unidad: string | null;
  link: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const { authHeaders } = useAuth();

const rutasSamsara = ref<RutaSamsara[]>([]);
const cargando = ref(true);
const error = ref<string | null>(null);
const terminoBusqueda = ref('');

const normalizarRutaSamsara = (ruta: Record<string, unknown>): RutaSamsara | null => {
  const numero = ruta.ruta;
  if (numero === undefined || numero === null || numero === '') {
    return null;
  }

  return {
    id: String(ruta.id ?? ''),
    numero: String(numero).padStart(2, '0'),
    destino: String(ruta.zona || ruta.referencia || 'Sin zona'),
    codigo_unidad: ruta.codigo_unidad ? String(ruta.codigo_unidad) : null,
    link: ruta.link_samsara ? String(ruta.link_samsara) : null
  };
};

const cargarRutas = async () => {
  cargando.value = true;
  error.value = null;

  try {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/rutas`, { headers });
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`);
    }

    const json = await respuesta.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    rutasSamsara.value = data
      .map((ruta: Record<string, unknown>) => normalizarRutaSamsara(ruta))
      .filter((ruta: RutaSamsara | null): ruta is RutaSamsara => Boolean(ruta))
      .sort((a: RutaSamsara, b: RutaSamsara) => Number(a.numero) - Number(b.numero));
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'No se pudieron cargar las rutas.';
    rutasSamsara.value = [];
  } finally {
    cargando.value = false;
  }
};

const opcionesBusqueda = computed<AutocompleteOption[]>(() =>
  rutasSamsara.value.map((ruta) => ({
    value: ruta.id,
    label: `Ruta ${ruta.numero} — ${ruta.destino}`,
    hint: ruta.codigo_unidad || 'Sin código',
    keywords: `ruta ${ruta.numero} ${ruta.destino} ${ruta.codigo_unidad || ''}`,
  })),
);

const rutasFiltradas = computed(() => {
  const termino = terminoBusqueda.value;
  if (!termino.trim()) {
    return rutasSamsara.value;
  }

  return rutasSamsara.value.filter((ruta) =>
    coincideBusqueda(termino, 'ruta', ruta.numero, ruta.destino, ruta.codigo_unidad || '', ruta.id),
  );
});

onMounted(() => {
  cargarRutas();
});
</script>

<style scoped>
.samsara-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.estado {
  padding: 1rem;
  border-radius: 8px;
  background: #f1f5f9;
  color: #334155;
}

.estado-error {
  background: #fee2e2;
  color: #991b1b;
}

.btn-retry {
  margin-top: 0.75rem;
  border: none;
  border-radius: 6px;
  padding: 0.45rem 0.8rem;
  background: #111827;
  color: #fff;
  cursor: pointer;
}

.table-toolbar {
  margin-bottom: 0.5rem;
}

.table-card {
  overflow-x: auto;
}

.minimal-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.minimal-table th,
.minimal-table td {
  padding: 0.85rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.minimal-table th {
  background: #f8fafc;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.tag {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 600;
}

.tag-ok {
  background: #dcfce7;
  color: #166534;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  color: #334155;
}

.dot-live {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
}

.btn-samsara {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  background: #111827;
  color: #fff;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 600;
}

.sin-enlace {
  color: #94a3b8;
}
</style>
