// backend/src/lib/utils.js
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');
const { ROLES } = require('../config/roles');

function cargarCredencialesFirebase() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }

    const keyPath = process.env.FIREBASE_KEY_PATH
        ? path.resolve(__dirname, process.env.FIREBASE_KEY_PATH)
        : path.resolve(__dirname, '../config/firebase-key.json');

    return require(keyPath);
}

const serviceAccount = cargarCredencialesFirebase();

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    // Si ya fue inicializado en otro módulo, ignorar
}

const db = admin.firestore();

function esEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function generarPasswordTemporal(longitud = 12) {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let resultado = '';

    for (let i = 0; i < longitud; i += 1) {
        resultado += caracteres[crypto.randomInt(0, caracteres.length)];
    }

    return resultado;
}

let smtpTransporter = null;
let smtpVerificado = false;
let smtpFalloHasta = 0;
const SMTP_BACKOFF_MS = Number(process.env.SMTP_BACKOFF_MS || 120_000);
const SMTP_CONNECTION_TIMEOUT_MS = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 8_000);
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 12_000);

function normalizarVariableEntorno(valor) {
    const texto = String(valor || '').trim();

    if (
        (texto.startsWith('"') && texto.endsWith('"'))
        || (texto.startsWith("'") && texto.endsWith("'"))
    ) {
        return texto.slice(1, -1).trim();
    }

    return texto;
}

function escapeHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obtenerTransporterSMTP() {
    if (smtpTransporter) {
        return smtpTransporter;
    }

    const host = normalizarVariableEntorno(process.env.MAIL_HOST);
    const user = normalizarVariableEntorno(process.env.MAIL_USER);
    const pass = normalizarVariableEntorno(process.env.MAIL_PASS);
    const port = Number(process.env.MAIL_PORT || 465);
    const secureExplicito = normalizarVariableEntorno(process.env.MAIL_SECURE).toLowerCase();
    const secure = secureExplicito
        ? secureExplicito !== 'false'
        : port === 465;

    if (!host || !user || !pass) {
        return null;
    }

    smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass
        },
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
        ...(port === 587 && !secure ? { requireTLS: true } : {})
    });

    return smtpTransporter;
}

async function verificarTransporterSMTP() {
    const transporter = obtenerTransporterSMTP();
    if (!transporter) {
        return {
            ok: false,
            motivo: 'SMTP_NO_CONFIGURADO'
        };
    }

    if (smtpVerificado) {
        return { ok: true, motivo: null };
    }

    try {
        await transporter.verify();
        smtpVerificado = true;
        return { ok: true, motivo: null };
    } catch (error) {
        console.warn('Verificacion SMTP fallida:', error.message);
        return {
            ok: false,
            motivo: 'SMTP_VERIFICACION_FALLIDA',
            detalle: error.message
        };
    }
}

function filaCredencialCorreo(etiqueta, valor, { destacado = false, monospace = false } = {}) {
    const valorEstilo = [
        'padding: 14px 18px',
        'border-bottom: 1px solid #e5e7eb',
        'color: #000000',
        'font-size: 14px',
        `font-weight: ${destacado ? '700' : '600'}`,
        monospace ? "font-family: 'Courier New', Courier, monospace" : "font-family: Inter, Arial, sans-serif",
        destacado ? 'background: #f0fdf4' : 'background: #ffffff',
    ].join('; ');

    return `
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; width: 38%; background: #f9fafb; font-family: Inter, Arial, sans-serif;">
          ${etiqueta}
        </td>
        <td style="${valorEstilo}">
          ${valor}
        </td>
      </tr>
    `;
}

function construirContenidoCorreoCredenciales({ nombre, email, password, rol, idEmpleado = null }) {
    const rolNormalizado = String(rol || 'EMPLEADO').toUpperCase();
    const esJefe = rolNormalizado === 'JEFE';
    const perfil = esJefe ? 'Jefe de turno' : 'Empleado';

    const nombreSeguro = escapeHtml(nombre);
    const emailSeguro = escapeHtml(email);
    const passwordSeguro = escapeHtml(password);
    const idSeguro = idEmpleado ? escapeHtml(idEmpleado) : null;

    const filasHtml = [
        filaCredencialCorreo('Perfil', escapeHtml(perfil)),
        ...(idSeguro ? [filaCredencialCorreo('ID empleado', idSeguro, { monospace: true })] : []),
        filaCredencialCorreo('Nombre', nombreSeguro),
        filaCredencialCorreo('Correo', emailSeguro),
        filaCredencialCorreo('Contraseña temporal', passwordSeguro, { destacado: true, monospace: true }),
    ];

    const lineasCredencialesTexto = [
        `Perfil: ${perfil}`,
        ...(idEmpleado ? [`ID empleado: ${idEmpleado}`] : []),
        `Nombre: ${nombre}`,
        `Correo: ${email}`,
        `Contraseña temporal: ${password}`,
    ];

    const asunto = esJefe
        ? 'Acceso de jefe de turno — ILPEA Transporte'
        : 'Credenciales de acceso — ILPEA Transporte';

    const urlLogin = normalizarVariableEntorno(process.env.FRONTEND_URL || process.env.APP_URL || '');
    const botonLogin = urlLogin
        ? `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px auto 8px;">
          <tr>
            <td style="border-radius: 8px; background: #000000;">
              <a href="${escapeHtml(urlLogin)}" target="_blank" rel="noopener noreferrer"
                style="display: inline-block; padding: 14px 28px; font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; letter-spacing: 0.03em;">
                Ingresar al sistema
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 0; text-align: center; font-size: 12px; color: #6b7280; font-family: Inter, Arial, sans-serif;">
          ${escapeHtml(urlLogin)}
        </p>
      `
        : '';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(asunto)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Inter, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
          <tr>
            <td style="background: #000000; padding: 28px 32px 24px;">
              <p style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">ILPEA Transporte</p>
              <p style="margin: 0; font-size: 13px; color: #9ca3af; letter-spacing: 0.06em; text-transform: uppercase;">Gestión de flota</p>
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: #107c41; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 8px;">
              <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #000000;">Bienvenido(a), ${nombreSeguro}</p>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #374151;">
                Se creó tu cuenta de <strong>${escapeHtml(perfil)}</strong> en ILPEA Transporte.
                Usa las credenciales siguientes para iniciar sesión.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
                ${filasHtml.join('')}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 13px; line-height: 1.5; color: #92400e;">
                    Por seguridad, cambia tu contraseña después del primer acceso.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${botonLogin ? `<tr><td style="padding: 8px 32px 32px;">${botonLogin}</td></tr>` : '<tr><td style="padding-bottom: 32px;"></td></tr>'}
          <tr>
            <td style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center;">
                Mensaje automático de ILPEA Transporte. No respondas a este correo.<br />
                Si no solicitaste esta cuenta, contacta a tu administrador.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

    const text = [
        'ILPEA Transporte — Gestión de flota',
        '',
        `Hola ${nombre},`,
        `Se creó tu cuenta de ${perfil}.`,
        '',
        ...lineasCredencialesTexto,
        '',
        'Por seguridad, cambia tu contraseña después del primer acceso.',
        ...(urlLogin ? ['', `Ingresar: ${urlLogin}`] : []),
        '',
        'Mensaje automático. No respondas a este correo.',
    ].join('\n');

    return { asunto, html, text };
}

function smtpEnBackoff() {
    return Date.now() < smtpFalloHasta;
}

