
export interface Ruta {
  id: string;
  ruta: number;
  "tipo de unidad": string;
  capacidad_real: number;
  max_pasajeros_dia: number;
  porcentaje_ocupacion_max: number;
  alerta_ocupacion: string;
  sugerencia_right_sizing: string;
}

export interface ProgramacionDiaria {
  id: string;                 
  fecha: string;              
  id_ruta: number;            
  capacidad_limite: number;   
  asientos_ocupados: number;  
  pasajeros_ids: string[];    
}

export interface Empleado {
  id_empleado: string;        
  nombre: string;             
  turno: string;              
  zona_abordaje: string;      
  ruta_asignada: string;      
}