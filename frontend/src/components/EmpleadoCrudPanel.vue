<template>
  <section class="empleados-panel">
    <div class="panel-header">
      <div>
        <h3>Gestión de Empleados</h3>
        <p>Crear, editar, listar y eliminar empleados. El admin asigna el jefe responsable y el jefe solo ve los suyos.</p>
      </div>
      <button class="btn-secondary" type="button" :disabled="cargando" @click="cargarEmpleados">
        {{ cargando ? 'Cargando...' : 'Actualizar' }}
      </button>
    </div>

    <div class="panel-grid">
      <form class="form-card" @submit.prevent="guardarEmpleado">
        <h4>{{ editandoUid ? 'Editar empleado' : 'Nuevo empleado' }}</h4>

        <label v-if="editandoUid">
          ID Empleado
          <input v-model.trim="form.id_empleado" type="text" placeholder="Ej. 2496" required />
        </label>

        <p v-else class="helper-note">
          El ID de empleado y la contraseña temporal se generan automáticamente al crear el registro.
        </p>

        <label>
          Nombre
          <input v-model.trim="form.nombre" type="text" placeholder="Nombre completo" required />
        </label>

        <label>
          Email
          <input v-model.trim="form.email" type="email" placeholder="empleado@dominio.com" required />
        </label>

        <label v-if="esAdmin">
          Jefe responsable
          <select v-model="form.jefe_uid" required>
            <option value="" disabled>Selecciona un jefe</option>
            <option v-for="jefe in jefes" :key="jefe.uid" :value="jefe.uid">
              {{ jefe.nombre }} - {{ jefe.email }}
            </option>
          </select>
        </label>

        <p v-else class="helper-note">Los empleados creados desde este panel quedan asignados a tu usuario.</p>

        <label v-if="editandoUid">
          Contraseña (opcional)
          <input
            v-model="form.password"
            type="password"
            placeholder="Dejar vacío para no cambiar"
            :required="false"
          />
        </label>

        <label v-if="editandoUid" class="checkbox-row">
          <input v-model="form.activo" type="checkbox" />
          <span>Activo</span>
        </label>

        <div class="actions-row">
          <button class="btn-primary" type="submit" :disabled="guardando">
            {{ guardando ? 'Guardando...' : editandoUid ? 'Actualizar' : 'Crear' }}
          </button>
          <button v-if="editandoUid" class="btn-secondary" type="button" @click="limpiarFormulario">
            Cancelar
          </button>
        </div>

        <p v-if="mensaje" class="msg-success">{{ mensaje }}</p>
        <p v-if="error" class="msg-error">{{ error }}</p>

        <div v-if="credencialesGeneradas" class="generated-credentials">
          <h5>Credenciales generadas</h5>
          <p><strong>ID Empleado:</strong> {{ credencialesGeneradas.id_empleado }}</p>
          <p v-if="credencialesGeneradas.password_temporal">
            <strong>Contraseña temporal:</strong> {{ credencialesGeneradas.password_temporal }}
          </p>
          <p class="helper-note">Guárdalas ahora. La contraseña solo se muestra una vez.</p>
        </div>
      </form>

      <div class="table-card">
        <div class="table-head">
          <h4>Empleados registrados</h4>
          <span>{{ empleados.length }} registros</span>
        </div>

        <div v-if="cargando" class="empty-state">Cargando empleados...</div>

        <div v-else-if="!empleados.length" class="empty-state">
          No hay empleados registrados.
        </div>

        <table v-else class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Jefe</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="empleado in empleados" :key="empleado.uid">
              <td>{{ obtenerIdVisual(empleado) }}</td>
              <td>
                <strong>{{ empleado.nombre }}</strong>
              </td>
              <td>{{ empleado.email }}</td>
              <td>{{ nombreJefe(empleado.jefe_uid) }}</td>
              <td>
                <span :class="['badge', empleado.activo ? 'badge-ok' : 'badge-off']">
                  {{ empleado.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="btn-mini" type="button" @click="editarEmpleado(empleado)">
                  Editar
                </button>
                <button class="btn-mini danger" type="button" @click="eliminarEmpleado(empleado)">
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useAuth } from '../composables/useAuth';

interface Empleado {
  uid: string;
  id_empleado?: string;
  email: string;
  nombre: string;
  jefe_uid?: string | null;
  activo?: boolean;
}

interface Jefe {
  uid: string;
  email: string;
  nombre: string;
}

interface CredencialesGeneradas {
  id_empleado: string;
  password_temporal?: string | null;
}

const { authHeaders, obtenerRol, usuario } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const usuarioActual = computed(() => usuario.value);
const uidUsuarioActual = computed(() => usuarioActual.value?.uid || '');
const rolActual = computed(() => obtenerRol());
const esAdmin = computed(() => rolActual.value === 'ADMIN');
const esJefe = computed(() => rolActual.value === 'JEFE');

const empleados = ref<Empleado[]>([]);
const jefes = ref<Jefe[]>([]);
const cargando = ref(false);
const guardando = ref(false);
const error = ref<string | null>(null);
const mensaje = ref<string | null>(null);
const editandoUid = ref<string | null>(null);
const credencialesGeneradas = ref<CredencialesGeneradas | null>(null);

const form = reactive({
  id_empleado: '',
  nombre: '',
  email: '',
  password: '',
  activo: true,
  jefe_uid: '',
});

function upsertEmpleadoEnTabla(empleado: Empleado) {
  empleados.value = [
    empleado,
    ...empleados.value.filter((actual) => actual.uid !== empleado.uid),
  ];
}

function limpiarFormulario() {
  editandoUid.value = null;
  credencialesGeneradas.value = null;
  form.id_empleado = '';
  form.nombre = '';
  form.email = '';
  form.password = '';
  form.activo = true;
  form.jefe_uid = esAdmin.value ? '' : uidUsuarioActual.value;
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
  if (!esAdmin.value) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/api/jefes`, {
    headers: await obtenerHeaders(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'No se pudieron cargar los jefes.');
  }

  jefes.value = Array.isArray(payload?.data) ? payload.data : [];
}

async function cargarEmpleados() {
  cargando.value = true;
  error.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/empleados`, {
      headers: await obtenerHeaders(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudieron cargar los empleados.');
    }

    empleados.value = Array.isArray(payload?.data) ? payload.data : [];
  } catch (err: any) {
    error.value = err.message || 'Error cargando empleados.';
  } finally {
    cargando.value = false;
  }
}

function nombreJefe(uid?: string | null) {
  if (!uid) {
    return 'Sin asignar';
  }

  if (uid === uidUsuarioActual.value) {
    return esJefe.value ? 'Tú' : 'Asignado a ti';
  }

  return jefes.value.find((jefe) => jefe.uid === uid)?.nombre || uid;
}

function obtenerIdVisual(empleado: Empleado) {
  const idPersistido = String(empleado.id_empleado || '').trim();
  if (idPersistido) {
    return idPersistido;
  }

  return `EMP-${empleado.uid.slice(-6).toUpperCase()}`;
}

function editarEmpleado(empleado: Empleado) {
  editandoUid.value = empleado.uid;
  credencialesGeneradas.value = null;
  form.id_empleado = empleado.id_empleado || '';
  form.nombre = empleado.nombre;
  form.email = empleado.email;
  form.password = '';
  form.activo = empleado.activo !== false;
  form.jefe_uid = empleado.jefe_uid || (esAdmin.value ? '' : uidUsuarioActual.value);
  mensaje.value = null;
  error.value = null;
}

function generarIdEmpleadoTemporal() {
  return `EMP-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generarPasswordTemporal() {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let resultado = '';

  for (let i = 0; i < 12; i += 1) {
    resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }

  return resultado;
}

async function guardarEmpleado() {
  guardando.value = true;
  error.value = null;
  mensaje.value = null;

  try {
    if (!esAdmin.value && !uidUsuarioActual.value) {
      throw new Error('No se pudo identificar al jefe autenticado. Recarga la sesión e intenta nuevamente.');
    }

    const esEdicion = Boolean(editandoUid.value);
    const idGenerado = !esEdicion ? generarIdEmpleadoTemporal() : null;
    const passwordGenerada = !esEdicion ? generarPasswordTemporal() : null;
    const body: Record<string, unknown> = {
      nombre: form.nombre,
      email: form.email,
      activo: form.activo,
      jefe_uid: esAdmin.value ? form.jefe_uid : uidUsuarioActual.value,
    };

    if (esEdicion) {
      body.id_empleado = form.id_empleado;
      if (form.password.trim()) {
        body.password = form.password;
      }
    } else {
      body.id_empleado = idGenerado;
      body.password = passwordGenerada;
    }

    const response = await fetch(
      esEdicion ? `${API_BASE_URL}/api/empleados/${editandoUid.value}` : `${API_BASE_URL}/api/empleados`,
      {
        method: esEdicion ? 'PUT' : 'POST',
        headers: await obtenerHeaders(),
        body: JSON.stringify(body),
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudo guardar el empleado.');
    }

    if (!esEdicion) {
      credencialesGeneradas.value = {
        id_empleado: payload?.credenciales_generadas?.id_empleado || idGenerado || '',
        password_temporal: payload?.credenciales_generadas?.password_temporal || passwordGenerada,
      };
    }

    mensaje.value = payload?.message || (esEdicion ? 'Empleado actualizado.' : 'Empleado creado.');
    if (payload?.usuario?.uid) {
      upsertEmpleadoEnTabla(payload.usuario as Empleado);
    }

    if (esEdicion) {
      limpiarFormulario();
      await cargarEmpleados();
    } else {
      form.nombre = '';
      form.email = '';
      form.password = '';
      form.id_empleado = '';
      form.activo = true;
      form.jefe_uid = esAdmin.value ? '' : uidUsuarioActual.value;
    }
  } catch (err: any) {
    error.value = err.message || 'Error guardando empleado.';
  } finally {
    guardando.value = false;
  }
}

async function eliminarEmpleado(empleado: Empleado) {
  const confirmar = window.confirm(`¿Eliminar a ${empleado.nombre}? Esta acción no se puede deshacer.`);
  if (!confirmar) return;

  error.value = null;
  mensaje.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/empleados/${empleado.uid}`, {
      method: 'DELETE',
      headers: await obtenerHeaders(),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudo eliminar el empleado.');
    }

    mensaje.value = payload?.message || 'Empleado eliminado.';
    await cargarEmpleados();
  } catch (err: any) {
    error.value = err.message || 'Error eliminando empleado.';
  }
}