async function enviarCorreoCredencialesAcceso({ nombre, email, password, rol, idEmpleado = null }) {
    const destinatario = normalizarVariableEntorno(email);
    const contrasena = normalizarVariableEntorno(password);

    if (!destinatario || !contrasena) {
        return {
            enviado: false,
            motivo: 'DATOS_CORREO_INCOMPLETOS',
            detalle: 'Faltan correo destino o contraseña temporal.'
        };
    }

    if (smtpEnBackoff()) {
        return {
            enviado: false,
            motivo: 'SMTP_BACKOFF',
            detalle: 'SMTP en pausa tras un fallo reciente. Revisa backend/.env o espera unos minutos.'
        };
    }

    const transporter = obtenerTransporterSMTP();
    if (!transporter) {
        return {
            enviado: false,
            motivo: 'SMTP_NO_CONFIGURADO',
            detalle: 'Revisa MAIL_HOST, MAIL_USER, MAIL_PASS y MAIL_PORT en backend/.env'
        };
    }
    const remitenteEmail = normalizarVariableEntorno(
        process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER
    );
    const remitenteNombre = normalizarVariableEntorno(
        process.env.MAIL_FROM_NAME || 'ILPEA TRANSPORTS'
    );
    const contenido = construirContenidoCorreoCredenciales({
        nombre,
        email: destinatario,
        password: contrasena,
        rol,
        idEmpleado
    });

    try {
        await transporter.sendMail({
            from: remitenteEmail ? `"${remitenteNombre}" <${remitenteEmail}>` : undefined,
            to: destinatario,
            subject: contenido.asunto,
            html: contenido.html,
            text: contenido.text
        });

        smtpFalloHasta = 0;
        smtpVerificado = true;
        return {
            enviado: true,
            motivo: null,
            destinatario
        };
    } catch (error) {
        smtpFalloHasta = Date.now() + SMTP_BACKOFF_MS;
        console.warn(`No se pudo enviar correo de alta (${rol || 'usuario'}):`, error.message);
        return {
            enviado: false,
            motivo: 'SMTP_ENVIO_FALLIDO',
            detalle: error.message
        };
    }
}

function programarEnvioCorreoCredencialesAcceso(datos) {
    setImmediate(() => {
        enviarCorreoCredencialesAcceso(datos)
            .then((resultado) => {
                if (resultado.enviado) {
                    console.log(`Correo de alta enviado a ${resultado.destinatario}`);
                    return;
                }

                console.warn(
                    `Correo de alta no enviado (${resultado.motivo || 'DESCONOCIDO'}):`,
                    resultado.detalle || 'Sin detalle'
                );
            })
            .catch((error) => {
                console.warn('Error inesperado enviando correo de alta:', error.message);
            });
    });
}

function programarEnvioCorreoAltaEmpleado(datos) {
    programarEnvioCorreoCredencialesAcceso({
        ...datos,
        rol: 'EMPLEADO'
    });
}

function programarEnvioCorreoAltaJefe(datos) {
    programarEnvioCorreoCredencialesAcceso({
        ...datos,
        rol: 'JEFE'
    });
}

async function enviarCorreoAltaEmpleado({ nombre, email, idEmpleado, password }) {
    return enviarCorreoCredencialesAcceso({
        nombre,
        email,
        password,
        rol: 'EMPLEADO',
        idEmpleado
    });
}

async function enviarCorreoAltaJefe({ nombre, email, password }) {
    return enviarCorreoCredencialesAcceso({
        nombre,
        email,
        password,
        rol: 'JEFE'
    });
}

function formatearValorPorcentaje(valor, decimales = 2) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
        return 'N/D';
    }

    return numero.toFixed(decimales);
}

function convertirAFecha(valor) {
    if (!valor) return null;

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return valor;
    }

    if (typeof valor === 'object' && typeof valor.toDate === 'function') {
        const fecha = valor.toDate();
        return fecha instanceof Date && !Number.isNaN(fecha.getTime()) ? fecha : null;
    }

    if (typeof valor === 'object' && Number.isFinite(valor.seconds)) {
        const fecha = new Date(Number(valor.seconds) * 1000);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }

    const texto = String(valor).trim();
    if (!texto) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        const [anio, mes, dia] = texto.split('-').map(Number);
        const fecha = new Date(anio, mes - 1, dia);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }

    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatearFechaISO(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

function obtenerNumeroSemanaISO(fecha) {
    const fechaUTC = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const diaSemana = fechaUTC.getUTCDay() || 7;
    fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);
    const inicioAnio = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));
    return Math.ceil((((fechaUTC.getTime() - inicioAnio.getTime()) / 86400000) + 1) / 7);
}

function obtenerRangoSemanaISO(anio, semana) {
    const semanaNumero = Number(semana);
    const anioNumero = Number(anio) || new Date().getFullYear();

    if (!Number.isInteger(semanaNumero) || semanaNumero < 1 || semanaNumero > 53) {
        return null;
    }

    const inicioSemanaUno = new Date(Date.UTC(anioNumero, 0, 4));
    const diaSemana = inicioSemanaUno.getUTCDay() || 7;
    const desde = new Date(inicioSemanaUno);
    desde.setUTCDate(inicioSemanaUno.getUTCDate() - diaSemana + 1 + (semanaNumero - 1) * 7);

    const hasta = new Date(desde);
    hasta.setUTCDate(desde.getUTCDate() + 6);

    return {
        desde: formatearFechaISO(desde),
        hasta: formatearFechaISO(hasta),
        anio: anioNumero,
        semana: semanaNumero
    };
}

function evaluarAlertas({ tipoUnidad, capacidadReal, pasajeros }) {
    const maxPasajeros = Number(pasajeros) || 0;
    const capacidad = Number(capacidadReal) || 0;
    const porcentaje = capacidad > 0 ? (maxPasajeros / capacidad) * 100 : 0;
    const alerta = porcentaje < 40 ? 'CANCELAR RUTA - Menor al 40%' : 'OK';
    const tipo = String(tipoUnidad || '').toLowerCase();
    const sugerencia = tipo.includes('autobus') && maxPasajeros <= 12
        ? 'CAMBIAR A VAN'
        : 'MANTENER UNIDAD';

    return {
        ocupacion_pct: Number(porcentaje.toFixed(2)),
        porcentaje_ocupacion_max: Number(porcentaje.toFixed(2)),
        alerta_ocupacion: alerta,
        sugerencia_right_sizing: sugerencia
    };
}

function construirMetricasOperativas({ tipoUnidad, capacidadLimite, asientosOcupados, programada }) {
    if (!programada && asientosOcupados === 0) {
        return {
            ocupacion_pct: 0,
            porcentaje_ocupacion_max: 0,
            alerta_ocupacion: 'SIN PROGRAMACIÓN',
            sugerencia_right_sizing: 'SIN DATOS OPERATIVOS',
            max_pasajeros_dia: 0,
            fuente_datos: 'catalogo_sin_programacion'
        };
    }

    const metricas = evaluarAlertas({
        tipoUnidad,
        capacidadReal: capacidadLimite,
        pasajeros: asientosOcupados
    });

    return {
        ...metricas,
        max_pasajeros_dia: asientosOcupados,
        fuente_datos: programada ? 'programacion_diaria' : 'catalogo_sin_programacion'
    };
}

