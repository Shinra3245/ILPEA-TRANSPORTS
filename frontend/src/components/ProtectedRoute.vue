<template>
  <div v-if="tienePermiso" class="content">
    <slot></slot>
  </div>
  <div v-else class="no-permission">
    <div class="alert">
      <AppIcon name="shield-x" :size="32" icon-class="alert-icon" />
      <h2>Acceso restringido</h2>
      <p>Tu rol no tiene permiso para ver este contenido.</p>
      <button type="button" @click="irAlInicio" class="btn-volver">Volver al inicio</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import AppIcon from './ui/AppIcon.vue';

interface Props {
  requiereRol?: string | string[];
  requierePermiso?: string | string[];
}

const props = withDefaults(defineProps<Props>(), {
  requiereRol: undefined,
  requierePermiso: undefined,
});

const router = useRouter();
const { tieneRol, tienePermiso: verificarPermiso } = useAuth();

const tienePermiso = computed(() => {
  if (!props.requiereRol && !props.requierePermiso) {
    return true;
  }

  if (props.requiereRol) {
    return tieneRol(props.requiereRol);
  }

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

.alert-icon {
  color: #dc2626;
  margin-bottom: 0.75rem;
}

.alert h2 {
  color: #dc2626;
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
}

.alert p {
  color: #991b1b;
  margin: 0.5rem 0;
}

.btn-volver {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.btn-volver:hover {
  background-color: #991b1b;
}
</style>
