<template>
  <div v-if="tienePermiso" class="content">
    <slot></slot>
  </div>
  <div v-else class="no-permission">
    <div class="alert">
      <h2>❌ Acceso Denegado</h2>
      <p>No tienes permisos para acceder a este contenido.</p>
      <p class="info">Tu rol: <strong>{{ rol }}</strong></p>
      <p v-if="rolesRequeridos" class="info">
        Roles permitidos: <strong>{{ rolesRequeridos.join(', ') }}</strong>
      </p>
      <button @click="irAlInicio" class="btn-volver">Volver al Inicio</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

interface Props {
  requiereRol?: string | string[];
  requierePermiso?: string | string[];
}

const props = withDefaults(defineProps<Props>(), {
  requiereRol: undefined,
  requierePermiso: undefined,
});

const router = useRouter();
const { tieneRol, tienePermiso: verificarPermiso, obtenerRol } = useAuth();

const rol = computed(() => obtenerRol());

const rolesRequeridos = computed(() => {
  if (!props.requiereRol) return null;
  return Array.isArray(props.requiereRol) ? props.requiereRol : [props.requiereRol];
});

const permisosRequeridos = computed(() => {
  if (!props.requierePermiso) return null;
  return Array.isArray(props.requierePermiso)
    ? props.requierePermiso
    : [props.requierePermiso];
});

const tienePermiso = computed(() => {
  // Si no hay requisitos, permitir acceso
  if (!props.requiereRol && !props.requierePermiso) {
    return true;
  }

  // Verificar roles
  if (props.requiereRol) {
    return tieneRol(props.requiereRol);
  }

  // Verificar permisos
  if (props.requierePermiso) {
    const permisos = Array.isArray(props.requierePermiso)
      ? props.requierePermiso
      : [props.requierePermiso];
    return permisos.some((permiso) => verificarPermiso(permiso));
  }

  return true;
});

const irAlInicio = () => {
  router.push('/');
};
</script>

<style scoped>
.content {
  width: 100%;
}

.no-permission {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 2rem;
}

.alert {
  background-color: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  max-width: 500px;
}

.alert h2 {
  color: #dc2626;
  margin: 0 0 1rem 0;
}

.alert p {
  color: #991b1b;
  margin: 0.5rem 0;
}

.info {
  background-color: #fef2f2;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.info strong {
  color: #7c2d12;
}

.btn-volver {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}

.btn-volver:hover {
  background-color: #991b1b;
}
</style>