function normalizarPeriodoRuta(rutaData, fechaDefault = new Date()) {
    const fechaDetectada = convertirAFecha(
        rutaData?.fecha_operacion
        ?? rutaData?.fechaOperacion
        ?? rutaData?.fecha
        ?? rutaData?.dia
        ?? rutaData?.fecha_programada
    );

    const semanaDetectada = Number(
        rutaData?.semana_operacion
        ?? rutaData?.semanaOperacion
        ?? rutaData?.semana
        ?? rutaData?.week
        ?? rutaData?.iso_week
    );

    const fechaFinal = fechaDetectada || fechaDefault;
    const semanaFinal = Number.isInteger(semanaDetectada) && semanaDetectada > 0
        ? semanaDetectada
        : obtenerNumeroSemanaISO(fechaFinal);

    return {
        fecha_operacion: formatearFechaISO(fechaFinal),
        semana_operacion: semanaFinal
    };
}

async function generarIdEmpleadoUnico() {
    const maxIntentos = 20;

    for (let intento = 0; intento < maxIntentos; intento += 1) {
        const candidato = `EMP-${crypto.randomInt(100000, 999999)}`;
        const existe = await db
            .collection('usuarios')
            .where('id_empleado', '==', candidato)
            .limit(1)
            .get();

        if (existe.empty) {
            return candidato;
        }
    }

    throw new Error('No se pudo generar un ID de empleado único. Intenta nuevamente.');
}

function construirIdEmpleadoDesdeUid(uid) {
    const fragmento = String(uid || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(-6)
        .toUpperCase();

    if (!fragmento) {
        return `EMP-${crypto.randomInt(100000, 999999)}`;
    }

    return `EMP-${fragmento}`;
}

async function generarIdEmpleadoDeterministicoUnico(uid, idsReservados = new Set()) {
    const base = construirIdEmpleadoDesdeUid(uid);
    let candidato = base;
    let intento = 1;

    while (idsReservados.has(candidato)) {
        intento += 1;
        candidato = `${base}${String(intento).padStart(2, '0')}`;
    }

    while (true) {
        const existe = await db
            .collection('usuarios')
            .where('id_empleado', '==', candidato)
            .limit(1)
            .get();

        if (existe.empty || existe.docs[0].id === uid) {
            idsReservados.add(candidato);
            return candidato;
        }

        intento += 1;
        candidato = `${base}${String(intento).padStart(2, '0')}`;
    }
}

async function asegurarIdEmpleadoPersistido(doc, idsReservados = new Set()) {
    const data = doc.data() || {};
    const idActual = String(data.id_empleado || '').trim();

    if (idActual) {
        idsReservados.add(idActual);
        return idActual;
    }

    const idGenerado = await generarIdEmpleadoDeterministicoUnico(doc.id, idsReservados);
    await doc.ref.set({
        id_empleado: idGenerado,
        actualizado_en: new Date(),
        actualizado_por: 'auto-backfill-id-empleado'
    }, { merge: true });

    return idGenerado;
}

function normalizarEmpleado(doc) {
    const data = doc.data();
    return {
        uid: doc.id,
        id_empleado: data.id_empleado,
        email: data.email,
        nombre: data.nombre,
        rol: data.rol,
        jefe_uid: data.jefe_uid || null,
        activo: data.activo,
        creado_en: data.creado_en,
        actualizado_en: data.actualizado_en,
        creado_por: data.creado_por,
        actualizado_por: data.actualizado_por
    };
}

function normalizarJefe(doc) {
    const data = doc.data();
    return {
        uid: doc.id,
        email: data.email,
        nombre: data.nombre,
        rol: data.rol,
        activo: data.activo,
        creado_en: data.creado_en,
        actualizado_en: data.actualizado_en,
        creado_por: data.creado_por,
        actualizado_por: data.actualizado_por
    };
}

function puedeGestionarEmpleado(usuario, empleadoData) {
    if (!usuario || !empleadoData) {
        return false;
    }

    if (usuario.rol === ROLES.ADMIN) {
        return true;
    }

    return usuario.rol === ROLES.JEFE && empleadoData.jefe_uid === usuario.uid;
}

function textoNormalizado(valor) {
    return String(valor || '').trim();
}

function turnoNormalizado(turno) {
    return textoNormalizado(turno).toLowerCase();
}

function construirIdsProgramacion(fecha, idRuta, turno) {
    const fechaTexto = textoNormalizado(fecha);
    const idRutaTexto = textoNormalizado(idRuta);
    const turnoTexto = turnoNormalizado(turno);
    const ids = [];

    if (turnoTexto) {
        ids.push(`${fechaTexto}_${turnoTexto}_${idRutaTexto}`);
    }

    ids.push(`${fechaTexto}_${idRutaTexto}`);
    return ids;
}

function normalizarAsientosReservados(asientos) {
    if (!Array.isArray(asientos)) {
        return [];
    }

    return [...new Set(asientos
        .map((valor) => Number(valor))
        .filter((valor) => Number.isInteger(valor) && valor > 0))]
        .sort((a, b) => a - b);
}

function normalizarAsientosPorEmpleado(mapa) {
    if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) {
        return {};
    }

    const resultado = {};

    Object.entries(mapa).forEach(([idEmpleado, asiento]) => {
        const id = textoNormalizado(idEmpleado);
        const asientoNumero = Number(asiento);

        if (id && Number.isInteger(asientoNumero) && asientoNumero > 0) {
            resultado[id] = asientoNumero;
        }
    });

    return resultado;
}

async function leerDoc(ref, transaction = null) {
    if (transaction) {
        return transaction.get(ref);
    }

    return ref.get();
}

async function leerQuery(query, transaction = null) {
    if (transaction) {
        return transaction.get(query);
    }

    return query.get();
}

async function resolverRutaPorIdentificador(idRuta, transaction = null) {
    const idRutaTexto = textoNormalizado(idRuta);
    if (!idRutaTexto) {
        return null;
    }

    const rutasRef = db.collection('rutas');
    const rutaDirectaRef = rutasRef.doc(idRutaTexto);
    const rutaDirecta = await leerDoc(rutaDirectaRef, transaction);
    if (rutaDirecta.exists) {
        return {
            id: rutaDirecta.id,
            ref: rutaDirectaRef,
            data: rutaDirecta.data() || {}
        };
    }

    const numeroRuta = Number(idRutaTexto);
    if (!Number.isNaN(numeroRuta)) {
        const consultaNumero = rutasRef.where('ruta', '==', numeroRuta).limit(1);
        const rutaPorNumero = await leerQuery(consultaNumero, transaction);

        if (!rutaPorNumero.empty) {
            const doc = rutaPorNumero.docs[0];
            return {
                id: doc.id,
                ref: doc.ref,
                data: doc.data() || {}
            };
        }
    }

    return null;
}

async function resolverProgramacion(fecha, idRuta, turno, transaction = null) {
    const fechaTexto = textoNormalizado(fecha);
    const idRutaTexto = textoNormalizado(idRuta);
    const turnoTexto = turnoNormalizado(turno);
    const idsProgramacion = construirIdsProgramacion(fechaTexto, idRutaTexto, turnoTexto);

    for (const programacionId of idsProgramacion) {
        const ref = db.collection('programacion_diaria').doc(programacionId);
        const doc = await leerDoc(ref, transaction);
        if (doc.exists) {
            return {
                docId: programacionId,
                docRef: ref,
                data: doc.data() || {}
            };
        }
    }

    if (!turnoTexto && fechaTexto && idRutaTexto) {
        const query = db.collection('programacion_diaria')
            .where('fecha', '==', fechaTexto)
            .where('id_ruta', '==', idRutaTexto)
            .limit(1);

        const snapshot = await leerQuery(query, transaction);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return {
                docId: doc.id,
                docRef: doc.ref,
                data: doc.data() || {}
            };
        }
    }

    const docIdPrincipal = idsProgramacion[0];
    return {
        docId: docIdPrincipal,
        docRef: db.collection('programacion_diaria').doc(docIdPrincipal),
        data: null
    };
}

