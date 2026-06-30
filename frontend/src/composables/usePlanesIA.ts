import { useAuth } from './useAuth';
import {
  type CambiarUnidadPayload,
  traducirErrorUnidad,
  useProgramacionUnidad,
} from './useProgramacionUnidad';

export type { CambiarUnidadPayload } from './useProgramacionUnidad';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface PlanIA {
  id: string;
  fecha: string;
  turno: string | null;
  ruta_origen_id: string;
  ruta_destino_id: string;
  ruta_origen_label?: string | null;
  ruta_destino_label?: string | null;
  cantidad_empleados_movidos: number;
  estado_impacto: 'alto' | 'medio' | 'bajo';
  motivo: string | null;
  ejecutado_en?: string | null;
}

export interface EjecutarPlanPayload {
  ruta_origen_id: string;
  ruta_destino_id: string;
  fecha: string;
  turno?: string | null;
  recomendacion_id?: string | null;
  motivo?: string | null;
  empleados_ids?: string[];
  cancelar_origen?: boolean;
}

export interface FeedbackPlanPayload {
  recomendacion_id?: string | null;
  ruta_id: string;
  decision: 'ACEPTADA' | 'RECHAZADA' | 'PENDIENTE';
  razon?: string | null;
  prob_cancelacion?: number | null;
  ruta_alternativa_sugerida?: string | null;
}

export function traducirErrorPlan(mensaje: string): string {
  const texto = String(mensaje || '').trim();
  if (!texto) return 'No fue posible ejecutar el plan IA.';

  if (texto.startsWith('SOURCE_ASSIGNMENT_NOT_FOUND')) {
    return 'No existe programación para la ruta origen en la fecha y turno seleccionados.';
  }
  if (texto.startsWith('EMPLOYEE_NOT_IN_SOURCE')) {
    return 'Uno o más empleados no están asignados en la ruta origen.';
  }
  if (texto.startsWith('TARGET_CAPACITY_EXCEEDED')) {
    return 'La ruta destino no tiene capacidad suficiente para recibir a todos los empleados.';
  }
  if (texto.startsWith('DUPLICATE_TARGET_ASSIGNMENT')) {
    return 'Algunos empleados ya están asignados en la ruta destino.';
  }
  if (texto.startsWith('EMPTY_SOURCE_ROUTE')) {
    return 'La ruta origen no tiene empleados asignados para mover.';
  }
  if (texto.startsWith('EMPTY_MOVE_SET')) {
    return 'No se recibieron empleados para mover.';
  }
  if (texto.startsWith('CANNOT_CANCEL_NON_EMPTY_ROUTE')) {
    return 'Para cancelar la ruta origen primero se deben mover todos los empleados.';
  }
  if (texto.startsWith('SOURCE_ROUTE_CANCELLED')) {
    return 'La ruta origen ya está cancelada para esa fecha y turno.';
  }
  if (texto.startsWith('TARGET_ROUTE_CANCELLED')) {
    return 'La ruta destino está cancelada para esa fecha y turno.';
  }
  const traducidoUnidad = traducirErrorUnidad(texto);
  if (traducidoUnidad !== texto) {
    return traducidoUnidad;
  }

  return texto;
}

export function usePlanesIA() {
  const { authHeaders } = useAuth();
  const { cambiarUnidadProgramacion } = useProgramacionUnidad();

  const listarPlanesEjecutados = async (limit = 6): Promise<PlanIA[]> => {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/ai/planes-ejecutados?limit=${limit}`, { headers });
    const json = await respuesta.json();

    if (!respuesta.ok || !json?.success) {
      throw new Error(json?.message || 'Error al consultar planes IA.');
    }

    const data = Array.isArray(json?.data) ? json.data : [];
    return data.map((plan: Record<string, unknown>) => ({
      id: String(plan.id ?? ''),
      fecha: String(plan.fecha ?? ''),
      turno: plan.turno ? String(plan.turno) : null,
      ruta_origen_id: String(plan.ruta_origen_id ?? 'N/D'),
      ruta_destino_id: String(plan.ruta_destino_id ?? 'N/D'),
      ruta_origen_label: plan.ruta_origen_label ? String(plan.ruta_origen_label) : null,
      ruta_destino_label: plan.ruta_destino_label ? String(plan.ruta_destino_label) : null,
      cantidad_empleados_movidos: Number(plan.cantidad_empleados_movidos) || 0,
      estado_impacto: (['alto', 'medio', 'bajo'].includes(String(plan.estado_impacto))
        ? plan.estado_impacto
        : 'bajo') as PlanIA['estado_impacto'],
      motivo: plan.motivo ? String(plan.motivo) : null,
      ejecutado_en: plan.ejecutado_en ? String(plan.ejecutado_en) : null
    }));
  };

  const ejecutarPlan = async (payload: EjecutarPlanPayload) => {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/ai/ejecutar-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload)
    });
    const json = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !json?.success) {
      throw new Error(traducirErrorPlan(json?.message || 'No fue posible ejecutar el plan IA.'));
    }

    return json.data;
  };

  const registrarFeedback = async (payload: FeedbackPlanPayload) => {
    const headers = await authHeaders();
    const respuesta = await fetch(`${API_BASE_URL}/api/ai/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload)
    });
    const json = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !json?.success) {
      throw new Error(json?.message || 'No fue posible registrar el feedback.');
    }

    return json.feedback;
  };

  return {
    listarPlanesEjecutados,
    ejecutarPlan,
    cambiarUnidadProgramacion,
    registrarFeedback
  };
}
