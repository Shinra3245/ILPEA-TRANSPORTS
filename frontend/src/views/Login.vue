<template>
  <div class="login-container">
    <div
      class="brand-panel"
      v-motion
      :initial="{ opacity: 0, x: -40 }"
      :enter="{ opacity: 1, x: 0, transition: { duration: 600 } }"
    >
      <div class="brand-glow"></div>
      <div class="brand-content">
        <div
          class="brand-logo"
          v-motion
          :initial="{ opacity: 0, scale: 0.6 }"
          :enter="{ opacity: 1, scale: 1, transition: { duration: 500, delay: 150 } }"
        >
          <AppIcon name="truck" :size="32" :stroke-width="2.2" />
        </div>
        <h1
          v-motion
          :initial="{ opacity: 0, y: 16 }"
          :enter="{ opacity: 1, y: 0, transition: { duration: 500, delay: 250 } }"
        >
          ILPEA Transporte
        </h1>
        <p
          v-motion
          :initial="{ opacity: 0, y: 16 }"
          :enter="{ opacity: 1, y: 0, transition: { duration: 500, delay: 350 } }"
        >
          Gestión y control de flota en un solo lugar.
        </p>
      </div>
    </div>

    <div class="form-panel">
      <div
        class="login-card"
        v-motion
        :initial="{ opacity: 0, y: 24 }"
        :enter="{ opacity: 1, y: 0, transition: { duration: 550, delay: 150 } }"
      >
        <h2>Bienvenido de nuevo</h2>
        <p class="subtitle">Inicia sesión con tus credenciales para continuar.</p>

        <form class="form" @submit.prevent="ingresar">
          <label for="email">Correo</label>
          <div class="input-wrap">
            <AppIcon name="mail" :size="18" class="input-icon" />
            <input id="email" v-model="email" type="email" required placeholder="usuario@dominio.com" />
          </div>

          <label for="password">Contraseña</label>
          <div class="input-wrap">
            <AppIcon name="lock" :size="18" class="input-icon" />
            <input id="password" v-model="password" type="password" required placeholder="Contraseña" />
          </div>

          <button class="btn btn-login" type="submit" :disabled="cargando">
            <AppIcon v-if="cargando" name="loader-2" :size="18" spin />
            {{ cargando ? 'Ingresando...' : 'Ingresar' }}
          </button>

          <p
            v-if="error"
            class="ui-alert ui-alert--error"
            v-motion
            :initial="{ opacity: 0, y: -6 }"
            :enter="{ opacity: 1, y: 0, transition: { duration: 250 } }"
          >
            {{ error }}
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import AppIcon from '../components/ui/AppIcon.vue'

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
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  min-height: 100vh;
  font-family: Inter, system-ui, sans-serif;
}

/* Brand panel */
.brand-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, var(--ilpea-black) 0%, #1a1a1a 50%, #0d2818 100%);
  background-size: 200% 200%;
  animation: gradient-shift 12s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.brand-glow {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(16, 124, 65, 0.35) 0%, transparent 70%);
  top: -150px;
  right: -150px;
  filter: blur(10px);
  animation: float 8s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30px, 40px) scale(1.1); }
}

.brand-content {
  position: relative;
  z-index: 1;
  max-width: 420px;
  padding: 2rem;
  color: var(--ilpea-white);
  text-align: left;
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--ilpea-white);
  margin-bottom: 1.5rem;
}

.brand-content h1 {
  font-size: 2.25rem;
  font-weight: 800;
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.02em;
}

.brand-content p {
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  line-height: 1.5;
}

/* Form panel */
.form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ilpea-gray-100);
  padding: 1.5rem;
}

.login-card {
  background: var(--ilpea-white);
  padding: 2.5rem;
  border-radius: 16px;
  border: 1px solid var(--ilpea-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  max-width: 420px;
  width: 100%;
}

.login-card h2 {
  color: var(--ilpea-black);
  margin: 0 0 0.4rem 0;
  font-size: 1.6rem;
  font-weight: 800;
}

.subtitle {
  margin: 0 0 2rem 0;
  color: var(--ilpea-gray-500);
  font-size: 0.92rem;
}

.form {
  display: grid;
  gap: 0.65rem;
  text-align: left;
}

.form label {
  font-weight: 600;
  color: var(--ilpea-gray-900);
  font-size: 0.9rem;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--ilpea-gray-500);
  pointer-events: none;
  transition: color 0.2s;
}

.form input {
  width: 100%;
  padding: 0.75rem 0.75rem 0.75rem 2.6rem;
  border: 1px solid var(--ilpea-border);
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form input:focus {
  outline: none;
  border-color: var(--ilpea-accent);
  box-shadow: 0 0 0 3px rgba(16, 124, 65, 0.12);
}

.form input:focus + .input-icon,
.input-wrap:has(input:focus) .input-icon {
  color: var(--ilpea-accent);
}

.btn {
  padding: 0.85rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  color: var(--ilpea-white);
  transition: background 0.2s, transform 0.1s;
}

.btn-login {
  margin-top: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--ilpea-black);
}

.btn-login:hover:not(:disabled) {
  background: #222;
  transform: translateY(-1px);
}

.btn-login:active:not(:disabled) {
  transform: translateY(0);
}

.btn-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .login-container {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    min-height: 240px;
    padding: 2rem 0;
  }

  .brand-content h1 {
    font-size: 1.75rem;
  }
}

@media (max-width: 600px) {
  .login-card {
    padding: 2rem;
  }
}
</style>