function construirProgramacionBase({ fecha, idRuta, turno, rutaData, uidCreador }) {
    const capacidad = Number(rutaData.capacidad_real) || 12;

    return {
        fecha: textoNormalizado(fecha),
        turno: turnoNormalizado(turno) || null,
        id_ruta: textoNormalizado(idRuta),
        capacidad_limite: capacidad,
        asientos_ocupados: 0,
        asientos_reservados: [],
        pasajeros_ids: [],
        asientos_por_empleado: {},
        programada_auto: true,
        zona: rutaData.zona || rutaData.nombre || null,
        tipo_unidad: rutaData['tipo de unidad'] || null,
        creado_en: new Date(),
        creado_por: uidCreador,
        actualizado_en: new Date(),
        actualizado_por: uidCreador
    };
}

function crearClienteOpenAI() {
    if (!process.env.OPENAI_API_KEY) return null;

    try {
        const OpenAI = require('openai');
        return new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 60000,
            maxRetries: 2
        });
    } catch (error) {
        console.warn('OpenAI deshabilitado: error de carga.');
        return null;
    }
}

function esTimeoutOpenAI(error) {
    const texto = String(error?.message || '').toLowerCase();
    const nombre = String(error?.name || '').toLowerCase();
    const codigo = String(error?.code || '').toLowerCase();

    return (
        texto.includes('request timed out')
        || texto.includes('timeout')
        || nombre.includes('timeout')
        || codigo.includes('etimedout')
        || codigo.includes('timeout')
    );
}

function generarRespuestaFallback(mensajeUsuario, rutas) {
    const totalRutas = rutas.length;
    const rutasCriticas = rutas.filter((r) => Number(r.porcentaje_ocupacion_max) < 40);
    const rutasRightSizing = rutas.filter(
        (r) =>
            String(r['tipo de unidad'] || '').toLowerCase().includes('autobus') &&
            Number(r.max_pasajeros_dia) <= 12
    );

    const consulta = String(mensajeUsuario || '').toLowerCase();

    if (consulta.includes('critica') || consulta.includes('cancel') || consulta.includes('40')) {
        if (!rutasCriticas.length) return 'No hay rutas en condición crítica (< 40%) con la data actual.';
        const listado = rutasCriticas
            .map((r) => `Ruta ${r.ruta} (${formatearValorPorcentaje(r.porcentaje_ocupacion_max)}%)`)
            .join(', ');
        return `Rutas críticas detectadas: ${listado}. Recomiendo revisión operativa inmediata.`;
    }

    if (consulta.includes('van') || consulta.includes('right') || consulta.includes('unidad')) {
        if (!rutasRightSizing.length) return 'No hay rutas candidatas claras para cambio de unidad en este momento.';
        const listado = rutasRightSizing.map((r) => `Ruta ${r.ruta}`).join(', ');
        return `Rutas candidatas a right-sizing (Autobús -> Van): ${listado}.`;
    }

    return `Resumen rápido: ${totalRutas} rutas analizadas, ${rutasCriticas.length} con ocupación menor a 40% y ${rutasRightSizing.length} candidatas a right-sizing.`;
}

function fechaISOHoy() {
    return new Date().toISOString().slice(0, 10);
}

function construirResumenOperativoChat(rutas, limite = 8) {
    const listado = Array.isArray(rutas) ? rutas : [];
    const totalRutas = listado.length;

    if (!totalRutas) {
        return {
            total_rutas: 0,
            ocupacion_promedio: 'N/D',
            rutas_criticas: [],
            rutas_right_sizing: []
        };
    }

    const rutasConOcupacion = listado
        .map((ruta) => {
            const ocupacion = Number(ruta.porcentaje_ocupacion_max);
            return {
                id: ruta.id || null,
                ruta: ruta.ruta ?? ruta.id ?? 'N/D',
                zona: ruta['ruta nombre'] || ruta.nombre_ruta || ruta.nombre || null,
                ocupacion: Number.isFinite(ocupacion) ? ocupacion : null,
                pasajeros: Number(ruta.max_pasajeros_dia),
                tipo_unidad: textoNormalizado(ruta['tipo de unidad'] || ruta.tipo_unidad)
            };
        })
        .filter((ruta) => Number.isFinite(ruta.ocupacion));

    const sumaOcupacion = rutasConOcupacion.reduce((acum, ruta) => acum + Number(ruta.ocupacion), 0);
    const promedio = rutasConOcupacion.length
        ? formatearValorPorcentaje(sumaOcupacion / rutasConOcupacion.length)
        : 'N/D';

    const rutasCriticas = rutasConOcupacion
        .filter((ruta) => Number(ruta.ocupacion) < 40)
        .sort((a, b) => Number(a.ocupacion) - Number(b.ocupacion))
        .slice(0, limite)
        .map((ruta) => ({
            ruta: ruta.ruta,
            zona: ruta.zona,
            ocupacion: `${formatearValorPorcentaje(ruta.ocupacion)}%`
        }));

    const rutasRightSizing = rutasConOcupacion
        .filter(
            (ruta) =>
                String(ruta.tipo_unidad || '').toLowerCase().includes('autobus')
                && Number.isFinite(ruta.pasajeros)
                && Number(ruta.pasajeros) <= 12
        )
        .sort((a, b) => Number(a.pasajeros) - Number(b.pasajeros))
        .slice(0, limite)
        .map((ruta) => ({
            ruta: ruta.ruta,
            zona: ruta.zona,
            pasajeros: Number(ruta.pasajeros)
        }));

    return {
        total_rutas: totalRutas,
        ocupacion_promedio: `${promedio}%`,
        rutas_criticas: rutasCriticas,
        rutas_right_sizing: rutasRightSizing
    };
}

async function obtenerContextoEmpleadosChat(usuario, limite = 20) {
    if (!usuario || !usuario.rol) {
        return {
            total: 0,
            activos: 0,
            muestra: []
        };
    }

    try {
        let consulta;

        if (usuario.rol === ROLES.JEFE) {
            consulta = db.collection('usuarios')
                .where('rol', '==', ROLES.EMPLEADO)
                .where('jefe_uid', '==', usuario.uid)
                .limit(limite);
        } else {
            consulta = db.collection('usuarios')
                .where('rol', '==', ROLES.EMPLEADO)
                .limit(limite);
        }

        const snapshot = await consulta.get();
        const muestra = [];
        let activos = 0;

        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            const activo = data.activo !== false;
            if (activo) {
                activos += 1;
            }

            muestra.push({
                id_empleado: textoNormalizado(data.id_empleado) || construirIdEmpleadoDesdeUid(doc.id),
                nombre: textoNormalizado(data.nombre) || null,
                activo,
                turno: textoNormalizado(data.turno) || null,
                jefe_uid: textoNormalizado(data.jefe_uid) || null
            });
        });

        return {
            total: snapshot.size,
            activos,
            muestra
        };
    } catch (error) {
        console.warn('No se pudo construir contexto de empleados para chat:', error.message);
        return {
            total: 0,
            activos: 0,
            muestra: []
        };
    }
}

