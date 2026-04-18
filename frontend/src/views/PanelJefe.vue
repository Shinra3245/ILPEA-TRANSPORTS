<template>
  <div class="panel-container">
    <header class="header">
      <div class="header-info">
        <h1>Panel de Asignación (Jefe)</h1>
        <p>Programación Diaria - Turno Mixto</p>
      </div>
      <button @click="cerrarSesion" class="btn-logout">Cerrar Sesión</button>
    </header>

    <main class="rutas-grid">
      <div v-for="ruta in programacionDiaria" :key="ruta.id" class="ruta-card">
        <h3>{{ ruta.nombre }} ({{ ruta.tipo_unidad }})</h3>
        
        <div class="cap-check-info">
          <span class="etiqueta">Ocupación Actual:</span>
          <span class="numeros" :class="{ 'texto-peligro': ruta.asientos_ocupados >= ruta.capacidad_limite }">
            {{ ruta.asientos_ocupados }} / {{ ruta.capacidad_limite }}
          </span>
        </div>

        <div class="barra-fondo">
          <div 
            class="barra-llenado" 
            :style="{ width: (ruta.asientos_ocupados / ruta.capacidad_limite) * 100 + '%' }"
            :class="{ 'barra-llena': ruta.asientos_ocupados >= ruta.capacidad_limite }"
          ></div>
        </div>

        <button 
          @click="asignarEmpleado(ruta)" 
          class="btn-asignar"
          :disabled="ruta.asientos_ocupados >= ruta.capacidad_limite"
        >
          {{ ruta.asientos_ocupados >= ruta.capacidad_limite ? 'Ruta Llena (Bloqueada)' : '+ Asignar Empleado' }}
        </button>
      </div>
    </main>

    <CopilotoChat />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
// Importamos el nuevo componente del chatbot
import CopilotoChat from '../components/CopilotoChat.vue'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { logout } = useAuth()

// Datos de prueba para el Jefe (Simulando la colección programacion_diaria)
const programacionDiaria = ref([
  {
    id: 'Ruta_6_Hoy',
    nombre: 'Ruta 6 - Fuentes Balvanera',
    tipo_unidad: 'Van',
    capacidad_limite: 12,
    asientos_ocupados: 10 
  },
  {
    id: 'Ruta_1_Hoy',
    nombre: 'Ruta 1 - Apaseo el Grande',
    tipo_unidad: 'Autobus',
    capacidad_limite: 30,
    asientos_ocupados: 15 
  }
])

const asignarEmpleado = (ruta: any) => {
  if (ruta.asientos_ocupados < ruta.capacidad_limite) {
    ruta.asientos_ocupados++
  }
}

const cerrarSesion = async () => {
  await logout()
  router.push('/login')
}
</script>

<style scoped>
.panel-container {
  padding: 2rem;
  font-family: 'Segoe UI', Tahoma, sans-serif;
  background-color: #f8fafc;
  min-height: 100vh;
  color: #0f172a;
  position: relative; /* Importante para que el chat se posicione bien si cambia a absolute */
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 1rem;
}
.btn-logout {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
.rutas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}
.ruta-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}
.cap-check-info {
  display: flex;
  justify-content: space-between;
  margin: 1rem 0 0.5rem 0;
  font-weight: bold;
}
.texto-peligro { color: #ef4444; }
.barra-fondo {
  width: 100%;
  height: 10px;
  background-color: #e2e8f0;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 1rem;
}
.barra-llenado {
  height: 100%;
  background-color: #3b82f6;
  transition: width 0.3s ease, background-color 0.3s ease;
}
.barra-llena { background-color: #ef4444; }
.btn-asignar {
  width: 100%;
  padding: 0.75rem;
  background-color: #22c55e;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}
.btn-asignar:disabled {
  background-color: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}
</style>