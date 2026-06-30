<template>
  <section class="crud-page">
    <div class="crud-toolbar">
      <button type="button" class="crud-btn-new" @click="abrirNuevo">
        <AppIcon name="plus" :size="16" />
        <span>Nuevo jefe</span>
      </button>

      <div class="crud-search crud-search--autocomplete">
        <AppAutocomplete
          v-model="terminoBusqueda"
          variant="toolbar"
          mode="filter"
          :options="opcionesBusqueda"
          placeholder="Buscar por nombre o email..."
        />
      </div>
    </div>

    <div v-if="mensaje || error || avisoCorreo || credencialesGeneradas" class="crud-alerts">
      <p v-if="mensaje" class="ui-alert ui-alert--success">{{ mensaje }}</p>
      <p v-if="error" class="ui-alert ui-alert--error">{{ error }}</p>
      <p v-if="avisoCorreo" :class="correoEnviado ? 'ui-alert ui-alert--success' : 'ui-alert ui-alert--warning'">
        {{ avisoCorreo }}
      </p>
      <div v-if="credencialesGeneradas" class="credenciales-box">
        <p><strong>Correo:</strong> {{ credencialesGeneradas.email }}</p>
        <p v-if="credencialesGeneradas.password_temporal">
          <strong>Contraseña temporal:</strong> {{ credencialesGeneradas.password_temporal }}
        </p>
        <p v-else-if="credencialesGeneradas.password_definida_manualmente" class="ui-muted">
          La contraseña es la que definiste al crear el usuario.
        </p>
        <p class="ui-muted">Guárdalas ahora. También se enviarán por correo en segundo plano.</p>
      </div>
    </div>

    <div class="crud-table-wrap">
      <div v-if="cargando" class="crud-empty">Cargando jefes...</div>
      <div v-else-if="!jefesFiltrados.length" class="crud-empty">
        {{ terminoBusqueda ? 'Sin resultados para la búsqueda.' : 'No hay jefes registrados.' }}
      </div>
      <div v-else class="crud-table-scroll">
        <table class="crud-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="jefe in jefesFiltrados" :key="jefe.uid">
              <td><span class="crud-id">{{ idVisual(jefe) }}</span></td>
              <td><span class="crud-name">{{ jefe.nombre }}</span></td>
              <td>{{ jefe.email }}</td>
              <td>
                <span v-if="jefe.activo !== false" class="crud-status-yes">
                  <AppIcon name="check" :size="12" />
                  Activo
                </span>
                <span v-else class="crud-status-no">Inactivo</span>
              </td>
              <td>
                <div class="crud-actions">
                  <button type="button" class="crud-action-btn crud-action-btn--edit" @click="editarJefe(jefe)">
                    <AppIcon name="pencil" :size="13" />
                    Editar
                  </button>
                  <button type="button" class="crud-action-btn crud-action-btn--delete" @click="eliminarJefe(jefe)">
                    <AppIcon name="trash-2" :size="13" />
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="modalAbierto" class="crud-modal-overlay" @click.self="cerrarModal">
        <form class="crud-modal" @submit.prevent="guardarJefe">
          <h3>{{ editandoUid ? 'Editar jefe' : 'Nuevo jefe' }}</h3>

          <label>
            Nombre
            <input v-model.trim="form.nombre" type="text" placeholder="Nombre completo" required />
          </label>

          <label>
            Email
            <input v-model.trim="form.email" type="email" placeholder="jefe@dominio.com" required />
          </label>

          <label>
            Contraseña (opcional)
            <input
              v-model="form.password"
              type="password"
              :placeholder="editandoUid ? 'Dejar vacío para no cambiar' : 'Se envía por correo si se omite'"
            />
          </label>

          <p v-if="!editandoUid" class="ui-muted">Contraseña opcional; se envía por correo si se omite.</p>

          <label v-if="editandoUid" class="crud-checkbox-row">
            <input v-model="form.activo" type="checkbox" />
            <span>Activo</span>
          </label>

          <div class="crud-modal-actions">
            <button class="crud-modal-btn-primary" type="submit" :disabled="guardando">
              {{ guardando ? 'Guardando...' : editandoUid ? 'Actualizar' : 'Crear' }}
            </button>
            <button class="crud-modal-btn-secondary" type="button" @click="cerrarModal">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuth } from '../composables/useAuth';
import AppIcon from './ui/AppIcon.vue';
import AppAutocomplete, { type AutocompleteOption } from './ui/AppAutocomplete.vue';
import { coincideBusqueda } from '../utils/busqueda';

interface Jefe {
  uid: string;
  email: string;
  nombre: string;
  activo?: boolean;
}

interface CredencialesGeneradas {
  email: string;
  password_temporal?: string | null;
  password_definida_manualmente?: boolean;
}

interface NotificacionEmail {
  enviado?: boolean;
  motivo?: string | null;
  detalle?: string | null;
  destinatario?: string | null;
}

const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const jefes = ref<Jefe[]>([]);
const cargando = ref(false);
const guardando = ref(false);
const error = ref<string | null>(null);
const mensaje = ref<string | null>(null);
const avisoCorreo = ref<string | null>(null);
const correoEnviado = ref(false);
const credencialesGeneradas = ref<CredencialesGeneradas | null>(null);
const editandoUid = ref<string | null>(null);
const modalAbierto = ref(false);
const terminoBusqueda = ref('');