async function obtenerPlanesIARecientesChat(limite = 8) {
    try {
        let snapshot;

        try {
            snapshot = await db
                .collection(exports.COLECCION_PLANES_IA)
                .orderBy('creado_en', 'desc')
                .limit(limite)
                .get();
        } catch (errorOrden) {
            snapshot = await db.collection(exports.COLECCION_PLANES_IA).limit(limite).get();
        }

        const planes = [];
        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            planes.push({
                id: doc.id,
                fecha: textoNormalizado(data.fecha) || null,
                turno: textoNormalizado(data.turno) || null,
                ruta_origen_id: textoNormalizado(data.ruta_origen_id) || null,
                ruta_destino_id: textoNormalizado(data.ruta_destino_id) || null,
                cantidad_empleados_movidos: Number(data.cantidad_empleados_movidos) || 0,
                estado_impacto: textoNormalizado(data.estado_impacto) || null,
                motivo: textoNormalizado(data.motivo) || null
            });
        });

        return planes;
    } catch (error) {
        console.warn('No se pudo obtener planes IA para chat:', error.message);
        return [];
    }
}

async function obtenerResumenProgramacionChat({ fecha, turno, limite = 10 } = {}) {
    const fechaTexto = textoNormalizado(fecha);
    const turnoTexto = turnoNormalizado(turno);

    if (!fechaTexto) {
        return {
            fecha: null,
            turno: turnoTexto || null,
            total_programadas: 0,
            muestra: []
        };
    }

    try {
        let query = db.collection('programacion_diaria').where('fecha', '==', fechaTexto);
        if (turnoTexto) {
            query = query.where('turno', '==', turnoTexto);
        }

        const snapshot = await query.limit(limite).get();
        const muestra = [];

        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            muestra.push({
                id_ruta: textoNormalizado(data.id_ruta) || null,
                turno: textoNormalizado(data.turno) || null,
                asientos_ocupados: Number(data.asientos_ocupados) || 0,
                capacidad_limite: Number(data.capacidad_limite) || 0
            });
        });

        return {
            fecha: fechaTexto,
            turno: turnoTexto || null,
            total_programadas: snapshot.size,
            muestra
        };
    } catch (error) {
        console.warn('No se pudo construir resumen de programacion para chat:', error.message);
        return {
            fecha: fechaTexto,
            turno: turnoTexto || null,
            total_programadas: 0,
            muestra: []
        };
    }
}

function generarInsightsLocales(rutas) {
    const insights = [];

    rutas.forEach((ruta) => {
        const rutaId = ruta.ruta ?? ruta.id ?? null;
        const nombreRuta = ruta['ruta nombre'] || ruta.nombre_ruta || ruta.nombre || `Ruta ${rutaId ?? 'sin id'}`;
        const ocupacion = Number(ruta.porcentaje_ocupacion_max);
        const pasajeros = Number(ruta.max_pasajeros_dia);
        const tipoUnidad = String(ruta['tipo de unidad'] || '').toLowerCase();

        if (!Number.isNaN(ocupacion) && ocupacion < 40) {
            const probabilidadCancelacion = calcularProbabilidadCancelacionDesdeOcupacion(ocupacion);
            insights.push({
                recomendacion_id: crearIdRecomendacion(rutaId, insights.length),
                titulo: `Cancelar Ruta - ${nombreRuta}`,
                descripcion: `La ruta ${nombreRuta} tiene una ocupación del ${formatearValorPorcentaje(ocupacion)}%, menor al 40%.`,
                prioridad: 'alta',
                ruta_id: rutaId,
                prob_cancelacion: probabilidadCancelacion,
                ruta_alternativa_sugerida: null
            });
        }

        if (tipoUnidad.includes('autobus') && !Number.isNaN(pasajeros) && pasajeros <= 12) {
            insights.push({
                recomendacion_id: crearIdRecomendacion(rutaId, insights.length),
                titulo: `Sugerir Van - ${nombreRuta}`,
                descripcion: `La ruta ${nombreRuta} tiene ${pasajeros} pasajeros, se sugiere cambiar a una Van.`,
                prioridad: 'media',
                ruta_id: rutaId,
                prob_cancelacion: null,
                ruta_alternativa_sugerida: null
            });
        }
    });

    return insights;
}

const COLECCION_HISTORICO_RECOMENDACIONES = 'historico_recomendaciones';
const COLECCION_FEEDBACK_IA = 'ai_feedback_recomendaciones';
const COLECCION_PLANES_IA = 'ai_planes_ejecutados';
const SEMANAS_MEMORIA_DEFECTO = 4;
const DECISIONES_IA_VALIDAS = ['ACEPTADA', 'RECHAZADA', 'PENDIENTE'];

function obtenerTipoEjemploPorDecision(decision) {
    if (decision === 'ACEPTADA') {
        return 'POSITIVE';
    }

    if (decision === 'RECHAZADA') {
        return 'NEGATIVE';
    }

    return 'PENDING';
}

function construirIncrementosDecisionSemanal(decision) {
    return {
        total_feedback: admin.firestore.FieldValue.increment(1),
        total_aceptadas: admin.firestore.FieldValue.increment(decision === 'ACEPTADA' ? 1 : 0),
        total_rechazadas: admin.firestore.FieldValue.increment(decision === 'RECHAZADA' ? 1 : 0),
        total_pendientes: admin.firestore.FieldValue.increment(decision === 'PENDIENTE' ? 1 : 0),
        total_negative_examples: admin.firestore.FieldValue.increment(decision === 'RECHAZADA' ? 1 : 0),
        total_positive_examples: admin.firestore.FieldValue.increment(decision === 'ACEPTADA' ? 1 : 0)
    };
}

function serializarFechaFirestore(valor) {
    if (!valor) {
        return null;
    }

    if (valor instanceof Date) {
        return valor.toISOString();
    }

    if (typeof valor.toDate === 'function') {
        return valor.toDate().toISOString();
    }

    return null;
}

function calcularEstadoImpactoPlan(cantidadEmpleadosMovidos) {
    const cantidad = Number(cantidadEmpleadosMovidos);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
        return 'bajo';
    }

    if (cantidad >= 10) {
        return 'alto';
    }

    if (cantidad >= 4) {
        return 'medio';
    }

    return 'bajo';
}

function formatearFechaISO(fecha) {
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
        return null;
    }

    return fecha.toISOString().slice(0, 10);
}

function obtenerInicioSemana(fechaReferencia = new Date()) {
    const fecha = new Date(fechaReferencia);
    const diaSemana = fecha.getUTCDay();
    const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;

    fecha.setUTCDate(fecha.getUTCDate() + ajuste);
    fecha.setUTCHours(0, 0, 0, 0);
    return fecha;
}

function obtenerSemanaKey(fechaReferencia = new Date()) {
    return formatearFechaISO(obtenerInicioSemana(fechaReferencia));
}

function normalizarDecisionIA(decision) {
    const valor = textoNormalizado(decision).toLowerCase();

    if (!valor) {
        return null;
    }

    if (['aceptada', 'aceptado', 'aprobar', 'aprobada', 'approved', 'approve', 'si', 's'].includes(valor)) {
        return 'ACEPTADA';
    }

    if (['rechazada', 'rechazado', 'rechazar', 'denied', 'deny', 'no'].includes(valor)) {
        return 'RECHAZADA';
    }

    if (['pendiente', 'postergada', 'diferida', 'defer', 'deferred'].includes(valor)) {
        return 'PENDIENTE';
    }

    return valor.toUpperCase();
}

