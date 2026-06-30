<template>
  <div class="login-container">
    <div
      ref="brandPanelRef"
      class="brand-panel"
      v-motion
      :initial="{ opacity: 0, x: -40 }"
      :enter="{ opacity: 1, x: 0, transition: { duration: 600 } }"
    >
      <div class="brand-content">
        <div
          class="brand-logo"
          v-motion
          :initial="{ opacity: 0, scale: 0.6 }"
          :enter="{ opacity: 1, scale: 1, transition: { duration: 500, delay: 150 } }"
        >
          <DotLottieVue class="brand-logo-animation" autoplay loop :src="vanAnimationUrl" />
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
        <span class="title-accent"></span>
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

          <button class="btn-login" type="submit" :disabled="cargando">
            <span class="btn-login-text">{{ cargando ? 'Ingresando...' : 'Ingresar' }}</span>
            <span class="btn-login-icon">
              <AppIcon v-if="cargando" name="loader-2" :size="16" spin icon-class="btn-login-arrow" />
              <AppIcon v-else name="arrow-right" :size="16" icon-class="btn-login-arrow" />
            </span>
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
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import vantaWavesImport from 'vanta/dist/vanta.waves.min'
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import { useAuth } from '../composables/useAuth'
import AppIcon from '../components/ui/AppIcon.vue'

const vanAnimationUrl = 'https://lottie.host/7bb34f58-e1fe-4f49-90ce-c9863360d57a/4OIixYE1CV.lottie'

interface VantaWavesOptions {
  el: HTMLElement
  THREE: typeof THREE
  mouseControls?: boolean
  touchControls?: boolean
  gyroControls?: boolean
  minHeight?: number
  minWidth?: number
  scale?: number
  scaleMobile?: number
  color?: number
  backgroundColor?: number
  shininess?: number
  waveHeight?: number
  waveSpeed?: number
  zoom?: number
}

interface VantaEffect {
  destroy(): void
}

// El build UMD de vanta exporta `{ default: fn }`; Vite envuelve eso una vez
// más al importarlo como default, así que hay que desempaquetarlo a mano.
const WAVES = (
  (vantaWavesImport as { default?: unknown })?.default ?? vantaWavesImport
) as (options: VantaWavesOptions) => VantaEffect

const router = useRouter()
const { login, obtenerRol, cargando, error } = useAuth()

const email = ref('')
const password = ref('')

const brandPanelRef = ref<HTMLElement | null>(null)
let vantaEffect: VantaEffect | null = null

onMounted(() => {
  if (!brandPanelRef.value) return

  try {
    vantaEffect = WAVES({
      el: brandPanelRef.value,
      THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1,
      scaleMobile: 1,
      color: 0x107c41,
      backgroundColor: 0x0a0a0a,
      shininess: 35,
      waveHeight: 18,
      waveSpeed: 0.9,
      zoom: 0.85,
    })
  } catch (err) {
    console.error('No se pudo inicializar el fondo animado del login:', err)
  }
})

onUnmounted(() => {
  vantaEffect?.destroy()
  vantaEffect = null
})

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
  background: var(--ilpea-black);
  box-shadow: inset -6px 0 24px -10px rgba(16, 124, 65, 0.5);
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
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  max-width: 280px;
  aspect-ratio: 16 / 9;
  margin: 0 0 0.5rem -16px;
}

.brand-logo-animation {
  width: 100%;
  height: 100%;
}

.brand-content h1 {
  font-size: 2.25rem;
  font-weight: 800;
  margin: 0 0 0.75rem 0;
  letter-spacing: -0.02em;
}

.brand-content p {
  display: inline-block;
  font-size: 1.05rem;
  color: var(--ilpea-white);
  margin: 0;
  line-height: 1.5;
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* Form panel */
.form-panel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ilpea-white);
  padding: 1.5rem;
}

.form-panel::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  background: linear-gradient(180deg, transparent 0%, var(--ilpea-accent) 50%, transparent 100%);
  opacity: 0.5;
}

.login-card {
  background: var(--ilpea-white);
  padding: 2.5rem;
  border-radius: 16px;
  border: 1px solid var(--ilpea-border);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.06);
  max-width: 420px;
  width: 100%;
}

.login-card h2 {
  color: var(--ilpea-black);
  margin: 0 0 0.6rem 0;
  font-size: 1.6rem;
  font-weight: 800;
}

.title-accent {
  display: block;
  width: 42px;
  height: 4px;
  border-radius: 2px;
  background: var(--ilpea-accent);
  margin-bottom: 1.2rem;
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

.btn-login {
  position: relative;
  margin-top: 0.75rem;
  height: 3.1em;
  padding: 0 1.3rem;
  border: none;
  border-radius: 0.9em;
  background: var(--ilpea-black);
  color: var(--ilpea-white);
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  overflow: hidden;
  cursor: pointer;
  box-shadow: inset 0 0 1.6em -0.6em rgba(16, 124, 65, 0.6);
  transition: box-shadow 0.2s;
}

.btn-login-text {
  position: relative;
  margin-right: 3rem;
}

.btn-login-icon {
  position: absolute;
  right: 0.3em;
  top: 50%;
  transform: translateY(-50%);
  width: 2.2em;
  height: 2.2em;
  border-radius: 0.7em;
  background: var(--ilpea-white);
  color: var(--ilpea-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0.1em 0.1em 0.6em 0.2em rgba(16, 124, 65, 0.35);
  transition: width 0.3s ease;
}

.btn-login:hover:not(:disabled) .btn-login-icon {
  width: calc(100% - 0.6em);
}

.btn-login :deep(.btn-login-arrow) {
  transition: transform 0.3s ease;
}

.btn-login:hover:not(:disabled) :deep(.btn-login-arrow) {
  transform: translateX(0.1em);
}

.btn-login:active:not(:disabled) .btn-login-icon {
  transform: translateY(-50%) scale(0.95);
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
