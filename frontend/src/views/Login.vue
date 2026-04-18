<template>
  <div class="login-container">
    <div class="login-card">
      <h1>ILPEA Transporte</h1>
      <p>Selecciona tu perfil de prueba para ingresar:</p>
      
      <div class="botones">
        <button @click="ingresar('ADMIN')" class="btn btn-admin">
          Entrar como ADMINISTRADOR
        </button>
        <button @click="ingresar('JEFE')" class="btn btn-jefe">
          Entrar como JEFE DE TURNO
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const ingresar = (rol: string) => {
  // Guardamos el rol en localStorage para simular la sesión
  localStorage.setItem('userRole', rol)
  
  // Redirigimos según el rol
  if (rol === 'ADMIN') {
    router.push('/admin')
  } else {
    router.push('/jefe')
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, sans-serif;
}
.login-card {
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  text-align: center;
}
.botones {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}
.btn {
  padding: 1rem;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  color: white;
  transition: opacity 0.2s;
}
.btn:hover { opacity: 0.9; }
.btn-admin { background-color: #0f172a; }
.btn-jefe { background-color: #2563eb; }
</style>