function normalizarBooleano(valor) {
    if (typeof valor === 'boolean') {
        return valor;
    }

    const texto = textoNormalizado(valor).toLowerCase();
    if (!texto) {
        return null;
    }

    if (['1', 'true', 'si', 's', 'yes', 'correcto', 'correcta'].includes(texto)) {
        return true;
    }

    if (['0', 'false', 'no', 'incorrecto', 'incorrecta'].includes(texto)) {
        return false;
    }

    return null;
}

function extraerRutaTexto(item) {
    if (!item || typeof item !== 'object') {
        const textoDirecto = textoNormalizado(item);
        return textoDirecto || null;
    }

    const posibles = [
        item.ruta_id,
        item.id_ruta,
        item.ruta,
        item.ruta_codigo,
        item.nombre_ruta,
        item.nombre,
        item.ruta_nombre
    ];

    for (const candidato of posibles) {
        const texto = textoNormalizado(candidato);
        if (texto) {
            return texto;
        }
    }

    return null;
}

function incrementarFrecuenciaRuta(mapa, rutaTexto) {
    const ruta = textoNormalizado(rutaTexto);
    if (!ruta) {
        return;
    }

    mapa.set(ruta, (mapa.get(ruta) || 0) + 1);
}

function calcularProbabilidadCancelacionDesdeOcupacion(ocupacion) {
    const ocupacionNumero = Number(ocupacion);
    if (Number.isNaN(ocupacionNumero)) {
        return null;
    }

    if (ocupacionNumero >= 40) {
        return 0;
    }

    const probabilidad = Math.min(0.95, Math.max(0.4, (40 - ocupacionNumero) / 40));
    return Number(probabilidad.toFixed(2));
}

function crearIdRecomendacion(rutaId, indice = 0) {
    const fragmentoRuta = textoNormalizado(rutaId) || 'sin-ruta';
    return `REC-${Date.now()}-${fragmentoRuta}-${indice + 1}`;
}

function sanitizarInsight(insight, indice = 0) {
    if (!insight || typeof insight !== 'object') {
        return null;
    }

    const rutaId = textoNormalizado(insight.ruta_id || insight.id_ruta || insight.ruta);
    const titulo = textoNormalizado(insight.titulo || insight.title);
    const descripcion = textoNormalizado(insight.descripcion || insight.description);
    const prioridadRaw = textoNormalizado(insight.prioridad || 'media').toLowerCase();
    const prioridad = ['alta', 'media', 'baja'].includes(prioridadRaw) ? prioridadRaw : 'media';
    const probCancelacion = Number(insight.prob_cancelacion ?? insight.probabilidad_cancelacion);

    if (!rutaId || !titulo || !descripcion) {
        return null;
    }

    return {
        recomendacion_id: textoNormalizado(insight.recomendacion_id) || crearIdRecomendacion(rutaId, indice),
        titulo,
        descripcion,
        prioridad,
        ruta_id: rutaId,
        prob_cancelacion: Number.isFinite(probCancelacion) ? Number(probCancelacion.toFixed(2)) : null,
        ruta_alternativa_sugerida: textoNormalizado(
            insight.ruta_alternativa_sugerida || insight.ruta_destino_id || insight.ruta_destino || ''
        ) || null
    };
}

function sanitizarListaInsights(insights) {
    if (!Array.isArray(insights)) {
        return [];
    }

    return insights
        .map((insight, indice) => sanitizarInsight(insight, indice))
        .filter(Boolean);
}

function formatearPorcentaje(fraccion) {
    if (!Number.isFinite(fraccion)) {
        return 'N/D';
    }

    return `${(fraccion * 100).toFixed(2)}%`;
}

function construirResumenDecisiones(decisiones, limite = 4) {
    if (!Array.isArray(decisiones) || !decisiones.length) {
        return 'Sin decisiones recientes registradas.';
    }

    return decisiones.slice(0, limite).join(' | ');
}

async function construirAprendizajePrevioIA({ semanas = SEMANAS_MEMORIA_DEFECTO } = {}) {
    const frecuenciaRutas = new Map();
    const decisiones = [];
    let totalDecisiones = 0;
    let totalAceptadas = 0;
    let totalEvaluadas = 0;
    let totalAcertadas = 0;
    let semanasLeidas = 0;

    let historicoSnapshot;
    try {
        historicoSnapshot = await db
            .collection(COLECCION_HISTORICO_RECOMENDACIONES)
            .orderBy('semana_inicio', 'desc')
            .limit(semanas)
            .get();
    } catch (error) {
        console.warn('No se pudo ordenar historico_recomendaciones por semana_inicio. Se usa fallback simple.');
        historicoSnapshot = await db.collection(COLECCION_HISTORICO_RECOMENDACIONES).limit(semanas).get();
    }

    semanasLeidas = historicoSnapshot.size;

    historicoSnapshot.forEach((doc) => {
        const data = doc.data() || {};

        if (Array.isArray(data.rutas_criticas_recurrentes)) {
            data.rutas_criticas_recurrentes.forEach((ruta) => incrementarFrecuenciaRuta(frecuenciaRutas, ruta));
        }

        const recomendaciones = Array.isArray(data.recomendaciones) ? data.recomendaciones : [];
        recomendaciones.forEach((recomendacion) => {
            incrementarFrecuenciaRuta(frecuenciaRutas, extraerRutaTexto(recomendacion));

            const decision = normalizarDecisionIA(
                recomendacion.decision_admin || recomendacion.decision || recomendacion.feedback_admin
            );

            if (decision) {
                totalDecisiones += 1;
                if (decision === 'ACEPTADA') {
                    totalAceptadas += 1;
                }

                const rutaTexto = extraerRutaTexto(recomendacion) || 'Ruta sin identificar';
                decisiones.push(`${rutaTexto}: ${decision}`);
            }

            const evaluacion = normalizarBooleano(
                recomendacion.evaluacion_correcta ?? recomendacion.feedback_correcto ?? recomendacion.resultado_correcto
            );

            if (evaluacion !== null) {
                totalEvaluadas += 1;
                if (evaluacion) {
                    totalAcertadas += 1;
                }
            }
        });

        if (Array.isArray(data.decisiones_admin_recientes)) {
            data.decisiones_admin_recientes.forEach((decision) => {
                const texto = textoNormalizado(decision);
                if (texto) {
                    decisiones.push(texto);
                }
            });
        } else {
            const decisionTexto = textoNormalizado(data.decisiones_admin_recientes);
            if (decisionTexto) {
                decisiones.push(decisionTexto);
            }
        }

        if (Array.isArray(data.feedback_admin)) {
            data.feedback_admin.forEach((feedback) => {
                incrementarFrecuenciaRuta(frecuenciaRutas, extraerRutaTexto(feedback));

                const decision = normalizarDecisionIA(feedback.decision);
                if (decision) {
                    totalDecisiones += 1;
                    if (decision === 'ACEPTADA') {
                        totalAceptadas += 1;
                    }

                    const rutaTexto = extraerRutaTexto(feedback) || 'Ruta sin identificar';
                    decisiones.push(`${rutaTexto}: ${decision}`);
                }
            });
        }
    });

    let feedbackSnapshot;
    try {
        feedbackSnapshot = await db
            .collection(COLECCION_FEEDBACK_IA)
            .orderBy('creado_en', 'desc')
            .limit(Math.max(10, semanas * 8))
            .get();
    } catch (error) {
        console.warn('No se pudo ordenar ai_feedback_recomendaciones por creado_en. Se usa fallback simple.');
        feedbackSnapshot = await db.collection(COLECCION_FEEDBACK_IA).limit(Math.max(10, semanas * 8)).get();
    }

    feedbackSnapshot.forEach((doc) => {
        const data = doc.data() || {};
        incrementarFrecuenciaRuta(frecuenciaRutas, extraerRutaTexto(data));

        const decision = normalizarDecisionIA(data.decision);
        if (!decision) {
            return;
        }

        totalDecisiones += 1;
        if (decision === 'ACEPTADA') {
            totalAceptadas += 1;
        }

        const rutaTexto = extraerRutaTexto(data) || 'Ruta sin identificar';
        const motivo = textoNormalizado(data.razon) || textoNormalizado(data.motivo) || '';
        decisiones.push(motivo ? `${rutaTexto}: ${decision} (${motivo})` : `${rutaTexto}: ${decision}`);

        const evaluacion = normalizarBooleano(data.evaluacion_correcta ?? data.feedback_correcto ?? data.resultado_correcto);
        if (evaluacion !== null) {
            totalEvaluadas += 1;
            if (evaluacion) {
                totalAcertadas += 1;
            }
        }
    });

    const rutasCriticas = [...frecuenciaRutas.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ruta]) => ruta);

    const efectividad = totalEvaluadas > 0
        ? formatearPorcentaje(totalAcertadas / totalEvaluadas)
        : totalDecisiones > 0
            ? formatearPorcentaje(totalAceptadas / totalDecisiones)
            : 'N/D';

    const tasaAceptacion = totalDecisiones > 0
        ? formatearPorcentaje(totalAceptadas / totalDecisiones)
        : 'N/D';

    return {
        semanas_consideradas: semanasLeidas || semanas,
        rutas_criticas_recurrentes: rutasCriticas,
        efectividad_sugerencias_pasadas: efectividad,
        tasa_aceptacion_admin: tasaAceptacion,
        decisiones_admin_recientes: construirResumenDecisiones(decisiones),
        observacion: rutasCriticas.length
            ? 'El contexto prioriza patrones repetidos y decisiones recientes del administrador.'
            : 'Sin historico suficiente. Prioriza la metrica actual con validacion humana.'
    };
}

