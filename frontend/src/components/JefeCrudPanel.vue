<template>
  <section class="jefes-panel">
    <div class="panel-header">
      <div>
        <h3>Gestión de Jefes</h3>
        <p>Crear, editar, listar y eliminar jefes. Los jefes pueden gestionar empleados asignados.</p>
      </div>
      <button class="btn-secondary" type="button" :disabled="cargando" @click="cargarJefes">
        {{ cargando ? 'Cargando...' : 'Actualizar' }}
      </button>
    </div>

    <div class="panel-grid">
      <form class="form-card" @submit.prevent="guardarJefe">
        <h4>{{ editandoUid ? 'Editar jefe' : 'Nuevo jefe' }}</h4>

        <label>
          Nombre
          <input v-model.trim="form.nombre" type="text" placeholder="Nombre completo" required />
        </label>

        <label>
          Email
          <input v-model.trim="form.email" type="email" placeholder="jefe@dominio.com" required />
        </label>

        <label>
          Contraseña {{ editandoUid ? '(opcional)' : '' }}
          <input
            v-model="form.password"
            type="password"
            :placeholder="editandoUid ? 'Dejar vacío para no cambiar' : 'Contraseña temporal'"
            :required="!editandoUid"
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
      </form>

      <div class="table-card">
        <div class="table-head">
          <h4>Jefes registrados</h4>
          <span>{{ jefes.length }} registros</span>
        </div>

        <div v-if="cargando" class="empty-state">Cargando jefes...</div>

        <div v-else-if="!jefes.length" class="empty-state">
          No hay jefes registrados.
        </div>

        <table v-else class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="jefe in jefes" :key="jefe.uid">
              <td>
                <strong>{{ jefe.nombre }}</strong>
              </td>
              <td>{{ jefe.email }}</td>
              <td>
                <span :class="['badge', jefe.activo ? 'badge-ok' : 'badge-off']">
                  {{ jefe.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="actions-cell">
                <button class="btn-mini" type="button" @click="editarJefe(jefe)">
                  Editar
                </button>
                <button class="btn-mini danger" type="button" @click="eliminarJefe(jefe)">
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
import { onMounted, reactive, ref } from 'vue';
import { useAuth } from '../composables/useAuth';

interface Jefe {
  uid: string;
  email: string;
  nombre: string;
  activo?: boolean;
}

const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const jefes = ref<Jefe[]>([]);
const cargando = ref(false);
const guardando = ref(false);
const error = ref<string | null>(null);
const mensaje = ref<string | null>(null);
const editandoUid = ref<string | null>(null);

const form = reactive({
  nombre: '',
  email: '',
  password: '',
  activo: true,
});

function limpiarFormulario() {
  editandoUid.value = null;
  form.nombre = '';
  form.email = '';
  form.password = '';
  form.activo = true;
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
  mensaje.value = null;
  error.value = null;
}

async function guardarJefe() {
  guardando.value = true;
  error.value = null;
  mensaje.value = null;

  try {
    const esEdicion = Boolean(editandoUid.value);
    const response = await fetch(
      esEdicion ? `${API_BASE_URL}/api/jefes/${editandoUid.value}` : `${API_BASE_URL}/api/jefes`,
      {
        method: esEdicion ? 'PUT' : 'POST',
        headers: await obtenerHeaders(),
        body: JSON.stringify({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          activo: form.activo,
        }),
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'No se pudo guardar el jefe.');
    }

    mensaje.value = payload?.message || (esEdicion ? 'Jefe actualizado.' : 'Jefe creado.');
    limpiarFormulario();
    await cargarJefes();
  } catch (err: any) {
    error.value = err.message || 'Error guardando jefe.';
  } finally {
    guardando.value = false;
  }
}

async function eliminarJefe(jefe: Jefe) {
  const confirmar = window.confirm(`¿Eliminar a ${jefe.nombre}? Esta acción no se puede deshacer.`);
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

    mensaje.value = payload?.message || 'Jefe eliminado.';
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
.jefes-panel {
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
  font-family: inherit;
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
  color: #333;
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
