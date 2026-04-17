import pandas as pd
import numpy as np
import os

def procesar_historico_rutas(file_path):
    """
    Lee el archivo Excel de aforos, estandariza capacidades 
    y evalúa las reglas estrictas de negocio de ILPEA.
    """
    print(f"Iniciando procesamiento del archivo: {file_path}")
    
    # 1. Carga de datos (simulando la lectura del Excel de Aforos)

    try:
        # Cambiamos 'Aforos' por 'Aforos Ilpea' que es el nombre real en tu archivo
        df = pd.read_excel(file_path, sheet_name='Aforos Ilpea', skiprows=1)
    except Exception as e:
        print(f"Error al leer el archivo: {e}")
        return None

    # 2. Limpieza EXTREMA de columnas y validación de existencia
    df.columns = df.columns.astype(str) \
                   .str.replace('\n', ' ', regex=True) \
                   .str.replace('\r', ' ', regex=True) \
                   .str.strip() \
                   .str.lower() \
                   .str.replace(r'\s+', ' ', regex=True)
    
    # Rellenar columnas faltantes con texto vacío (no con números)
    columnas_esperadas = ['ruta', 'tipo de unidad', '1er turno', '2do turno', '3er turno']
    for col in columnas_esperadas:
        if col not in df.columns:
            df[col] = '' # Usamos string vacío en lugar de 0
            
    # 3. Aplicar Reglas de Negocio Estrictas (Capacidades Reales)
    # FORZAMOS a que la columna sea tratada como texto para evitar el error de enteros/NaN
    df['tipo de unidad'] = df['tipo de unidad'].astype(str)
    
    condiciones_capacidad = [
        (df['tipo de unidad'].str.lower().str.contains('autobus', na=False)),
        (df['tipo de unidad'].str.lower().str.contains('van', na=False))
    ]
    # Recuerda: Autobús = 30, Van = 12
    valores_capacidad = [30, 12]
    
    df['capacidad_real'] = np.select(condiciones_capacidad, valores_capacidad, default=0)
    
    # 4. Limpieza de datos numéricos en los turnos (remover textos y dejar solo números)
    turnos = ['1er turno', '2do turno', '3er turno']
    for turno in turnos:
        df[turno] = pd.to_numeric(df[turno], errors='coerce').fillna(0)

    # 5. Obtener la ocupación máxima del día para evaluar la ruta
    df['max_pasajeros_dia'] = df[turnos].max(axis=1)
    
    # 6. Motor de "Right-Sizing" y Regla del 40%
    # Calculamos el porcentaje basado en la capacidad real
    df['porcentaje_ocupacion_max'] = (df['max_pasajeros_dia'] / df['capacidad_real']) * 100
    
    # Evaluamos banderas de acción
    df['alerta_ocupacion'] = np.where(df['porcentaje_ocupacion_max'] < 40, 'CANCELAR RUTA - Menor al 40%', 'OK')
    
    # Sugerencia de Right-Sizing: Si es un Autobús (30) pero su máximo es menor o igual a 12 (capacidad de Van)
    df['sugerencia_right_sizing'] = np.where(
        (df['tipo de unidad'].str.lower().str.contains('autobus')) & (df['max_pasajeros_dia'] <= 12),
        'CAMBIAR A VAN',
        'MANTENER UNIDAD'
    )

    # 7. Selección de columnas finales para enviar al Backend (Firebase/Node.js)
    df_final = df[[
        'ruta', 
        'tipo de unidad', 
        'capacidad_real', 
        'max_pasajeros_dia', 
        'porcentaje_ocupacion_max', 
        'alerta_ocupacion', 
        'sugerencia_right_sizing'
    ]]
    
    return df_final

# --- Bloque de Ejecución Principal ---
if __name__ == "__main__":
    # 1. Obtenemos la ruta absoluta de donde está guardado ESTE script (src/)
    directorio_script = os.path.dirname(os.path.abspath(__file__))
    
    # 2. Construimos la ruta segura: subimos un nivel (..) y entramos a 'data'
    nombre_archivo = "Reporte de usuarios Ilpea Periodo del 09 de Marzo al 15 de Marzo del 2026.xlsx" # Asegúrate de que las mayúsculas y espacios coincidan EXACTAMENTE con el nombre de tu archivo
    ruta_archivo = os.path.join(directorio_script, "..", "data", nombre_archivo)
    
    print(f"Buscando el archivo en la ruta absoluta: {ruta_archivo}")
    
    # 3. Ejecutamos la función
    df_procesado = procesar_historico_rutas(ruta_archivo)
    
    if df_procesado is not None:
        print("\n¡Datos procesados con éxito!")
        print(df_procesado.head())