async function construirContextoIAConMemoria(rutasActuales, semanas = SEMANAS_MEMORIA_DEFECTO) {
    const aprendizajePrevio = await construirAprendizajePrevioIA({ semanas });

    return {
        metricas_actuales: Array.isArray(rutasActuales) ? rutasActuales : [],
        aprendizaje_previo: aprendizajePrevio
    };
}

function asientosOcupadosComoSet(asientosReservados, asientosPorEmpleado) {
    const ocupados = new Set(normalizarAsientosReservados(asientosReservados));

    Object.values(normalizarAsientosPorEmpleado(asientosPorEmpleado)).forEach((asiento) => {
        const numero = Number(asiento);
        if (Number.isInteger(numero) && numero > 0) {
            ocupados.add(numero);
        }
    });

    return ocupados;
}

function siguienteAsientoDisponible(asientosOcupados, capacidadMaxima) {
    const capacidad = Number(capacidadMaxima);
    if (!Number.isInteger(capacidad) || capacidad <= 0) {
        throw new Error('TARGET_CAPACITY_INVALID: Capacidad de destino invalida.');
    }

    for (let asiento = 1; asiento <= capacidad; asiento += 1) {
        if (!asientosOcupados.has(asiento)) {
            return asiento;
        }
    }

    throw new Error('TARGET_CAPACITY_EXCEEDED: No hay asientos disponibles en la ruta destino.');
}

function crearErrorHttp(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function existeIdEmpleado(idEmpleado, excluirUid = null) {
    const id = textoNormalizado(idEmpleado);
    if (!id) {
        return false;
    }

    const snapshot = await db
        .collection('usuarios')
        .where('id_empleado', '==', id)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return false;
    }

    if (excluirUid && snapshot.docs[0].id === excluirUid) {
        return false;
    }

    return true;
}

async function contarEmpleadosDeJefe(jefeUid) {
    const snapshot = await db
        .collection('usuarios')
        .where('rol', '==', ROLES.EMPLEADO)
        .where('jefe_uid', '==', jefeUid)
        .get();

    let total = 0;
    snapshot.forEach((doc) => {
        const data = doc.data() || {};
        if (data.activo !== false) {
            total += 1;
        }
    });

    return total;
}

function esRutaActiva(rutaData) {
    if (!rutaData || typeof rutaData !== 'object') {
        return true;
    }

    return rutaData.activa !== false;
}

async function resolverEmpleadoPorIdEmpleado(idEmpleado, cache = new Map()) {
    const id = textoNormalizado(idEmpleado);
    if (!id) {
        return null;
    }

    if (cache.has(id)) {
        return cache.get(id);
    }

    const snapshot = await db.collection('usuarios')
        .where('id_empleado', '==', id)
        .where('rol', '==', ROLES.EMPLEADO)
        .limit(1)
        .get();

    const empleado = !snapshot.empty
        ? {
            id_empleado: id,
            nombre: textoNormalizado(snapshot.docs[0].data()?.nombre) || id,
            email: textoNormalizado(snapshot.docs[0].data()?.email) || null,
        }
        : {
            id_empleado: id,
            nombre: id,
            email: null,
        };

    cache.set(id, empleado);
    return empleado;
}

async function obtenerBloqueoEliminacionRuta(idRuta) {
    const rutaEncontrada = await resolverRutaPorIdentificador(idRuta);
    if (!rutaEncontrada) {
        throw crearErrorHttp(404, 'La ruta no existe.');
    }

    const fechaMinima = fechaISOHoy();
    const snapshot = await db.collection('programacion_diaria')
        .where('id_ruta', '==', rutaEncontrada.id)
        .get();

    const empleadosMap = new Map();
    const cacheEmpleados = new Map();

    snapshot.forEach((doc) => {
        const data = doc.data() || {};
        const fecha = textoNormalizado(data.fecha);
        if (!fecha || fecha < fechaMinima) {
            return;
        }

        const pasajerosIds = Array.isArray(data.pasajeros_ids) ? data.pasajeros_ids : [];
        if (!pasajerosIds.length) {
            return;
        }

        const turno = textoNormalizado(data.turno) || null;
        const asientosPorEmpleado = normalizarAsientosPorEmpleado(data.asientos_por_empleado);
        const asientosReservados = normalizarAsientosReservados(data.asientos_reservados);

        pasajerosIds.forEach((pasajeroId, index) => {
            const idEmpleado = textoNormalizado(pasajeroId);
            if (!idEmpleado) {
                return;
            }

            const asientoDesdeMapa = asientosPorEmpleado[idEmpleado];
            const asiento = Number.isFinite(Number(asientoDesdeMapa))
                ? Number(asientoDesdeMapa)
                : (Number.isFinite(Number(asientosReservados[index])) ? Number(asientosReservados[index]) : null);

            const clave = `${idEmpleado}|${fecha}|${turno || ''}`;
            if (!empleadosMap.has(clave)) {
                empleadosMap.set(clave, {
                    id_empleado: idEmpleado,
                    fecha,
                    turno,
                    asiento,
                });
            }
        });
    });

    const empleadosPendientes = Array.from(empleadosMap.values());

    await Promise.all(
        empleadosPendientes.map(async (item) => {
            const info = await resolverEmpleadoPorIdEmpleado(item.id_empleado, cacheEmpleados);
            item.nombre = info?.nombre || item.id_empleado;
            item.email = info?.email || null;
        })
    );

    empleadosPendientes.sort((a, b) => {
        const fechaCmp = String(a.fecha).localeCompare(String(b.fecha));
        if (fechaCmp !== 0) {
            return fechaCmp;
        }

        return String(a.nombre).localeCompare(String(b.nombre), 'es');
    });

    const rutaData = rutaEncontrada.data || {};

    return {
        ruta: {
            id: rutaEncontrada.id,
            ruta: rutaData.ruta ?? null,
            zona: rutaData.zona || rutaData.nombre || null,
            tipo_unidad: rutaData['tipo de unidad'] || null,
            activa: esRutaActiva(rutaData),
            eliminada_en: rutaData.eliminada_en || null,
        },
        puede_eliminar: empleadosPendientes.length === 0,
        total_pasajeros: empleadosPendientes.length,
        empleados_a_reasignar: empleadosPendientes,
    };
}

