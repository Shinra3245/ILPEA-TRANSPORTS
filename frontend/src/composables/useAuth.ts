/**
 * Composable para manejo de autenticación y autorización
 */

import { ref, computed } from 'vue';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface Usuario {
  uid?: string;
  email: string;
  nombre: string;
  rol: 'ADMIN' | 'JEFE' | 'EMPLEADO';
  permisos?: string[];
}

// Estado global de autenticación
const usuario = ref<Usuario | null>(null);
const token = ref<string | null>(null);
const cargando = ref(false);
const error = ref<string | null>(null);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function leerRespuestaSegura(respuesta: Response) {
  const contentType = respuesta.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return respuesta.json();
  }

  const texto = await respuesta.text();
  return {
    success: false,
    message: texto.slice(0, 200) || 'La respuesta no vino en formato JSON.',
  };
}

function limpiarSesionLocal() {
  usuario.value = null;
  token.value = null;
  localStorage.removeItem('usuario');
  localStorage.removeItem('userRole');
  localStorage.removeItem('token');
}

async function sincronizarUsuarioConBackend(firebaseToken: string) {
  const respuesta = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${firebaseToken}`,
    },
  });

  const data = await leerRespuestaSegura(respuesta);

  if (!respuesta.ok || !data.success) {
    const mensajeBase = data.message || 'No se pudo validar el usuario contra el backend';
    throw new Error(
      respuesta.status === 404 && String(mensajeBase).includes('<!DOCTYPE html>')
        ? 'No se encontró el backend en la URL configurada. Revisa VITE_API_BASE_URL y reinicia Vite.'
        : mensajeBase
    );
  }

  usuario.value = data.usuario;
  token.value = firebaseToken;

  localStorage.setItem('usuario', JSON.stringify(data.usuario));
  localStorage.setItem('userRole', data.usuario.rol);
  localStorage.setItem('token', firebaseToken);
}

export function useAuth() {
  /**
   * Obtener usuario autenticado
   */
  const obtenerUsuario = () => {
    return usuario.value;
  };

  /**
   * Login real con Firebase Auth (email/password)
   */
  const login = async (email: string, password: string) => {
    cargando.value = true;
    error.value = null;

    try {
      const credencial = await signInWithEmailAndPassword(auth, email, password);
      const firebaseToken = await credencial.user.getIdToken();
      await sincronizarUsuarioConBackend(firebaseToken);

      cargando.value = false;
      return true;
    } catch (err: any) {
      error.value = err.message || 'Error al iniciar sesión';
      limpiarSesionLocal();
      cargando.value = false;
      return false;
    }
  };

  const restaurarSesion = async () => {
    if (auth.currentUser) {
      try {
        const firebaseToken = await auth.currentUser.getIdToken();
        await sincronizarUsuarioConBackend(firebaseToken);
        return true;
      } catch (err) {
        limpiarSesionLocal();
        return false;
      }
    }

    const userFromStorage = localStorage.getItem('usuario');
    const tokenFromStorage = localStorage.getItem('token');

    if (userFromStorage && tokenFromStorage) {
      try {
        usuario.value = JSON.parse(userFromStorage);
        token.value = tokenFromStorage;
        return true;
      } catch (err) {
        limpiarSesionLocal();
      }
    }

    return false;
  };

  const obtenerToken = async () => {
    if (auth.currentUser) {
      const firebaseToken = await auth.currentUser.getIdToken();
      token.value = firebaseToken;
      localStorage.setItem('token', firebaseToken);
      return firebaseToken;
    }
    return token.value;
  };

  const authHeaders = async (): Promise<Record<string, string>> => {
    const firebaseToken = await obtenerToken();
    if (!firebaseToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${firebaseToken}`,
    };
  };

  /**
   * Logout
   */
  const logout = async () => {
    try {
      await signOut(auth);
    } finally {
      limpiarSesionLocal();
    }
  };

  /**
   * Cargar usuario desde localStorage
   */
  const cargarUsuarioGuardado = () => {
    const usuarioGuardado = localStorage.getItem('usuario');
    const tokenGuardado = localStorage.getItem('token');

    if (usuarioGuardado) {
      try {
        usuario.value = JSON.parse(usuarioGuardado);
        token.value = tokenGuardado;
      } catch {
        console.warn('No se pudo cargar usuario guardado');
      }
    }
  };

  /**
   * Verificar si está autenticado
   */
  const estaAutenticado = computed(() => {
    return usuario.value !== null;
  });

  /**
   * Verificar si tiene un rol específico
   */
  const tieneRol = (roles: string | string[]) => {
    if (!usuario.value) return false;
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    return rolesArray.includes(usuario.value.rol);
  };

  /**
   * Verificar si tiene un permiso específico
   */
  const tienePermiso = (accion: string) => {
    if (!usuario.value) return false;

    // Permisos predefinidos por rol
    const permisosPorRol: Record<string, string[]> = {
      ADMIN: [
        'rutas:ver',
        'rutas:crear',
        'rutas:actualizar',
        'rutas:eliminar',
        'rutas:sync',
        'asignacion:crear',
        'asignacion:ver',
        'asignacion:cancelar',
        'chat:enviar',
        'insights:ver',
        'dashboard:admin',
        'dashboard:jefe',
        'dashboard:empleado',
        'usuarios:ver',
        'usuarios:crear',
        'usuarios:actualizar',
        'usuarios:eliminar',
      ],
      JEFE: [
        'rutas:ver',
        'rutas:actualizar',
        'asignacion:crear',
        'asignacion:ver',
        'asignacion:cancelar',
        'chat:enviar',
        'insights:ver',
        'dashboard:jefe',
        'dashboard:empleado',
      ],
      EMPLEADO: ['rutas:ver', 'asignacion:ver', 'asignacion:cancelar', 'dashboard:empleado'],
    };

    const permisos = permisosPorRol[usuario.value.rol] || [];
    return permisos.includes(accion);
  };

  /**
   * Obtener rol del usuario
   */
  const obtenerRol = () => {
    return usuario.value?.rol || null;
  };

  /**
   * Obtener nombre del usuario
   */
  const obtenerNombre = () => {
    return usuario.value?.nombre || 'Usuario';
  };

  return {
    usuario: computed(() => usuario.value),
    token: computed(() => token.value),
    cargando: computed(() => cargando.value),
    error: computed(() => error.value),
    login,
    logout,
    restaurarSesion,
    obtenerToken,
    authHeaders,
    cargarUsuarioGuardado,
    estaAutenticado,
    tieneRol,
    tienePermiso,
    obtenerRol,
    obtenerNombre,
    obtenerUsuario,
  };
}
