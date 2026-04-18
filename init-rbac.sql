-- ==========================================
-- Script SQL para crear tablas de RBAC
-- Compatible con MariaDB y PostgreSQL
-- ==========================================

-- 1. Tabla de Roles
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    color VARCHAR(7),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Usuarios
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uid VARCHAR(255) UNIQUE NOT NULL,          -- ID de Firebase Auth
    email VARCHAR(255) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    id_rol INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_login TIMESTAMP NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    creado_por INT,
    FOREIGN KEY (id_rol) REFERENCES roles(id),
    FOREIGN KEY (creado_por) REFERENCES usuarios(id),
    INDEX idx_email (email),
    INDEX idx_rol (id_rol),
    INDEX idx_activo (activo)
);

-- 3. Tabla de Permisos
CREATE TABLE permisos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(100) NOT NULL UNIQUE,       -- ej: 'rutas:ver', 'usuarios:crear'
    descripcion VARCHAR(255),
    recurso VARCHAR(50),                        -- ej: 'rutas', 'usuarios'
    accion VARCHAR(50),                         -- ej: 'ver', 'crear'
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Relación Roles-Permisos
CREATE TABLE rol_permisos (
    id_rol INT NOT NULL,
    id_permiso INT NOT NULL,
    asignado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_rol, id_permiso),
    FOREIGN KEY (id_rol) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (id_permiso) REFERENCES permisos(id) ON DELETE CASCADE
);

-- 5. Tabla de Auditoría
CREATE TABLE acciones_auditoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT,
    metodo VARCHAR(10),                         -- GET, POST, PUT, DELETE
    ruta VARCHAR(255),
    status_code INT,
    exitoso BOOLEAN,
    datos_request LONGTEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
    INDEX idx_usuario (id_usuario),
    INDEX idx_timestamp (timestamp)
);

-- ==========================================
-- INSERTAR ROLES INICIALES
-- ==========================================

INSERT INTO roles (nombre, descripcion, color) VALUES
('ADMIN', 'Administrador - Acceso total al sistema', '#0f172a'),
('JEFE', 'Jefe de Turno - Gestión de asignaciones', '#2563eb'),
('EMPLEADO', 'Empleado - Visualización de rutas', '#10b981');

-- ==========================================
-- INSERTAR PERMISOS INICIALES
-- ==========================================

INSERT INTO permisos (codigo, descripcion, recurso, accion) VALUES
-- Rutas
('rutas:ver', 'Ver rutas', 'rutas', 'ver'),
('rutas:crear', 'Crear rutas', 'rutas', 'crear'),
('rutas:actualizar', 'Actualizar rutas', 'rutas', 'actualizar'),
('rutas:eliminar', 'Eliminar rutas', 'rutas', 'eliminar'),
('rutas:sync', 'Sincronizar datos Python', 'rutas', 'sync'),

-- Asignaciones
('asignacion:crear', 'Crear asignaciones', 'asignacion', 'crear'),
('asignacion:ver', 'Ver asignaciones', 'asignacion', 'ver'),
('asignacion:cancelar', 'Cancelar asignaciones', 'asignacion', 'cancelar'),

-- Chat/IA
('chat:enviar', 'Enviar mensajes al copiloto', 'chat', 'enviar'),
('insights:ver', 'Ver insights automáticos', 'insights', 'ver'),

-- Dashboards
('dashboard:admin', 'Acceder a dashboard admin', 'dashboard', 'admin'),
('dashboard:jefe', 'Acceder a dashboard jefe', 'dashboard', 'jefe'),
('dashboard:empleado', 'Acceder a dashboard empleado', 'dashboard', 'empleado'),

-- Usuarios
('usuarios:ver', 'Ver usuarios', 'usuarios', 'ver'),
('usuarios:crear', 'Crear usuarios', 'usuarios', 'crear'),
('usuarios:actualizar', 'Actualizar usuarios', 'usuarios', 'actualizar'),
('usuarios:eliminar', 'Eliminar usuarios', 'usuarios', 'eliminar');

-- ==========================================
-- ASIGNAR PERMISOS A ROLES
-- ==========================================

-- ADMIN - Todos los permisos
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 1, id FROM permisos;

-- JEFE - Permisos limitados
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 2, id FROM permisos WHERE codigo IN (
    'rutas:ver', 'rutas:actualizar',
    'asignacion:crear', 'asignacion:ver', 'asignacion:cancelar',
    'chat:enviar', 'insights:ver',
    'dashboard:jefe', 'dashboard:empleado'
);

-- EMPLEADO - Permisos mínimos
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 3, id FROM permisos WHERE codigo IN (
    'rutas:ver',
    'asignacion:ver',
    'dashboard:empleado'
);

-- ==========================================
-- INSERTAR USUARIOS INICIALES
-- ==========================================

-- NOTA: En producción, los UIDs deben coincidir con Firebase Auth
-- Para desarrollo, puedes usar valores simulados

INSERT INTO usuarios (uid, email, nombre, id_rol, creado_por, activo) VALUES
('firebase-uid-admin-001', 'admin@ilpea.test', 'Administrador Principal', 1, NULL, TRUE),
('firebase-uid-jefe-001', 'jefe@ilpea.test', 'Jefe de Turno', 2, 1, TRUE),
('firebase-uid-empleado-001', 'empleado@ilpea.test', 'Empleado de Ejemplo', 3, 1, TRUE);

-- ==========================================
-- VISTAS ÚTILES PARA QUERIES
-- ==========================================

-- Vista: Usuarios con sus roles y permisos
CREATE VIEW v_usuarios_con_permisos AS
SELECT 
    u.id,
    u.uid,
    u.email,
    u.nombre,
    r.nombre AS rol,
    GROUP_CONCAT(p.codigo SEPARATOR ', ') AS permisos,
    u.activo,
    u.creado_en
FROM usuarios u
LEFT JOIN roles r ON u.id_rol = r.id
LEFT JOIN rol_permisos rp ON r.id = rp.id_rol
LEFT JOIN permisos p ON rp.id_permiso = p.id
GROUP BY u.id, u.uid, u.email, u.nombre, r.nombre, u.activo, u.creado_en;

-- Vista: Auditoría de usuarios
CREATE VIEW v_auditoria_acciones AS
SELECT 
    a.id,
    u.email,
    u.nombre,
    u.rol AS nombre_rol,
    a.metodo,
    a.ruta,
    a.status_code,
    a.exitoso,
    a.timestamp
FROM acciones_auditoria a
LEFT JOIN v_usuarios_con_permisos u ON a.id_usuario = u.id
ORDER BY a.timestamp DESC;

-- ==========================================
-- QUERIES ÚTILES
-- ==========================================

-- Obtener usuario con todos sus permisos
-- SELECT * FROM v_usuarios_con_permisos WHERE email = 'admin@ilpea.test';

-- Verificar si un usuario tiene un permiso específico
-- SELECT COUNT(*) FROM usuarios u
-- JOIN rol_permisos rp ON u.id_rol = rp.id_rol
-- JOIN permisos p ON rp.id_permiso = p.id
-- WHERE u.email = 'jefe@ilpea.test' AND p.codigo = 'chat:enviar';

-- Listar últimas acciones de un usuario
-- SELECT * FROM v_auditoria_acciones WHERE email = 'admin@ilpea.test' LIMIT 10;