async function liberarAsignacionesPorIdEmpleado(idEmpleado) {
    const id = textoNormalizado(idEmpleado);
    if (!id) {
        return 0;
    }

    const snapshot = await db
        .collection('programacion_diaria')
        .where('pasajeros_ids', 'array-contains', id)
        .get();

    if (snapshot.empty) {
        return 0;
    }

    const actualizaciones = [];

    snapshot.forEach((doc) => {
        const data = doc.data() || {};
        const pasajerosActuales = Array.isArray(data.pasajeros_ids) ? data.pasajeros_ids : [];
        const pasajerosIds = pasajerosActuales.filter((pasajero) => textoNormalizado(pasajero) !== id);
        const asientosPorEmpleado = normalizarAsientosPorEmpleado(data.asientos_por_empleado);
        delete asientosPorEmpleado[id];

        actualizaciones.push({
            ref: doc.ref,
            pasajeros_ids: pasajerosIds,
            asientos_por_empleado: asientosPorEmpleado,
        });
    });

    const BATCH_SIZE = 400;
    for (let indice = 0; indice < actualizaciones.length; indice += BATCH_SIZE) {
        const lote = actualizaciones.slice(indice, indice + BATCH_SIZE);
        const batch = db.batch();

        lote.forEach((item) => {
            batch.update(item.ref, {
                pasajeros_ids: item.pasajeros_ids,
                asientos_por_empleado: item.asientos_por_empleado,
                actualizado_en: new Date(),
            });
        });

        await batch.commit();
    }

    return actualizaciones.length;
}

async function eliminarUsuarioDefinitivo({
    uid,
    rolEsperado = null,
    usuarioSolicitante = null,
    validarPermisoEmpleado = false,
    invalidarCacheUsuario = null,
}) {
    const ref = db.collection('usuarios').doc(uid);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
        throw crearErrorHttp(404, 'Usuario no encontrado.');
    }

    const data = snapshot.data() || {};

    if (rolEsperado && data.rol !== rolEsperado) {
        throw crearErrorHttp(
            403,
            `Solo se pueden eliminar usuarios con rol ${rolEsperado}.`
        );
    }

    if (validarPermisoEmpleado && !puedeGestionarEmpleado(usuarioSolicitante, data)) {
        throw crearErrorHttp(403, 'No puedes eliminar empleados que no te pertenecen.');
    }

    if (data.rol === ROLES.JEFE) {
        const empleadosAsignados = await contarEmpleadosDeJefe(uid);
        if (empleadosAsignados > 0) {
            throw crearErrorHttp(
                409,
                `No se puede eliminar: tiene ${empleadosAsignados} empleado(s) asignados. Reasígnalos o elimínalos primero.`
            );
        }
    }

    if (data.rol === ROLES.EMPLEADO) {
        const idEmpleado = textoNormalizado(data.id_empleado) || construirIdEmpleadoDesdeUid(uid);
        await liberarAsignacionesPorIdEmpleado(idEmpleado);
    }

    try {
        await admin.auth().deleteUser(uid);
    } catch (error) {
        if (error.code !== 'auth/user-not-found') {
            throw error;
        }
    }

    await ref.delete();

    if (typeof invalidarCacheUsuario === 'function') {
        invalidarCacheUsuario(uid);
    }

    return {
        uid,
        rol: data.rol,
    };
}

module.exports = {
    admin,
    db,
    cargarCredencialesFirebase,
    esEmailValido,
    generarPasswordTemporal,
    escapeHtml,
    normalizarVariableEntorno,
    obtenerTransporterSMTP,
    verificarTransporterSMTP,
    enviarCorreoCredencialesAcceso,
    programarEnvioCorreoCredencialesAcceso,
    programarEnvioCorreoAltaEmpleado,
    programarEnvioCorreoAltaJefe,
    enviarCorreoAltaEmpleado,
    enviarCorreoAltaJefe,
    formatearValorPorcentaje,
    convertirAFecha,
    formatearFechaISO,
    obtenerNumeroSemanaISO,
    obtenerRangoSemanaISO,
    evaluarAlertas,
    construirMetricasOperativas,
    normalizarPeriodoRuta,
    generarIdEmpleadoUnico,
    construirIdEmpleadoDesdeUid,
    generarIdEmpleadoDeterministicoUnico,
    asegurarIdEmpleadoPersistido,
    normalizarEmpleado,
    normalizarJefe,
    puedeGestionarEmpleado,
    existeIdEmpleado,
    contarEmpleadosDeJefe,
    liberarAsignacionesPorIdEmpleado,
    esRutaActiva,
    resolverEmpleadoPorIdEmpleado,
    obtenerBloqueoEliminacionRuta,
    eliminarUsuarioDefinitivo,
    crearErrorHttp,
    textoNormalizado,
    turnoNormalizado,
    construirIdsProgramacion,
    normalizarAsientosReservados,
    normalizarAsientosPorEmpleado,
    leerDoc,
    leerQuery,
    resolverRutaPorIdentificador,
    resolverProgramacion,
    construirProgramacionBase,
    crearClienteOpenAI,
    esTimeoutOpenAI,
    generarRespuestaFallback,
    fechaISOHoy,
    construirResumenOperativoChat,
    obtenerContextoEmpleadosChat,
    obtenerPlanesIARecientesChat,
    obtenerResumenProgramacionChat,
    generarInsightsLocales,
    COLECCION_HISTORICO_RECOMENDACIONES,
    COLECCION_FEEDBACK_IA,
    COLECCION_PLANES_IA,
    SEMANAS_MEMORIA_DEFECTO,
    DECISIONES_IA_VALIDAS,
    obtenerTipoEjemploPorDecision,
    construirIncrementosDecisionSemanal,
    serializarFechaFirestore,
    calcularEstadoImpactoPlan,
    formatearFechaISO: formatearFechaISO,
    obtenerInicioSemana,
    obtenerSemanaKey,
    normalizarDecisionIA,
    normalizarBooleano,
    extraerRutaTexto,
    incrementarFrecuenciaRuta,
    calcularProbabilidadCancelacionDesdeOcupacion,
    crearIdRecomendacion,
    sanitizarInsight,
    sanitizarListaInsights,
    formatearPorcentaje,
    construirResumenDecisiones,
    construirAprendizajePrevioIA,
    construirContextoIAConMemoria,
    asientosOcupadosComoSet,
    siguienteAsientoDisponible,
};
