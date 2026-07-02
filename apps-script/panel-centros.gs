/**
 * Donaciones Venezuela - Panel de Centros (Paso A)
 * --------------------------------------------------------------------------
 * Alta de centros con acceso por token + PIN para el futuro panel interno.
 * Diseño completo en: docs/DISENO_PANEL_CENTRO.md
 *
 * Este archivo comparte scope global con codigo.gs (Apps Script junta todos
 * los .gs del proyecto). Reutiliza: texto(), normalizar(), asegurarHoja(),
 * anexarObjeto(), jsonResponse(), generarSegmentoToken(), errorMessage().
 *
 * Seguridad:
 * - El PIN NUNCA se guarda ni se devuelve en claro. Solo se persiste su hash
 *   SHA-256 con el token como salt (hash distinto aunque dos PIN coincidan).
 * - El token es la primera barrera (URL privada); el PIN, la segunda.
 */

const CENTROS_PANEL_SHEET = "centros_panel";
const CENTROS_PANEL_HEADERS = [
  "id_centro", "token_centro", "pin_hash", "nombre", "tipo", "telefono", "creado"
];

// -- REGISTRO (accion=registrar_centro_panel) -------------------------------
function registrarCentroPanel(payload) {
  const nombre = texto(payload.nombre);
  const tipo = texto(payload.tipo) || "Centro de acopio";
  const telefono = texto(payload.telefono);
  const pin = texto(payload.pin);

  if (!nombre || !telefono || !pin) {
    throw new Error("Faltan campos obligatorios: nombre, telefono, pin");
  }
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("El pin debe tener entre 4 y 8 digitos numericos");
  }
  if (!nombreCentroPanelDisponible(nombre)) {
    throw new Error("Ya existe un centro registrado con ese nombre");
  }

  const hoja = asegurarHoja(CENTROS_PANEL_SHEET, CENTROS_PANEL_HEADERS);
  const idCentro = generarId(hoja, "CEN");
  const tokenCentro = generarTokenCentro();
  const pinHash = hashPinCentro(pin, tokenCentro);

  anexarObjeto(CENTROS_PANEL_SHEET, CENTROS_PANEL_HEADERS, {
    id_centro: idCentro,
    token_centro: tokenCentro,
    pin_hash: pinHash,
    nombre: nombre,
    tipo: tipo,
    telefono: telefono,
    creado: new Date()
  });

  return jsonResponse({
    success: true,
    exito: true,
    id_centro: idCentro,
    token_centro: tokenCentro,
    panel_hash: "#centro/" + tokenCentro,
    mensaje: "Centro registrado. Guarda tu enlace y tu PIN: sin ellos no podras entrar al panel."
  });
}

// -- HELPERS -----------------------------------------------------------------
function nombreCentroPanelDisponible(nombre) {
  const hoja = obtenerHojaOpcional(CENTROS_PANEL_SHEET);
  if (!hoja || hoja.getLastRow() < 2) return true;
  const buscado = normalizar(nombre);
  const data = hoja.getDataRange().getValues();
  const headers = data[0].map(texto);
  const idxNombre = headers.indexOf("nombre");
  if (idxNombre === -1) return true;
  for (let i = 1; i < data.length; i++) {
    if (normalizar(texto(data[i][idxNombre])) === buscado) return false;
  }
  return true;
}

function generarTokenCentro() {
  const usados = tokensCentrosExistentes();
  for (let intento = 0; intento < 80; intento++) {
    const token = "CTR-" + generarSegmentoToken() + "-" + generarSegmentoToken() + "-" + generarSegmentoToken();
    if (!usados[token]) return token;
  }
  throw new Error("No se pudo generar un token de centro unico");
}

function tokensCentrosExistentes() {
  const usados = {};
  const hoja = obtenerHojaOpcional(CENTROS_PANEL_SHEET);
  if (!hoja || hoja.getLastRow() < 2) return usados;
  const data = hoja.getDataRange().getValues();
  const headers = data[0].map(texto);
  const idxToken = headers.indexOf("token_centro");
  if (idxToken === -1) return usados;
  for (let i = 1; i < data.length; i++) {
    const token = texto(data[i][idxToken]);
    if (token) usados[token] = true;
  }
  return usados;
}

function hashPinCentro(pin, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    texto(pin) + "|" + texto(salt),
    Utilities.Charset.UTF_8
  );
  return bytesAHexCentro(bytes);
}

function bytesAHexCentro(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    let byte = bytes[i];
    if (byte < 0) byte += 256;
    const parte = byte.toString(16);
    hex += (parte.length === 1 ? "0" : "") + parte;
  }
  return hex;
}

// Validador reutilizable para los Pasos B y C (leer y editar el panel):
// devuelve la fila del centro si token+pin son correctos, o null.
function validarAccesoCentro(token, pin) {
  const tokenBuscado = texto(token);
  const pinTexto = texto(pin);
  if (!tokenBuscado || !pinTexto) return null;

  const hoja = obtenerHojaOpcional(CENTROS_PANEL_SHEET);
  if (!hoja || hoja.getLastRow() < 2) return null;

  const data = hoja.getDataRange().getValues();
  const headers = data[0].map(texto);
  const idxToken = headers.indexOf("token_centro");
  const idxHash = headers.indexOf("pin_hash");
  if (idxToken === -1 || idxHash === -1) return null;

  for (let i = 1; i < data.length; i++) {
    if (texto(data[i][idxToken]) === tokenBuscado) {
      const hashGuardado = texto(data[i][idxHash]);
      const hashIngresado = hashPinCentro(pinTexto, tokenBuscado);
      if (hashGuardado === hashIngresado) {
        const centro = {};
        headers.forEach(function (header, idx) { centro[header] = data[i][idx]; });
        return centro;
      }
      return null; // token correcto pero PIN incorrecto: no dar pistas
    }
  }
  return null;
}
