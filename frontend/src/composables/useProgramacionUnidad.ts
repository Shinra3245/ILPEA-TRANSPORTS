import { useAuth } from './useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface CambiarUnidadPayload {
  id_ruta: string;
  fecha: string;
  turno?: string | null;
  tipo_unidad: string;
  capacidad_limite: number;
  codigo_unidad?: string | null;
  motivo?: string | null;
}

export interface RutaProgramadaOperativa {
  id: string;
  tipo_unidad?: string | null;
  codigo_unidad?: string | null;
  capacidad_limite?: number;
  asientos_ocupados?: number;
  estado?: string;
  cancelada?: boolean;
}

export function traducirErrorUnidad(mensaje: string): string {
  const texto = String(mensaje || '').trim();
  if (!texto) return 'No fue posible cambiar la unidad.';

  if (texto.startsWith('UNIT_CAPACITY_TOO_SMALL')) {
    return 'La unidad sugerida no tiene capacidad para los pasajeros actuales.';
  }
  if (texto.startsWith('SEAT_OUT_OF_RANGE')) {
    return 'Hay asientos ocupados fuera de la nueva capacidad.';
  }
  if (texto.startsWith('ROUTE_CANCELLED')) {
    return 'La programación de esta ruta está cancelada.';
  }

  return texto;
}

export function capacidadPorTipoUnidad(tipo: string): number {
  const normalizado = String(tipo || '').toLowerCase();
  if (normalizado.includes('van')) return 12;
  if (normalizado.includes('sprinter')) return 19;
  if (normalizado.includes('autobus') || normalizado.includes('autobús') || normalizado.includes('camion') || normalizado.includes('camión')) {
    return 30;
  }
  return 12;
}

export function useProgramacionUnidad() {
  const { authHeaders } = useAuth();

  const listarRutasProgramadas = async (fecha: string, turno?: string | null): Promise<RutaProgramadaOperativa[]> => {
    const headers = await authHeaders();
    const params = new URLSearchParams({ fecha });
    if (turno) {
      params.set('turno', turno);
    }

    const respuesta = await fetch(`${API_BASE_URL}/api/rutas/programadas?${params.toString()}`, { headers });
    const json = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !json?.success) {
      throw new Error(json?.message || 'No se pudieron cargar las rutas programadas.');
    }

    const data = Array.isArray(json?.data) ? json.data : [];
    return data.map((ruta: Record<string, unknown>) => ({
      id: String(ruta.id ?? ''),
      tipo_unidad: ruta.tipo_unidad ? String(ruta.tipo_unidad) : null,
      codigo_unidad: ruta.codigo_unidad ? String(ruta.codigo_unidad) : null,
      capacidad_limite: Number(ruta.capacidad_limite) || undefined,
      asientos_ocupados: Number(ruta.asientos_ocupados) || 0,
      estado: ruta.estado ? String(ruta.estado) : undefined,
      cancelada: ruta.cancelada === true || ruta.estado === 'cancelada',
    }));
  };

  const cambiarUnidadProgramacion = async (payload: CambiarUnidadPayload) => {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/programacion/unidad`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    const json = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !json?.success) {
      throw new Error(traducirErrorUnidad(json?.message || 'No fue posible cambiar la unidad.'));
    }

    return json.data;
  };

  return {
    listarRutasProgramadas,
    cambiarUnidadProgramacion,
  };
}