onMounted(async () => {
  if (esAdmin.value) {
    await cargarJefes();
  }
  limpiarFormulario();
  await cargarEmpleados();
});
</script>

<style scoped>
.empleados-panel {
  margin-bottom: 2rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
}

.panel-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #000;
}

.panel-header p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.btn-secondary {
  padding: 0.6rem 1.2rem;
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-secondary:hover:not(:disabled) {
  background: #eeeeee;
  border-color: #999;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 2rem;
}

.form-card {
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 2rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.form-card h4 {
  margin: 0 0 1.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #000;
}

.form-card label {
  display: block;
  margin-bottom: 1.2rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
}

.form-card input[type='text'],
.form-card input[type='email'],
.form-card input[type='password'],
.form-card select {
  width: 100%;
  padding: 0.6rem 0.8rem;
  margin-top: 0.4rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #333;
  background: white;
  transition: border-color 0.2s;
}

.form-card input[type='text']:focus,
.form-card input[type='email']:focus,
.form-card input[type='password']:focus,
.form-card select:focus {
  outline: none;
  border-color: #333;
}

.checkbox-row {
  display: flex !important;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0;
}

.checkbox-row input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-row span {
  margin: 0;
  font-weight: normal;
}

.actions-row {
  display: flex;
  gap: 0.8rem;
  margin-top: 2rem;
}

.btn-primary {
  padding: 0.6rem 1.2rem;
  background: #000;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #222;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.msg-success {
  margin-top: 1rem;
  padding: 0.8rem;
  background: #f0f9ff;
  color: #0c4a6e;
  border-left: 3px solid #0284c7;
  border-radius: 4px;
  font-size: 0.9rem;
}

.msg-error {
  margin-top: 1rem;
  padding: 0.8rem;
  background: #fef2f2;
  color: #7f1d1d;
  border-left: 3px solid #dc2626;
  border-radius: 4px;
  font-size: 0.9rem;
}

.generated-credentials {
  margin-top: 1rem;
  padding: 0.9rem;
  border-radius: 4px;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
}

.generated-credentials h5 {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  color: #312e81;
}

.generated-credentials p {
  margin: 0.2rem 0;
  color: #1e1b4b;
  font-size: 0.9rem;
}

.helper-note {
  margin-top: 0.6rem;
  color: #666;
  font-size: 0.85rem;
}

.table-card {
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.table-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e5e5;
  background: #f9f9f9;
}

.table-head h4 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #000;
}

.table-head span {
  color: #666;
  font-size: 0.9rem;
}

.empty-state {
  padding: 2rem;
  color: #666;
  text-align: center;
  font-size: 0.95rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table thead {
  background: #f9f9f9;
}

.table th {
  padding: 1rem 1.5rem;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e5e5e5;
}

.table td {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f5f5f5;
  color: #333;
}

.table tbody tr:hover {
  background: #fafafa;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-mini {
  padding: 0.5rem 0.8rem;
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-mini:hover {
  background: #eeeeee;
  border-color: #999;
}

.btn-mini.danger {
  background: #ffebee;
  color: #c62828;
  border-color: #f5aaaa;
}

.btn-mini.danger:hover {
  background: #ffdbdb;
  border-color: #ef9a9a;
}

.badge {
  display: inline-block;
  padding: 0.35rem 0.7rem;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge-ok {
  background: #f0fdf4;
  color: #166534;
}

.badge-off {
  background: #fef3c7;
  color: #92400e;
}

@media (max-width: 1024px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    flex-direction: column;
  }
}
</style>
