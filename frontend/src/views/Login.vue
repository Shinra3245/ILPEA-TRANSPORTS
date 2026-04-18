<template>
  <div class="login-container">
    <div class="login-card">
      <h1>ILPEA Transporte</h1>
      <p>Inicia sesion con tus credenciales de Firebase Auth.</p>
      
      <form class="form" @submit.prevent="ingresar">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required placeholder="usuario@dominio.com" />

        <label for="password">Contrasena</label>
        <input id="password" v-model="password" type="password" required placeholder="Tu contrasena" />

        <button class="btn btn-login" type="submit" :disabled="cargando">
          {{ cargando ? 'Ingresando...' : 'Ingresar' }}
        </button>

        <p v-if="error" class="error-msg">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { login, obtenerRol, cargando, error } = useAuth()

const email = ref('')
const password = ref('')

const ingresar = async () => {
  const ok = await login(email.value.trim(), password.value)
  if (!ok) return

  const rol = obtenerRol()
  
  if (rol === 'ADMIN') {
    router.push('/admin')
  } else if (rol === 'JEFE') {
    router.push('/jefe')
  } else {
    router.push('/empleado')
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Segoe UI', Tahoma, sans-serif;
  padding: 1rem;
}

.login-card {
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.login-card h1 {
  color: #333;
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
}

.login-card > p {
  color: #666;
  margin: 0 0 2rem 0;
}

.form {
  display: grid;
  gap: 0.75rem;
  text-align: left;
}

.form label {
  font-weight: 600;
  color: #1f2937;
}

.form input {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}

.form input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.btn {
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.btn-login {
  margin-top: 0.75rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-msg {
  color: #dc2626;
  font-size: 0.9rem;
  margin: 0.5rem 0 0;
}

@media (max-width: 600px) {
  .login-card {
    padding: 2rem;
  }

  .login-card h1 {
    font-size: 1.5rem;
  }
}
</style>
