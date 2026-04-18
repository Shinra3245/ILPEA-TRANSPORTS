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
          placeholder="Pregunta sobre rutas o asignaciones..." 
          :disabled="cargando"
        />
        <button type="submit" :disabled="!inputMensaje || cargando">Enviar</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Mensaje {
  role: 'user' | 'bot';
  text: string;
}

const chatAbierto = ref(false);
const inputMensaje = ref('');
const historial = ref<Mensaje[]>([
  { role: 'bot', text: '¡Hola! Soy tu Copiloto Logístico. ¿En qué puedo ayudarte con las rutas hoy?' }
]);
const cargando = ref(false);

const enviarMensaje = async () => {
  if (!inputMensaje.value.trim()) return;

  const textoUsuario = inputMensaje.value;
  historial.value.push({ role: 'user', text: textoUsuario });
  inputMensaje.value = '';
  cargando.value = true;

  try {
    const respuesta = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje_usuario: textoUsuario })
    });

    const data = await respuesta.json();

    if (data.success) {
      historial.value.push({ role: 'bot', text: data.respuesta });
    } else {
      historial.value.push({ role: 'bot', text: 'Error: No pude conectarme con la central.' });
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