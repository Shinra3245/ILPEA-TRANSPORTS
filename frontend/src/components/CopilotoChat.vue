<template>
  <div class="chat-wrapper">
    <button class="btn-toggle" @click="chatAbierto = !chatAbierto">
      💬 Copiloto
    </button>

    <div v-if="chatAbierto" class="chat-window">
      <div class="chat-header">
        <h4>Copiloto Logístico ILPEA</h4>
        <button class="btn-close" @click="chatAbierto = false">✖</button>
      </div>

      <div class="chat-history" ref="historialDiv">
        <div 
          v-for="(msg, index) in historial" 
          :key="index"
          :class="['mensaje', msg.role === 'user' ? 'msg-user' : 'msg-bot']"
        >
          {{ msg.text }}
        </div>
        <div v-if="cargando" class="mensaje msg-bot escribiendo">
          El Copiloto está analizando...
        </div>
      </div>

      <form class="chat-input-area" @submit.prevent="enviarMensaje">
        <input 
          v-model="inputMensaje" 
          type="text" 
          :placeholder="placeholderInput" 
          :disabled="cargando"
        />
        <button type="submit" :disabled="!inputMensaje || cargando">Enviar</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';

interface Mensaje {
  role: 'user' | 'bot';
  text: string;
}

interface ContextoChat {
  fecha?: string;
  turno?: string;
}

const props = defineProps<{
  scope?: 'ADMIN' | 'JEFE';
  contexto?: ContextoChat;
}>();

const chatAbierto = ref(false);
const inputMensaje = ref('');
const historialDiv = ref<HTMLElement | null>(null);
const cargando = ref(false);
const { authHeaders } = useAuth();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const placeholderInput = computed(() =>
  props.scope === 'JEFE'
    ? 'Pregunta por empleados, turnos o reasignaciones...'
    : 'Pregunta por rutas, ocupación o decisiones IA...'
);

const mensajeInicial = computed(() => {
  if (props.scope === 'JEFE') {
    return 'Hola. Soy tu Copiloto Logístico para Jefes. Puedo ayudarte con turnos, rutas y empleados a tu cargo.';
  }

  return 'Hola. Soy tu Copiloto Logístico para Administración. Puedo ayudarte con rutas, ocupación y planes IA.';
});

const historial = ref<Mensaje[]>([{ role: 'bot', text: mensajeInicial.value }]);

watch(mensajeInicial, (nuevoMensaje) => {
  historial.value = [{ role: 'bot', text: nuevoMensaje }];
});

watch(
  () => historial.value.length,
  async () => {
    await nextTick();
    if (historialDiv.value) {
      historialDiv.value.scrollTop = historialDiv.value.scrollHeight;
    }
  }
);

const enviarMensaje = async () => {
  if (!inputMensaje.value.trim()) return;

  const textoUsuario = inputMensaje.value;
  historial.value.push({ role: 'user', text: textoUsuario });
  inputMensaje.value = '';
  cargando.value = true;

  try {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        mensaje_usuario: textoUsuario,
        fecha: props.contexto?.fecha,
        turno: props.contexto?.turno,
        panel: props.scope || null
      })
    });

    const data = await respuesta.json().catch(() => ({}));

    if (respuesta.ok && data.success) {
      historial.value.push({ role: 'bot', text: data.respuesta });
    } else {
      historial.value.push({ role: 'bot', text: data.message || 'Error: No pude conectarme con la central.' });
    }
  } catch (error) {
    historial.value.push({ role: 'bot', text: 'Error de red. Asegúrate de que el servidor esté corriendo.' });
  } finally {
    cargando.value = false;
  }
};
</script>

<style scoped>
.chat-wrapper {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  font-family: 'Segoe UI', Tahoma, sans-serif;
}

.btn-toggle {
  background-color: #0f172a;
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 1rem 1.5rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.chat-window {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 350px;
  height: 450px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  background-color: #0f172a;
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h4 {
  margin: 0;
  font-size: 1rem;
}

.btn-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
}

.chat-history {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: #f8fafc;
}

.mensaje {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.msg-user {
  background-color: #2563eb;
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 0;
}

.msg-bot {
  background-color: #e2e8f0;
  color: #0f172a;
  align-self: flex-start;
  border-bottom-left-radius: 0;
}

.escribiendo {
  font-style: italic;
  opacity: 0.7;
}

.chat-input-area {
  display: flex;
  padding: 0.75rem;
  border-top: 1px solid #e2e8f0;
  background: white;
}

.chat-input-area input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  outline: none;
}

.chat-input-area button {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  margin-left: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.chat-input-area button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}
</style>