const opcionesBusqueda = computed<AutocompleteOption[]>(() =>
  jefes.value.map((jefe) => ({
    value: jefe.uid,
    label: jefe.nombre,
    hint: jefe.email,
    keywords: `${jefe.nombre} ${jefe.email} ${idVisual(jefe)}`,
  })),
);

const form = reactive({
  nombre: '',
  email: '',
  password: '',
  activo: true,
});

const jefesFiltrados = computed(() => {
  const termino = terminoBusqueda.value;
  if (!termino.trim()) {
    return jefes.value;
  }

  return jefes.value.filter((jefe) =>
    coincideBusqueda(termino, jefe.nombre, jefe.email, idVisual(jefe), jefe.uid),
  );
});

function idVisual(jefe: Jefe) {
  return `#${jefe.uid.slice(-6).toUpperCase()}`;
}

function limpiarFormulario() {
  editandoUid.value = null;
  form.nombre = '';
  form.email = '';
  form.password = '';
  form.activo = true;
}

function abrirNuevo() {
  limpiarFormulario();
  credencialesGeneradas.value = null;
  avisoCorreo.value = null;
  correoEnviado.value = false;
  mensaje.value = null;
  error.value = null;
  modalAbierto.value = true;
}

function cerrarModal() {
  modalAbierto.value = false;
  limpiarFormulario();
}

function actualizarEstadoCorreo(notificacion?: NotificacionEmail | null) {
  if (!notificacion) {
    avisoCorreo.value = null;
    correoEnviado.value = false;
    return;
  }

  if (notificacion.motivo === 'ENVIO_EN_PROCESO') {
    avisoCorreo.value = null;
    correoEnviado.value = false;
    return;
  }

  correoEnviado.value = Boolean(notificacion.enviado);
  if (notificacion.enviado) {
    avisoCorreo.value = `Correo enviado a ${notificacion.destinatario || 'destinatario'}.`;
    return;
  }

  const detalle = notificacion.detalle ? ` ${notificacion.detalle}` : '';
  avisoCorreo.value = `No se pudo enviar el correo (${notificacion.motivo || 'DESCONOCIDO'}).${detalle}`;
}

async function obtenerHeaders() {
  const headers = await authHeaders();
  if (!headers.Authorization) {
    throw new Error('No hay sesión activa.');
  }
  return {
    'Content-Type': 'application/json',
    ...headers,
  };
}

async function cargarJefes() {
  cargando.value = true;
  error.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/jefes`, {
      headers: await obtenerHeaders(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudieron cargar los jefes.');
    }

    jefes.value = Array.isArray(payload?.data) ? payload.data : [];
  } catch (err: any) {
    error.value = err.message || 'Error cargando jefes.';
  } finally {
    cargando.value = false;
  }
}

function editarJefe(jefe: Jefe) {
  editandoUid.value = jefe.uid;
  form.nombre = jefe.nombre;
  form.email = jefe.email;
  form.password = '';
  form.activo = jefe.activo !== false;
  credencialesGeneradas.value = null;
  avisoCorreo.value = null;
  correoEnviado.value = false;
  mensaje.value = null;
  error.value = null;
  modalAbierto.value = true;
}

async function guardarJefe() {
  guardando.value = true;
  error.value = null;
  mensaje.value = null;
  avisoCorreo.value = null;
  correoEnviado.value = false;
  credencialesGeneradas.value = null;

  try {
    const esEdicion = Boolean(editandoUid.value);
    const body: Record<string, unknown> = {
      nombre: form.nombre,
      email: form.email,
      activo: form.activo,
    };

    if (form.password.trim()) {
      body.password = form.password;
    }

    const response = await fetch(
      esEdicion ? `${API_BASE_URL}/api/jefes/${editandoUid.value}` : `${API_BASE_URL}/api/jefes`,
      {
        method: esEdicion ? 'PUT' : 'POST',
        headers: await obtenerHeaders(),
        body: JSON.stringify(body),
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudo guardar el jefe.');
    }

    mensaje.value = payload?.message || (esEdicion ? 'Jefe actualizado.' : 'Jefe creado.');
    cerrarModal();
    await cargarJefes();

    if (!esEdicion) {
      const credenciales = payload?.credenciales_generadas;
      credencialesGeneradas.value = {
        email: credenciales?.email || payload?.usuario?.email || form.email,
        password_temporal: credenciales?.password_temporal ?? null,
        password_definida_manualmente: Boolean(credenciales?.password_definida_manualmente),
      };
      actualizarEstadoCorreo(payload?.notificacion_email as NotificacionEmail | undefined);
    }
  } catch (err: any) {
    error.value = err.message || 'Error guardando jefe.';
  } finally {
    guardando.value = false;
  }
}

async function eliminarJefe(jefe: Jefe) {
  const confirmar = window.confirm(
    `¿Eliminar definitivamente a ${jefe.nombre}? Se borrará su cuenta y no podrá recuperarse.`
  );
  if (!confirmar) return;

  error.value = null;
  mensaje.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/jefes/${jefe.uid}`, {
      method: 'DELETE',
      headers: await obtenerHeaders(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudo eliminar el jefe.');
    }

    mensaje.value = payload?.message || 'Jefe eliminado definitivamente.';
    jefes.value = jefes.value.filter((item) => item.uid !== jefe.uid);
    await cargarJefes();
  } catch (err: any) {
    error.value = err.message || 'Error eliminando jefe.';
  }
}

onMounted(() => {
  cargarJefes();
});
</script>

<style scoped>
.credenciales-box {
  padding: 0.85rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--ilpea-border);
  background: var(--ilpea-gray-100);
  font-size: 0.9rem;
}
</style>
