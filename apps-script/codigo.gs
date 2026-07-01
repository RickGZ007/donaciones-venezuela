/**
 * Donaciones Venezuela - Backend (Google Apps Script)
 * --------------------------------------------------------------------------
 * Base de datos: Google Sheets.
 * Spreadsheet principal:
 * 1fnXiSy1TbPqwlLKDSfPoBfKs8pH0WptoECGq_zu_Lco
 *
 * Compatibilidad obligatoria:
 * - La hoja "lugares" mantiene el esquema original A-H:
 *   Tipo, Nombre, Ubicacion, Telefono, Insumo, Categoria, Estado, Actualizado
 * - Se conservan endpoints existentes de centros, motorizados, trayectos,
 *   historial y donaciones a motorizados.
 * - Se agregan hojas/endpoints para voluntarios, rescatistas y trazabilidad
 *   publica de facturas por token.
 */

const SHEET_ID = '1fnXiSy1TbPqwlLKDSfPoBfKs8pH0WptoECGq_zu_Lco';

const LUGARES_SHEET = "lugares";
const CENTROS_SHEET = "centros_necesidades";
const MOTORIZADOS_SHEET = "motorizados";
const TRAYECTOS_SHEET = "trayectos";
const HISTORIAL_SHEET = "historial_movimientos";
const DONACIONES_MOTORIZADOS_SHEET = "donaciones_motorizados";
const VOLUNTARIOS_SHEET = "voluntarios";
const RESCATISTAS_SHEET = "rescatistas";
const FACTURAS_SHEET = "facturas";
const DONACIONES_SHEET = "donaciones";
const MOVIMIENTOS_FACTURA_SHEET = "movimientos_factura";
const EVIDENCIAS_SHEET = "evidencias";

const LUGARES_HEADERS = [
  "Tipo", "Nombre", "Ubicacion", "Telefono", "Insumo", "Categoria", "Estado", "Actualizado"
];
const VOLUNTARIOS_HEADERS = [
  "id", "nombre", "apellido", "telefono", "estado", "ciudad", "profesion",
  "disponibilidad", "medio_transporte", "observaciones", "fecha_registro"
];
const RESCATISTAS_HEADERS = [
  "id", "nombre", "organizacion", "telefono", "especialidad", "estado", "ciudad",
  "disponibilidad", "equipo_disponible", "capacidad_operativa", "observaciones", "fecha_registro"
];
const HISTORIAL_HEADERS = [
  "Timestamp", "TipoLugar", "Lugar", "Insumo", "TipoMovimiento", "Cantidad",
  "Unidad", "Voluntario", "CantidadAcumulada", "Observaciones"
];
const MOTORIZADOS_HEADERS = [
  "id", "nombre", "tipoVehiculo", "telefono", "operaEn", "placa", "estado",
  "fechaRegistro", "totalTrayectos", "totalKm", "aporteDonado", "verificado", "ultimoTrayecto"
];
const TRAYECTOS_HEADERS = [
  "Timestamp", "IdMotorizado", "NombreMotorizado", "Origen", "Destino", "Km",
  "Minutos", "Insumo", "Cantidad", "Unidad", "Foto", "Notas", "Verificado"
];
const DONACIONES_MOTORIZADOS_HEADERS = [
  "Timestamp", "IdMotorizado", "NombreMotorizado", "Monto", "Tipo", "Donante", "Mensaje", "Ciudad"
];
const FACTURAS_HEADERS = [
  "id", "numero_factura", "token_publico", "objetivo", "descripcion",
  "monto_requerido", "monto_recaudado", "estado", "fecha_creacion", "fecha_cierre"
];
const DONACIONES_HEADERS = [
  "id", "factura_id", "nombre_donante", "monto", "referencia_pago", "fecha", "estado"
];
const MOVIMIENTOS_FACTURA_HEADERS = [
  "id", "factura_id", "tipo", "descripcion", "monto", "fecha"
];
const EVIDENCIAS_HEADERS = [
  "id", "factura_id", "archivo", "descripcion", "fecha"
];

// -- PUNTOS DE ENTRADA ------------------------------------------------------
function doGet(e) {
  try {
    inicializarHojasBase();

    const params = (e && e.parameter) || {};
    const accion = normalizar(params.accion || "");

    if (accion === "registrar_lugar" || accion === "agregar_lugar") return registrarLugar(params);
    if (accion === "registrar_voluntario") return registrarVoluntario(params);
    if (accion === "registrar_rescatista") return registrarRescatista(params);
    if (accion === "registrar_trayecto") return registrarTrayecto(params);
    if (accion === "donar_motorizado") return donarMotorizado(params);
    if (accion === "registrar_motorizado") return registrarMotorizado(params);
    if (accion === "crear_factura" || accion === "registrar_factura") return registrarFactura(params);
    if (accion === "registrar_donacion" || accion === "registrar_donacion_factura") return registrarDonacionFactura(params);
    if (accion === "registrar_movimiento_factura") return registrarMovimientoFactura(params);
    if (accion === "registrar_evidencia" || accion === "registrar_evidencia_factura") return registrarEvidenciaFactura(params);
    if (accion === "sincronizar_lugares" || accion === "verificar_integridad") return sincronizarRegistrosLugares(params);
    if (accion === "buscar_familiar" || accion === "familiares") return buscarFamiliares(params);

    if (accion === "seguimiento_factura" || accion === "seguimiento_token" || accion === "trazabilidad") return obtenerSeguimientoFactura(params);
    if (accion === "facturas") return listarFacturas(params);
    if (accion === "lugares") return listarLugares(params);
    if (accion === "centros") return listarCentros();
    if (accion === "estadisticas" || accion === "stats") return listarEstadisticas();
    if (accion === "voluntarios") return listarVoluntarios(params);
    if (accion === "rescatistas") return listarRescatistas(params);
    if (accion === "motorizados") return listarMotorizados();
    if (accion === "perfil_motorizado") return obtenerPerfilMotorizado(params.id);
    if (accion === "trayectos") return obtenerTrayectos(params.motorizado || params.motorizadoId || null);
    if (accion === "historial") return obtenerHistorialMovimientos(params.centro || params.lugar || null);

    const lugares = construirLugares();
    const centros = construirCentrosSeguro(lugares);
    const voluntarios = filtrarPersonas(construirVoluntarios(), params);
    const rescatistas = filtrarPersonas(construirRescatistas(), params);
    const motorizados = construirMotorizadosSeguro();
    const estadisticas = construirEstadisticas({ lugares, voluntarios, rescatistas, motorizados });

    return jsonResponse({
      lugares,
      centros,
      voluntarios,
      rescatistas,
      motorizados,
      estadisticas,
      stats: estadisticas
    });
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500);
  }
}

function doPost(e) {
  try {
    inicializarHojasBase();

    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const accion = normalizar(payload.accion || "");

    if (accion === "lugares" || accion === "registrar_lugar" || accion === "agregar_lugar") {
      return registrarLugar(payload);
    }
    if (accion === "voluntarios" || accion === "registrar_voluntario") {
      return registrarVoluntario(payload);
    }
    if (accion === "rescatistas" || accion === "registrar_rescatista") {
      return registrarRescatista(payload);
    }
    if (accion === "sincronizar_lugares" || accion === "verificar_integridad") {
      return sincronizarRegistrosLugares(payload);
    }
    if (accion === "registrar_movimiento") return registrarMovimiento(payload);
    if (accion === "registrar_trayecto") return registrarTrayecto(payload);
    if (accion === "donar_motorizado") return donarMotorizado(payload);
    if (accion === "registrar_motorizado") return registrarMotorizado(payload);
    if (accion === "crear_factura" || accion === "registrar_factura") return registrarFactura(payload);
    if (accion === "registrar_donacion" || accion === "registrar_donacion_factura") return registrarDonacionFactura(payload);
    if (accion === "registrar_movimiento_factura") return registrarMovimientoFactura(payload);
    if (accion === "registrar_evidencia" || accion === "registrar_evidencia_factura") return registrarEvidenciaFactura(payload);
    if (accion === "seguimiento_factura" || accion === "seguimiento_token" || accion === "trazabilidad") return obtenerSeguimientoFactura(payload);

    if (!accion && payload.tipo && payload.nombre && payload.insumo && payload.estado) {
      return registrarLugar(payload);
    }

    return jsonResponse({ error: "Accion no reconocida" }, 400);
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500);
  }
}

function jsonResponse(obj, statusCode) {
  const out = obj || {};
  if (statusCode && out.status == null) out.status = statusCode;
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// -- UTILIDADES -------------------------------------------------------------
function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function abrirSpreadsheet() {
  return getSpreadsheet();
}

function getSheet() {
  const ss = getSpreadsheet();
  return ss.getSheetByName('lugares');
}

function obtenerHoja(nombre) {
  const hoja = nombre === LUGARES_SHEET ? getSheet() : abrirSpreadsheet().getSheetByName(nombre);
  if (!hoja) throw new Error('No existe la hoja "' + nombre + '" en el Sheet indicado');
  return hoja;
}

function obtenerHojaOpcional(nombre) {
  return nombre === LUGARES_SHEET ? getSheet() : abrirSpreadsheet().getSheetByName(nombre);
}

function asegurarHoja(nombre, headers) {
  const ss = abrirSpreadsheet();
  let hoja = nombre === LUGARES_SHEET ? getSheet() : ss.getSheetByName(nombre);
  if (!hoja) hoja = ss.insertSheet(nombre);

  const lastColumn = hoja.getLastColumn();
  const lastRow = hoja.getLastRow();
  if (lastRow === 0 || lastColumn === 0) {
    hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
    hoja.setFrozenRows(1);
    return hoja;
  }

  const actuales = hoja.getRange(1, 1, 1, lastColumn).getValues()[0].map(texto);
  let nextColumn = lastColumn + 1;
  headers.forEach(function (header) {
    if (actuales.indexOf(header) === -1) {
      hoja.getRange(1, nextColumn).setValue(header);
      actuales.push(header);
      nextColumn++;
    }
  });
  hoja.setFrozenRows(1);
  return hoja;
}

function anexarObjeto(nombreHoja, headers, objeto) {
  const hoja = asegurarHoja(nombreHoja, headers);
  const currentHeaders = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(texto);
  const row = currentHeaders.map(function (header) {
    return objeto[header] != null ? objeto[header] : "";
  });
  hoja.appendRow(row);
  return hoja;
}

function inicializarHojasBase() {
  asegurarHoja(LUGARES_SHEET, LUGARES_HEADERS);
  asegurarHoja(VOLUNTARIOS_SHEET, VOLUNTARIOS_HEADERS);
  asegurarHoja(RESCATISTAS_SHEET, RESCATISTAS_HEADERS);
  asegurarHoja(MOTORIZADOS_SHEET, MOTORIZADOS_HEADERS);
  asegurarHoja(TRAYECTOS_SHEET, TRAYECTOS_HEADERS);
  asegurarHoja(DONACIONES_MOTORIZADOS_SHEET, DONACIONES_MOTORIZADOS_HEADERS);
  asegurarHoja(FACTURAS_SHEET, FACTURAS_HEADERS);
  asegurarHoja(DONACIONES_SHEET, DONACIONES_HEADERS);
  asegurarHoja(MOVIMIENTOS_FACTURA_SHEET, MOVIMIENTOS_FACTURA_HEADERS);
  asegurarHoja(EVIDENCIAS_SHEET, EVIDENCIAS_HEADERS);
  if (!obtenerHojaOpcional(HISTORIAL_SHEET)) {
    asegurarHoja(HISTORIAL_SHEET, HISTORIAL_HEADERS);
  }
}

function numero(valor, valorPorDefecto) {
  const n = Number(valor);
  return isNaN(n) ? (valorPorDefecto || 0) : n;
}

function texto(valor) {
  return String(valor == null ? "" : valor).trim();
}

function normalizar(textoEntrada) {
  return String(textoEntrada == null ? "" : textoEntrada)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function fechaISO(valor) {
  if (!valor) return "";
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? String(valor) : fecha.toISOString();
}

function esSi(valor) {
  const n = normalizar(valor);
  return valor === true || n === "si" || n === "sí" || n === "true";
}

function errorMessage(err) {
  return String(err && err.message ? err.message : err);
}

function leerFilas(nombreHoja) {
  const hoja = obtenerHoja(nombreHoja);
  const data = hoja.getDataRange().getValues();
  return data.length > 1 ? data : [data[0] || []];
}

function leerObjetos(nombreHoja, headersSiFalta) {
  const hoja = headersSiFalta ? asegurarHoja(nombreHoja, headersSiFalta) : obtenerHoja(nombreHoja);
  const values = hoja.getDataRange().getValues();
  if (!values.length) return [];

  const headers = values[0].map(texto);
  const objetos = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row.some(function (value) { return texto(value); })) continue;

    const item = {};
    headers.forEach(function (header, idx) {
      if (header) item[header] = row[idx];
    });
    objetos.push(item);
  }
  return objetos;
}

function valorPorCabecera(item, nombres) {
  for (let i = 0; i < nombres.length; i++) {
    const nombre = nombres[i];
    if (item[nombre] != null && texto(item[nombre]) !== "") return item[nombre];
  }
  return "";
}

function generarId(sheet, prefix) {
  const existentes = {};
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) existentes[String(data[i][0])] = true;
  }

  let id = "";
  do {
    id = prefix + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  } while (existentes[id]);

  return id;
}

// -- LUGARES ---------------------------------------------------------------
function listarLugares(params) {
  const lugares = aplicarFiltrosLugares(construirLugares(), params || {});
  return jsonResponse({ lugares, centros: lugares, total: lugares.length, estadisticas: construirEstadisticas({ lugares }) });
}

function construirLugares() {
  const rows = leerObjetos(LUGARES_SHEET, LUGARES_HEADERS);
  const lugaresMap = {};

  rows.forEach(function (row) {
    const tipo = texto(valorPorCabecera(row, ["Tipo", "tipo"]));
    const nombre = texto(valorPorCabecera(row, ["Nombre", "nombre"]));
    const insumoNombre = texto(valorPorCabecera(row, ["Insumo", "insumo"]));
    if (!tipo || !nombre || !insumoNombre) return;

    const ubicacion = texto(valorPorCabecera(row, ["Ubicacion", "Ubicación", "ubicacion"]));
    const telefono = texto(valorPorCabecera(row, ["Telefono", "Teléfono", "telefono"]));
    const categoria = texto(valorPorCabecera(row, ["Categoria", "Categoría", "categoria"])) || "Otros";
    const estado = texto(valorPorCabecera(row, ["Estado", "estado"]));
    const actualizado = fechaISO(valorPorCabecera(row, ["Actualizado", "actualizado"]));
    const key = normalizar(tipo + "|" + nombre);

    if (!lugaresMap[key]) {
      lugaresMap[key] = {
        tipo,
        nombre,
        ubicacion,
        telefono,
        necesita: [],
        cubiertos: [],
        tiene_disponible: [],
        actualizado
      };
    }

    if (actualizado) lugaresMap[key].actualizado = actualizado;

    if (esNecesita(estado)) {
      lugaresMap[key].necesita.push({
        nombre: insumoNombre,
        categoria,
        estado: "Necesita",
        cantidadNecesaria: numero(row.CantidadNecesaria, 1) || 1,
        cantidadRecibida: numero(row.CantidadRecibida, 0),
        porcentaje: 0,
        urgencia: texto(row.Urgencia) || "Normal",
        unidad: texto(row.Unidad) || "unidades",
        yaCubierto: false,
        coincidencias: []
      });
    } else {
      lugaresMap[key].tiene_disponible.push({
        nombre: insumoNombre,
        categoria,
        estado: "Tiene disponible"
      });
    }
  });

  const lugares = Object.keys(lugaresMap).map(function (key) { return lugaresMap[key]; });
  calcularCantidadesLugares(lugares);
  calcularCoincidencias(lugares);
  lugares.sort(function (a, b) { return normalizar(a.tipo + a.nombre) > normalizar(b.tipo + b.nombre) ? 1 : -1; });
  return lugares;
}

function esNecesita(estadoTxt) {
  return normalizar(estadoTxt).indexOf("necesita") === 0;
}

function calcularCantidadesLugares(lugares) {
  lugares.forEach(function (lugar) {
    lugar.necesita.forEach(function (item) {
      const necesaria = Math.max(0, numero(item.cantidadNecesaria, 1));
      const recibida = Math.max(0, Math.min(numero(item.cantidadRecibida, 0), necesaria));
      item.cantidadNecesaria = necesaria;
      item.cantidadRecibida = recibida;
      item.porcentaje = necesaria > 0 ? Math.round((recibida / necesaria) * 100) : 0;
      item.yaCubierto = necesaria > 0 && recibida >= necesaria;
    });
  });
}

function calcularCoincidencias(lugares) {
  const disponiblesPorInsumo = {};
  lugares.forEach(function (lugar) {
    lugar.tiene_disponible.forEach(function (item) {
      const key = normalizar(item.nombre);
      if (!disponiblesPorInsumo[key]) disponiblesPorInsumo[key] = [];
      disponiblesPorInsumo[key].push({
        keyLugar: normalizar(lugar.tipo + "|" + lugar.nombre),
        nombre_lugar: lugar.nombre,
        tipo: lugar.tipo,
        telefono: lugar.telefono,
        ubicacion: lugar.ubicacion,
        categoria: item.categoria
      });
    });
  });

  lugares.forEach(function (lugar) {
    const keyLugar = normalizar(lugar.tipo + "|" + lugar.nombre);
    lugar.necesita.forEach(function (item) {
      item.coincidencias = (disponiblesPorInsumo[normalizar(item.nombre)] || [])
        .filter(function (match) { return match.keyLugar !== keyLugar; })
        .map(function (match) {
          return {
            nombre_lugar: match.nombre_lugar,
            tipo: match.tipo,
            telefono: match.telefono,
            ubicacion: match.ubicacion,
            categoria: match.categoria
          };
        });
    });
  });
}

function aplicarFiltrosLugares(lugares, params) {
  const tipo = normalizar(params.tipo || "");
  const categoria = normalizar(params.categoria || "");
  const q = normalizar(params.q || params.busqueda || "");

  return lugares.filter(function (lugar) {
    if (tipo && tipo !== "todos" && normalizar(lugar.tipo).indexOf(tipo) !== 0) return false;
    if (q && normalizar([lugar.nombre, lugar.ubicacion, lugar.tipo].join(" ")).indexOf(q) === -1) return false;
    if (categoria) {
      const items = (lugar.necesita || []).concat(lugar.tiene_disponible || [], lugar.cubiertos || []);
      return items.some(function (item) { return normalizar(item.categoria) === categoria; });
    }
    return true;
  });
}

function claveUnicaLugar(nombre, insumo, estado) {
  return normalizar([nombre, insumo, esNecesita(estado) ? "necesita" : "tiene disponible"].join("|"));
}

function clavesRegistrosLugaresExistentes() {
  const rows = leerObjetos(LUGARES_SHEET, LUGARES_HEADERS);
  const claves = {};
  rows.forEach(function (row) {
    const nombre = texto(valorPorCabecera(row, ["Nombre", "nombre"]));
    const insumo = texto(valorPorCabecera(row, ["Insumo", "insumo"]));
    const estado = texto(valorPorCabecera(row, ["Estado", "estado"]));
    if (nombre && insumo && estado) claves[claveUnicaLugar(nombre, insumo, estado)] = true;
  });
  return claves;
}

function registrarLugar(payload) {
  const tipo = texto(payload.tipo || payload.Tipo);
  const nombre = texto(payload.nombre || payload.Nombre);
  const insumo = texto(payload.insumo || payload.Insumo);
  const estado = texto(payload.estado || payload.Estado);

  if (!tipo || !nombre || !insumo || !estado) {
    throw new Error("Faltan campos obligatorios: tipo, nombre, insumo, estado");
  }

  const hoja = asegurarHoja(LUGARES_SHEET, LUGARES_HEADERS);
  const estadoCanonico = esNecesita(estado) ? "Necesita" : "Tiene disponible";
  const clave = claveUnicaLugar(nombre, insumo, estadoCanonico);
  if (clavesRegistrosLugaresExistentes()[clave]) {
    return jsonResponse({ success: true, exito: true, duplicado: true });
  }

  hoja.appendRow([
    tipo,
    nombre,
    texto(payload.ubicacion || payload.Ubicacion),
    texto(payload.telefono || payload.Telefono),
    insumo,
    texto(payload.categoria || payload.Categoria) || "Otros",
    estadoCanonico,
    new Date()
  ]);

  return jsonResponse({ success: true, exito: true });
}

function parseArrayPayload(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }
  return [];
}

function extraerRegistrosLugares(payload) {
  const entrada = parseArrayPayload(payload.registros || payload.lugares || payload.centros);
  const registros = [];

  entrada.forEach(function (lugar) {
    if (!lugar) return;

    const tipo = texto(lugar.tipo || lugar.Tipo) || "Centro";
    const nombre = texto(lugar.nombre || lugar.Nombre);
    const ubicacion = texto(lugar.ubicacion || lugar.Ubicacion);
    const telefono = texto(lugar.telefono || lugar.Telefono);
    const insumoPlano = texto(lugar.insumo || lugar.Insumo);
    const estadoPlano = texto(lugar.estado || lugar.Estado);

    if (nombre && insumoPlano && estadoPlano) {
      registros.push({
        tipo,
        nombre,
        ubicacion,
        telefono,
        insumo: insumoPlano,
        categoria: texto(lugar.categoria || lugar.Categoria) || "Otros",
        estado: estadoPlano
      });
      return;
    }

    function agregarItems(items, estadoInsumo) {
      (items || []).forEach(function (item) {
        const insumo = texto(item && (item.nombre || item.insumo || item.Insumo));
        if (!nombre || !insumo) return;
        registros.push({
          tipo,
          nombre,
          ubicacion,
          telefono,
          insumo,
          categoria: texto(item.categoria || item.Categoria) || "Otros",
          estado: estadoInsumo
        });
      });
    }

    agregarItems(lugar.necesita, "Necesita");
    agregarItems(lugar.tiene_disponible, "Tiene disponible");
    agregarItems(lugar.cubiertos, "Tiene disponible");
  });

  return registros;
}

function sincronizarRegistrosLugares(payload) {
  const registros = extraerRegistrosLugares(payload || {});
  const hoja = asegurarHoja(LUGARES_SHEET, LUGARES_HEADERS);
  const existentes = clavesRegistrosLugaresExistentes();
  const insertados = [];

  registros.forEach(function (registro) {
    const tipo = texto(registro.tipo) || "Centro";
    const nombre = texto(registro.nombre);
    const insumo = texto(registro.insumo);
    const estadoCanonico = esNecesita(registro.estado) ? "Necesita" : "Tiene disponible";
    const clave = claveUnicaLugar(nombre, insumo, estadoCanonico);
    if (!nombre || !insumo || existentes[clave]) return;

    hoja.appendRow([
      tipo,
      nombre,
      texto(registro.ubicacion),
      texto(registro.telefono),
      insumo,
      texto(registro.categoria) || "Otros",
      estadoCanonico,
      new Date()
    ]);
    existentes[clave] = true;
    insertados.push({ nombre, insumo, estado: estadoCanonico });
  });

  return jsonResponse({
    success: true,
    exito: true,
    revisados: registros.length,
    insertados: insertados.length,
    faltantesInsertados: insertados
  });
}

// -- ESTADISTICAS ----------------------------------------------------------
function listarEstadisticas() {
  const lugares = construirLugares();
  const voluntarios = construirVoluntarios();
  const rescatistas = construirRescatistas();
  const motorizados = construirMotorizadosSeguro();
  const estadisticas = construirEstadisticas({ lugares, voluntarios, rescatistas, motorizados });
  return jsonResponse({ estadisticas, stats: estadisticas });
}

function construirEstadisticas(data) {
  const lugares = data.lugares || construirLugares();
  const voluntarios = data.voluntarios || [];
  const rescatistas = data.rescatistas || [];
  const centros = contarPorTipo(lugares, function (tipo) {
    return normalizar(tipo).indexOf("hospital") !== 0;
  });
  const hospitales = contarPorTipo(lugares, function (tipo) {
    return normalizar(tipo).indexOf("hospital") === 0;
  });

  return {
    centrosRegistrados: centros,
    hospitalesRegistrados: hospitales,
    personasLocalizadas: contarPersonasLocalizadas(),
    voluntariosActivos: voluntarios.length,
    rescatistasRegistrados: rescatistas.length,
    motorizadosRegistrados: (data.motorizados || []).length,
    actualizado: new Date().toISOString()
  };
}

function contarPorTipo(lugares, predicate) {
  const vistos = {};
  lugares.forEach(function (lugar) {
    if (predicate(lugar.tipo)) vistos[normalizar(lugar.tipo + "|" + lugar.nombre)] = true;
  });
  return Object.keys(vistos).length;
}

function contarPersonasLocalizadas() {
  const hoja = obtenerHojaOpcional("personas") || obtenerHojaOpcional("familiares");
  if (!hoja) return 0;

  const values = hoja.getDataRange().getValues();
  if (values.length <= 1) return 0;

  const headers = values[0].map(normalizar);
  const idxEstado = headers.indexOf("estado");
  if (idxEstado === -1) return values.length - 1;

  let total = 0;
  for (let i = 1; i < values.length; i++) {
    const estado = normalizar(values[i][idxEstado]);
    if (estado.indexOf("localizado") !== -1 || estado.indexOf("refugio") !== -1 || estado.indexOf("hospital") !== -1) {
      total++;
    }
  }
  return total;
}

function indiceCabecera(headers, nombres) {
  const normalizedHeaders = headers.map(normalizar);
  for (let i = 0; i < nombres.length; i++) {
    const idx = normalizedHeaders.indexOf(normalizar(nombres[i]));
    if (idx !== -1) return idx;
  }
  return -1;
}

function valorFila(row, headers, nombres, indicePorDefecto) {
  const idx = indiceCabecera(headers, nombres);
  if (idx !== -1) return row[idx];
  return indicePorDefecto != null ? row[indicePorDefecto] : "";
}

function construirFamiliares() {
  const hoja = obtenerHojaOpcional("personas") || obtenerHojaOpcional("familiares");
  if (!hoja) return [];

  const values = hoja.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(texto);
  const familiares = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row.some(function (value) { return texto(value); })) continue;

    const persona = {
      nombre: texto(valorFila(row, headers, ["nombre", "nombre completo", "persona"], 0)),
      cedula: texto(valorFila(row, headers, ["cedula", "cédula", "documento", "id"], 1)),
      estado: texto(valorFila(row, headers, ["estado", "estatus", "situacion", "situación"], 2)),
      ubicacion: texto(valorFila(row, headers, ["ubicacion", "ubicación", "lugar", "ultima ubicacion", "última ubicación"], 3)),
      fuente: texto(valorFila(row, headers, ["fuente", "origen"], 4)),
      actualizado: fechaISO(valorFila(row, headers, ["actualizado", "fecha", "timestamp"], 5))
    };
    if (persona.nombre || persona.cedula) familiares.push(persona);
  }

  familiares.sort(function (a, b) { return new Date(b.actualizado) - new Date(a.actualizado); });
  return familiares;
}

function buscarFamiliares(params) {
  const query = texto(params.q || params.query || params.busqueda);
  const qn = normalizar(query);
  const qd = String(query || "").replace(/[^0-9]/g, "");
  const resultados = construirFamiliares().filter(function (persona) {
    if (!query) return false;
    return normalizar(persona.nombre).indexOf(qn) !== -1 ||
      (qd && String(persona.cedula || "").replace(/[^0-9]/g, "").indexOf(qd) !== -1);
  }).slice(0, 50);

  return jsonResponse({
    resultados,
    familiares: resultados,
    encontrado: resultados.length > 0,
    total: resultados.length
  });
}

// -- VOLUNTARIOS -----------------------------------------------------------
function listarVoluntarios(params) {
  const voluntarios = filtrarPersonas(construirVoluntarios(), params || {});
  return jsonResponse({ voluntarios, total: voluntarios.length });
}

function construirVoluntarios() {
  const rows = leerObjetos(VOLUNTARIOS_SHEET, VOLUNTARIOS_HEADERS);
  const voluntarios = rows.map(function (row) {
    const medioTransporte = texto(valorPorCabecera(row, ["medio_transporte", "medioTransporte", "transporte", "Medio de transporte"]));
    return {
      id: texto(row.id),
      nombre: texto(row.nombre),
      apellido: texto(row.apellido),
      telefono: texto(row.telefono),
      estado: texto(row.estado),
      ciudad: texto(row.ciudad),
      profesion: texto(row.profesion),
      disponibilidad: texto(row.disponibilidad),
      medio_transporte: medioTransporte,
      medioTransporte,
      observaciones: texto(row.observaciones),
      fecha_registro: fechaISO(row.fecha_registro)
    };
  }).filter(function (v) { return v.id || v.nombre || v.telefono; });

  voluntarios.sort(function (a, b) { return new Date(b.fecha_registro) - new Date(a.fecha_registro); });
  return voluntarios;
}

function registrarVoluntario(payload) {
  const nombre = texto(payload.nombre);
  const telefono = texto(payload.telefono);
  if (!nombre || !telefono) throw new Error("Faltan campos obligatorios: nombre, telefono");

  const hoja = asegurarHoja(VOLUNTARIOS_SHEET, VOLUNTARIOS_HEADERS);
  const id = generarId(hoja, "VOL");
  const fechaRegistro = new Date();
  const medioTransporte = texto(payload.medio_transporte || payload.medioTransporte || payload.transporte);
  const voluntario = {
    id,
    nombre,
    apellido: texto(payload.apellido),
    telefono,
    estado: texto(payload.estado),
    ciudad: texto(payload.ciudad),
    profesion: texto(payload.profesion),
    disponibilidad: texto(payload.disponibilidad),
    medio_transporte: medioTransporte,
    observaciones: texto(payload.observaciones),
    fecha_registro: fechaRegistro
  };
  anexarObjeto(VOLUNTARIOS_SHEET, VOLUNTARIOS_HEADERS, voluntario);

  return jsonResponse({
    success: true,
    exito: true,
    id,
    voluntario: {
      id,
      nombre,
      apellido: voluntario.apellido,
      telefono,
      estado: voluntario.estado,
      ciudad: voluntario.ciudad,
      profesion: voluntario.profesion,
      disponibilidad: voluntario.disponibilidad,
      medio_transporte: medioTransporte,
      medioTransporte,
      observaciones: voluntario.observaciones,
      fecha_registro: fechaRegistro.toISOString()
    }
  });
}

// -- RESCATISTAS -----------------------------------------------------------
function listarRescatistas(params) {
  const rescatistas = filtrarPersonas(construirRescatistas(), params || {});
  return jsonResponse({ rescatistas, total: rescatistas.length });
}

function construirRescatistas() {
  const rows = leerObjetos(RESCATISTAS_SHEET, RESCATISTAS_HEADERS);
  const rescatistas = rows.map(function (row) {
    const equipoDisponible = texto(valorPorCabecera(row, ["equipo_disponible", "equipoDisponible", "equipo", "Equipo disponible"]));
    const capacidadOperativa = texto(valorPorCabecera(row, ["capacidad_operativa", "capacidadOperativa", "capacidad", "Capacidad operativa"]));
    return {
      id: texto(row.id),
      nombre: texto(row.nombre),
      organizacion: texto(row.organizacion),
      telefono: texto(row.telefono),
      especialidad: texto(row.especialidad),
      estado: texto(row.estado),
      ciudad: texto(row.ciudad),
      disponibilidad: texto(row.disponibilidad),
      equipo_disponible: equipoDisponible,
      equipoDisponible,
      capacidad_operativa: capacidadOperativa,
      capacidadOperativa,
      observaciones: texto(row.observaciones),
      fecha_registro: fechaISO(row.fecha_registro)
    };
  }).filter(function (r) { return r.id || r.nombre || r.telefono; });

  rescatistas.sort(function (a, b) { return new Date(b.fecha_registro) - new Date(a.fecha_registro); });
  return rescatistas;
}

function registrarRescatista(payload) {
  const nombre = texto(payload.nombre);
  const telefono = texto(payload.telefono);
  if (!nombre || !telefono) throw new Error("Faltan campos obligatorios: nombre, telefono");

  const hoja = asegurarHoja(RESCATISTAS_SHEET, RESCATISTAS_HEADERS);
  const id = generarId(hoja, "RES");
  const fechaRegistro = new Date();
  const equipoDisponible = texto(payload.equipo_disponible || payload.equipoDisponible || payload.equipo);
  const capacidadOperativa = texto(payload.capacidad_operativa || payload.capacidadOperativa || payload.capacidad);
  const rescatista = {
    id,
    nombre,
    organizacion: texto(payload.organizacion),
    telefono,
    especialidad: texto(payload.especialidad),
    estado: texto(payload.estado),
    ciudad: texto(payload.ciudad),
    disponibilidad: texto(payload.disponibilidad),
    equipo_disponible: equipoDisponible,
    capacidad_operativa: capacidadOperativa,
    observaciones: texto(payload.observaciones),
    fecha_registro: fechaRegistro
  };
  anexarObjeto(RESCATISTAS_SHEET, RESCATISTAS_HEADERS, rescatista);

  return jsonResponse({
    success: true,
    exito: true,
    id,
    rescatista: {
      id,
      nombre,
      organizacion: rescatista.organizacion,
      telefono,
      especialidad: rescatista.especialidad,
      estado: rescatista.estado,
      ciudad: rescatista.ciudad,
      disponibilidad: rescatista.disponibilidad,
      equipo_disponible: equipoDisponible,
      equipoDisponible,
      capacidad_operativa: capacidadOperativa,
      capacidadOperativa,
      observaciones: rescatista.observaciones,
      fecha_registro: fechaRegistro.toISOString()
    }
  });
}

function filtrarPersonas(lista, params) {
  const q = normalizar(params.q || params.busqueda || "");
  const estado = normalizar(params.estado || "");
  const tipo = normalizar(params.tipo || params.profesion || params.especialidad || "");

  return (lista || []).filter(function (item) {
    if (estado && normalizar(item.estado) !== estado) return false;
    if (tipo && normalizar(item.profesion || item.especialidad) !== tipo) return false;
    if (!q) return true;
    return normalizar([
      item.nombre, item.apellido, item.organizacion, item.telefono, item.estado,
      item.ciudad, item.profesion, item.especialidad, item.disponibilidad,
      item.medio_transporte, item.equipo_disponible, item.capacidad_operativa
    ].join(" ")).indexOf(q) !== -1;
  });
}

// -- CENTROS / DONACIONES CUANTITATIVAS ------------------------------------
function listarCentros() {
  const lugares = construirLugares();
  const centros = construirCentrosSeguro(lugares);
  return jsonResponse({ centros, lugares: centros });
}

function construirCentrosSeguro(lugaresBase) {
  try {
    if (!obtenerHojaOpcional(CENTROS_SHEET)) return lugaresBase || [];
    return construirCentros();
  } catch (err) {
    return lugaresBase || [];
  }
}

function construirCentros() {
  const data = leerFilas(CENTROS_SHEET);
  const centroMap = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[1]) continue;

    const tipo = texto(row[0]);
    const nombre = texto(row[1]);
    const key = normalizar(tipo + "|" + nombre);

    if (!centroMap[key]) {
      centroMap[key] = {
        tipo,
        nombre,
        ubicacion: texto(row[2]),
        telefono: texto(row[3]),
        necesita: [],
        no_acepta: [],
        cubiertos: [],
        tiene_disponible: [],
        actualizado: fechaISO(row[10])
      };
    }

    const cantidadNecesaria = numero(row[6], 0);
    const cantidadRecibida = Math.max(0, numero(row[7], 0));
    const recibidaCap = cantidadNecesaria > 0
      ? Math.min(cantidadRecibida, cantidadNecesaria)
      : cantidadRecibida;

    const insumo = {
      nombre: texto(row[4]),
      categoria: texto(row[5]) || "Otros",
      cantidadNecesaria,
      cantidadRecibida: recibidaCap,
      urgencia: texto(row[8]) || "Normal",
      unidad: texto(row[9]) || "unidades",
      coincidencias: []
    };

    if (!insumo.nombre) continue;

    insumo.porcentaje = insumo.cantidadNecesaria > 0
      ? Math.round((insumo.cantidadRecibida / insumo.cantidadNecesaria) * 100)
      : 0;
    insumo.yaCubierto = insumo.cantidadRecibida >= insumo.cantidadNecesaria && insumo.cantidadNecesaria > 0;

    if (insumo.yaCubierto) {
      centroMap[key].cubiertos.push(insumo);
      centroMap[key].tiene_disponible.push({ nombre: insumo.nombre, categoria: insumo.categoria });
    } else {
      centroMap[key].necesita.push(insumo);
    }

    if (row[10]) centroMap[key].actualizado = fechaISO(row[10]);
  }

  const centros = Object.keys(centroMap).map(function (key) { return centroMap[key]; });
  calcularCoincidencias(centros);
  return centros;
}

function registrarMovimiento(payload) {
  if (!payload.nombreLugar || !payload.insumo || !payload.tipoMovimiento) {
    throw new Error("Faltan campos obligatorios: nombreLugar, insumo, tipoMovimiento");
  }

  const cantidad = numero(payload.cantidad, 0);
  if (cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");

  const ss = abrirSpreadsheet();
  const centroSheet = ss.getSheetByName(CENTROS_SHEET);
  if (!centroSheet) throw new Error('No existe la hoja "' + CENTROS_SHEET + '"');
  const histSheet = asegurarHoja(HISTORIAL_SHEET, HISTORIAL_HEADERS);
  const centroData = centroSheet.getDataRange().getValues();

  for (let i = 1; i < centroData.length; i++) {
    if (normalizar(centroData[i][1]) === normalizar(payload.nombreLugar) &&
        normalizar(centroData[i][4]) === normalizar(payload.insumo)) {
      const cantidadActual = parseFloat(centroData[i][7]) || 0;
      let nuevaCantidad = cantidadActual;

      if (normalizar(payload.tipoMovimiento) === "entrada") {
        nuevaCantidad += cantidad;
      } else {
        nuevaCantidad = Math.max(0, cantidadActual - cantidad);
      }

      const cantidadNecesaria = parseFloat(centroData[i][6]) || 0;
      if (cantidadNecesaria > 0) {
        nuevaCantidad = Math.min(nuevaCantidad, cantidadNecesaria);
      }

      centroSheet.getRange(i + 1, 8).setValue(nuevaCantidad);
      centroSheet.getRange(i + 1, 11).setValue(new Date());

      histSheet.appendRow([
        new Date(),
        texto(payload.tipoLugar) || texto(centroData[i][0]),
        texto(payload.nombreLugar),
        texto(payload.insumo),
        texto(payload.tipoMovimiento),
        cantidad,
        texto(payload.unidad) || texto(centroData[i][9]) || "unidades",
        texto(payload.nombreVoluntario) || "Anonimo",
        nuevaCantidad,
        texto(payload.observaciones)
      ]);

      return jsonResponse({ success: true, exito: true, nuevaCantidad });
    }
  }

  return jsonResponse({ error: "Insumo no encontrado" }, 404);
}

function obtenerHistorialMovimientos(centro) {
  const sheet = asegurarHoja(HISTORIAL_SHEET, HISTORIAL_HEADERS);
  const data = sheet.getDataRange().getValues();

  let movimientos = [];
  for (let i = 1; i < data.length; i++) {
    if (!centro || normalizar(data[i][2]) === normalizar(centro)) {
      const item = {
        timestamp: fechaISO(data[i][0]),
        tipoCentro: data[i][1],
        tipoLugar: data[i][1],
        centro: data[i][2],
        lugar: data[i][2],
        insumo: data[i][3],
        tipo: data[i][4],
        tipoMovimiento: data[i][4],
        cantidad: data[i][5],
        unidad: data[i][6],
        voluntario: data[i][7],
        cantidadAcumulada: data[i][8],
        observaciones: data[i][9] || ""
      };
      movimientos.push(item);
    }
  }

  movimientos.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  movimientos = movimientos.slice(0, centro ? 50 : 100);

  return jsonResponse({ movimientos, historial: movimientos, total: movimientos.length });
}

// -- MOTORIZADOS ------------------------------------------------------------
function listarMotorizados() {
  const motorizados = construirMotorizados();
  return jsonResponse({ motorizados, total: motorizados.length });
}

function construirMotorizadosSeguro() {
  try {
    if (!obtenerHojaOpcional(MOTORIZADOS_SHEET) || !obtenerHojaOpcional(TRAYECTOS_SHEET)) return [];
    return construirMotorizados();
  } catch (err) {
    return [];
  }
}

function construirMotorizados() {
  const motorSheet = obtenerHoja(MOTORIZADOS_SHEET);
  const trajSheet = obtenerHoja(TRAYECTOS_SHEET);
  const motorData = motorSheet.getDataRange().getValues();
  const trajData = trajSheet.getDataRange().getValues();

  const totalesPorMotor = {};
  for (let i = 1; i < trajData.length; i++) {
    const row = trajData[i];
    const id = texto(row[1]);
    if (!id) continue;

    const km = parseFloat(row[5]) || 0;
    if (!totalesPorMotor[id]) {
      totalesPorMotor[id] = { trayectos: 0, km: 0 };
    }
    totalesPorMotor[id].trayectos++;
    totalesPorMotor[id].km += km;
  }

  const motorizados = [];
  for (let i = 1; i < motorData.length; i++) {
    const row = motorData[i];
    const id = texto(row[0]);
    if (!id) continue;

    const totales = totalesPorMotor[id] || {
      trayectos: numero(row[8], 0),
      km: numero(row[9], 0)
    };
    const estado = texto(row[6]) || "Activo";

    motorizados.push({
      id,
      nombre: row[1],
      tipoVehiculo: row[2],
      telefono: row[3],
      operaEn: row[4],
      zonaOperacion: row[4],
      placa: row[5],
      estado,
      activo: normalizar(estado) !== "inactivo",
      fechaRegistro: fechaISO(row[7]),
      totalTrayectos: totales.trayectos,
      totalKm: Math.round(totales.km * 10) / 10,
      aporteDonado: parseFloat(row[10]) || 0,
      verificado: esSi(row[11]),
      ultimoTrayecto: fechaISO(row[12])
    });
  }

  motorizados.sort(function (a, b) { return b.totalKm - a.totalKm; });
  return motorizados;
}

function obtenerPerfilMotorizado(id) {
  if (!id) return jsonResponse({ error: "Falta id de motorizado" }, 400);

  const motorSheet = obtenerHoja(MOTORIZADOS_SHEET);
  const motorData = motorSheet.getDataRange().getValues();

  let motorizado = null;
  for (let i = 1; i < motorData.length; i++) {
    if (String(motorData[i][0]) === String(id)) {
      motorizado = {
        id: motorData[i][0],
        nombre: motorData[i][1],
        tipoVehiculo: motorData[i][2],
        telefono: motorData[i][3],
        operaEn: motorData[i][4],
        zonaOperacion: motorData[i][4],
        placa: motorData[i][5],
        estado: motorData[i][6],
        aporteDonado: parseFloat(motorData[i][10]) || 0,
        verificado: esSi(motorData[i][11])
      };
      break;
    }
  }

  if (!motorizado) {
    return jsonResponse({ error: "Motorizado no encontrado" }, 404);
  }

  const trayectos = construirTrayectos(id);
  const donaciones = construirDonacionesMotorizado(id);

  return jsonResponse({ motorizado, trayectos, donaciones });
}

function registrarMotorizado(payload) {
  if (!payload.nombre || !payload.tipoVehiculo) {
    throw new Error("Faltan campos obligatorios: nombre, tipoVehiculo");
  }

  const operaEn = texto(payload.operaEn || payload.zonaOperacion);
  if (!operaEn) throw new Error("Falta el campo operaEn");

  const motorSheet = obtenerHoja(MOTORIZADOS_SHEET);
  const id = generarIdMotorizado(motorSheet);

  motorSheet.appendRow([
    id,
    texto(payload.nombre),
    texto(payload.tipoVehiculo),
    texto(payload.telefono),
    operaEn,
    texto(payload.placa),
    "Activo",
    new Date(),
    0,
    0,
    0,
    "No",
    null
  ]);

  return jsonResponse({ success: true, exito: true, id });
}

function generarIdMotorizado(motorSheet) {
  const existentes = {};
  const data = motorSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) existentes[String(data[i][0])] = true;
  }

  let id = "";
  do {
    id = "MOTO" + (Math.floor(Math.random() * 10000)).toString().padStart(4, "0");
  } while (existentes[id]);

  return id;
}

// -- TRAYECTOS --------------------------------------------------------------
function obtenerTrayectos(motorizado) {
  const trayectos = construirTrayectos(motorizado);
  return jsonResponse({ trayectos, total: trayectos.length });
}

function construirTrayectos(motorizado) {
  const sheet = obtenerHoja(TRAYECTOS_SHEET);
  const data = sheet.getDataRange().getValues();

  const trayectos = [];
  for (let i = 1; i < data.length; i++) {
    if (!motorizado || String(data[i][1]) === String(motorizado)) {
      const insumo = texto(data[i][7]);
      const cantidad = texto(data[i][8]);
      const unidad = texto(data[i][9]);
      const insumoTransportado = [insumo, cantidad && unidad ? cantidad + " " + unidad : cantidad || unidad]
        .filter(Boolean)
        .join(" · ");

      trayectos.push({
        timestamp: fechaISO(data[i][0]),
        idMotorizado: data[i][1],
        motorizadoId: data[i][1],
        nombreMotorizado: data[i][2],
        motorizadoNombre: data[i][2],
        origen: data[i][3],
        destino: data[i][4],
        km: data[i][5],
        kmRecorridos: data[i][5],
        minutos: data[i][6],
        tiempoMinutos: data[i][6],
        insumo,
        insumoTransportado: insumoTransportado || "Varios",
        cantidad: data[i][8],
        unidad: data[i][9],
        foto: data[i][10],
        notas: data[i][11] || "",
        observaciones: data[i][11] || "",
        verificado: esSi(data[i][12])
      });
    }
  }

  trayectos.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  return trayectos;
}

function registrarTrayecto(payload) {
  const idMotorizado = texto(payload.idMotorizado || payload.motorizadoId);
  if (!idMotorizado || !payload.origen || !payload.destino) {
    throw new Error("Faltan campos obligatorios: idMotorizado, origen, destino");
  }

  const km = numero(payload.km != null ? payload.km : payload.kmRecorridos, 0);
  if (km <= 0) throw new Error("Los km recorridos deben ser mayores a 0");

  const ss = abrirSpreadsheet();
  const trajSheet = ss.getSheetByName(TRAYECTOS_SHEET);
  const motorSheet = ss.getSheetByName(MOTORIZADOS_SHEET);
  if (!trajSheet || !motorSheet) throw new Error("Faltan hojas de motorizados o trayectos");

  const ahora = new Date();
  let nombreMotorizado = texto(payload.nombreMotorizado);

  const motorData = motorSheet.getDataRange().getValues();
  let filaMotorizado = -1;
  let totalTrayectos = 0;
  let totalKm = 0;

  for (let i = 1; i < motorData.length; i++) {
    if (String(motorData[i][0]) === String(idMotorizado)) {
      filaMotorizado = i + 1;
      nombreMotorizado = nombreMotorizado || texto(motorData[i][1]);
      totalTrayectos = numero(motorData[i][8], 0) + 1;
      totalKm = numero(motorData[i][9], 0) + km;
      break;
    }
  }

  if (filaMotorizado === -1) throw new Error("No se encontro el motorizado indicado");

  trajSheet.appendRow([
    ahora,
    idMotorizado,
    nombreMotorizado,
    texto(payload.origen),
    texto(payload.destino),
    km,
    numero(payload.tiempoMinutos || payload.minutos, 0) || "",
    texto(payload.insumo || payload.insumoTransportado) || "Varios",
    payload.cantidad || "",
    texto(payload.unidad),
    texto(payload.foto),
    texto(payload.notas || payload.observaciones),
    "No"
  ]);

  motorSheet.getRange(filaMotorizado, 9).setValue(totalTrayectos);
  motorSheet.getRange(filaMotorizado, 10).setValue(totalKm);
  motorSheet.getRange(filaMotorizado, 13).setValue(ahora);

  return jsonResponse({
    success: true,
    exito: true,
    totalTrayectos,
    totalKm: Math.round(totalKm * 10) / 10
  });
}

// -- TRAZABILIDAD PUBLICA DE FACTURAS -------------------------------------
function normalizarTokenPublico(valor) {
  const raw = texto(valor).toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  const compacto = raw.replace(/[^A-Z0-9]/g, "");
  if (/^DV[A-Z0-9]{12}$/.test(compacto)) {
    return "DV-" + compacto.slice(2, 6) + "-" + compacto.slice(6, 10) + "-" + compacto.slice(10, 14);
  }
  return raw;
}

function tokenFacturaValido(token) {
  return /^DV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizarTokenPublico(token));
}

function tokensFacturasExistentes() {
  const usados = {};
  leerObjetos(FACTURAS_SHEET, FACTURAS_HEADERS).forEach(function (factura) {
    const token = normalizarTokenPublico(factura.token_publico);
    if (token) usados[token] = true;
  });
  return usados;
}

function generarSegmentoToken() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const uuid = Utilities.getUuid().replace(/-/g, "").toUpperCase();
  let segmento = "";
  for (let i = 0; i < 4; i++) {
    const base = uuid.charCodeAt((i * 7 + Math.floor(Math.random() * uuid.length)) % uuid.length);
    const idx = (base + Math.floor(Math.random() * alfabeto.length)) % alfabeto.length;
    segmento += alfabeto.charAt(idx);
  }
  return segmento;
}

function generarTokenPublico() {
  const usados = tokensFacturasExistentes();
  for (let intento = 0; intento < 80; intento++) {
    const token = "DV-" + generarSegmentoToken() + "-" + generarSegmentoToken() + "-" + generarSegmentoToken();
    if (!usados[token] && tokenFacturaValido(token)) return token;
  }
  throw new Error("No se pudo generar un token publico unico");
}

function generarNumeroFactura() {
  const year = String(new Date().getFullYear());
  const patron = new RegExp("^FAC-" + year + "-(\\d+)$");
  let max = 0;
  leerObjetos(FACTURAS_SHEET, FACTURAS_HEADERS).forEach(function (factura) {
    const match = texto(factura.numero_factura).match(patron);
    if (match) max = Math.max(max, numero(match[1], 0));
  });
  return "FAC-" + year + "-" + String(max + 1).padStart(6, "0");
}

function objetoDesdeFila(row, headers) {
  const item = {};
  headers.forEach(function (header, idx) {
    if (header) item[header] = row[idx];
  });
  return item;
}

function buscarFacturaConFila(params) {
  const hoja = asegurarHoja(FACTURAS_SHEET, FACTURAS_HEADERS);
  const values = hoja.getDataRange().getValues();
  const headers = (values[0] || FACTURAS_HEADERS).map(texto);
  const tokenBusqueda = normalizarTokenPublico(params.token || params.token_publico);
  const idBusqueda = texto(params.factura_id || params.id);
  const numeroBusqueda = texto(params.numero_factura || params.numeroFactura);
  const idxToken = headers.indexOf("token_publico");
  const idxId = headers.indexOf("id");
  const idxNumero = headers.indexOf("numero_factura");

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row.some(function (value) { return texto(value); })) continue;
    const coincideToken = tokenBusqueda && idxToken !== -1 && normalizarTokenPublico(row[idxToken]) === tokenBusqueda;
    const coincideId = idBusqueda && idxId !== -1 && texto(row[idxId]) === idBusqueda;
    const coincideNumero = numeroBusqueda && idxNumero !== -1 && texto(row[idxNumero]) === numeroBusqueda;
    if (coincideToken || coincideId || coincideNumero) {
      return { hoja, fila: i + 1, headers, factura: objetoDesdeFila(row, headers) };
    }
  }
  return null;
}

function existeValorFactura(campo, valor) {
  const buscado = campo === "token_publico" ? normalizarTokenPublico(valor) : texto(valor);
  if (!buscado) return false;
  return leerObjetos(FACTURAS_SHEET, FACTURAS_HEADERS).some(function (factura) {
    const actual = campo === "token_publico" ? normalizarTokenPublico(factura[campo]) : texto(factura[campo]);
    return actual === buscado;
  });
}

function fechaRegistro(valor) {
  if (!valor) return new Date();
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? texto(valor) : fecha;
}

function setFacturaCampo(info, campo, valor) {
  const idx = info.headers.indexOf(campo);
  if (idx !== -1) info.hoja.getRange(info.fila, idx + 1).setValue(valor);
}

function actualizarMontoFactura(info, delta, estadoForzado) {
  const actual = numero(info.factura.monto_recaudado, 0);
  const requerido = numero(info.factura.monto_requerido, 0);
  const nuevoMonto = Math.max(0, actual + numero(delta, 0));
  setFacturaCampo(info, "monto_recaudado", nuevoMonto);

  let estado = texto(estadoForzado);
  if (!estado && requerido > 0 && nuevoMonto >= requerido) estado = "completada";
  if (estado) setFacturaCampo(info, "estado", estado);
  if (estado && normalizar(estado) === "completada" && !texto(info.factura.fecha_cierre)) {
    const cierre = new Date();
    setFacturaCampo(info, "fecha_cierre", cierre);
    info.factura.fecha_cierre = cierre;
  }

  info.factura.monto_recaudado = nuevoMonto;
  if (estado) info.factura.estado = estado;
  return nuevoMonto;
}

function facturaPublica(factura) {
  const requerido = numero(factura.monto_requerido, 0);
  const recaudado = numero(factura.monto_recaudado, 0);
  const porcentaje = requerido > 0 ? Math.min(100, Math.round((recaudado / requerido) * 100)) : 0;
  return {
    id: texto(factura.id),
    numero_factura: texto(factura.numero_factura),
    token_publico: normalizarTokenPublico(factura.token_publico),
    objetivo: textoPublico(factura.objetivo),
    descripcion: textoPublico(factura.descripcion),
    monto_requerido: requerido,
    monto_recaudado: recaudado,
    porcentaje_completado: porcentaje,
    porcentaje,
    estado: textoPublico(factura.estado || "abierta"),
    fecha_creacion: fechaISO(factura.fecha_creacion),
    fecha_cierre: fechaISO(factura.fecha_cierre)
  };
}

function textoPublico(valor) {
  let out = texto(valor);
  if (!out) return "";
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, "[correo protegido]");
  out = out.replace(/\+?\d[\d\s().-]{6,}\d/g, "[telefono protegido]");
  out = out.replace(/\b(cuenta|iban|swift|banco|bancaria|pago movil|pago móvil|deposito|depósito|transferencia|rif|cedula|cédula|telefono|teléfono|direccion|dirección|coordenada|latitud|longitud)\b/ig, "[dato protegido]");
  return out.slice(0, 1000);
}

function registrarFactura(payload) {
  const objetivo = texto(payload.objetivo);
  const montoRequerido = numero(payload.monto_requerido || payload.montoRequerido, 0);
  if (!objetivo) throw new Error("Falta objetivo");
  if (montoRequerido <= 0) throw new Error("El monto requerido debe ser mayor a 0");

  const hoja = asegurarHoja(FACTURAS_SHEET, FACTURAS_HEADERS);
  const tokenSolicitado = normalizarTokenPublico(payload.token_publico || payload.token);
  if (tokenSolicitado && !tokenFacturaValido(tokenSolicitado)) throw new Error("Token publico invalido");
  if (tokenSolicitado && existeValorFactura("token_publico", tokenSolicitado)) throw new Error("El token publico ya existe");

  const numeroFactura = texto(payload.numero_factura || payload.numeroFactura) || generarNumeroFactura();
  if (existeValorFactura("numero_factura", numeroFactura)) throw new Error("La factura ya existe");

  const id = texto(payload.id || payload.factura_id) || generarId(hoja, "FAC");
  if (existeValorFactura("id", id)) throw new Error("El id de factura ya existe");

  const factura = {
    id,
    numero_factura: numeroFactura,
    token_publico: tokenSolicitado || generarTokenPublico(),
    objetivo,
    descripcion: texto(payload.descripcion),
    monto_requerido: montoRequerido,
    monto_recaudado: numero(payload.monto_recaudado || payload.montoRecaudado, 0),
    estado: texto(payload.estado) || "abierta",
    fecha_creacion: fechaRegistro(payload.fecha_creacion || payload.fechaCreacion),
    fecha_cierre: payload.fecha_cierre || payload.fechaCierre ? fechaRegistro(payload.fecha_cierre || payload.fechaCierre) : ""
  };

  anexarObjeto(FACTURAS_SHEET, FACTURAS_HEADERS, factura);
  return jsonResponse({ success: true, exito: true, factura: facturaPublica(factura), token: factura.token_publico });
}

function registrarDonacionFactura(payload) {
  const info = buscarFacturaConFila(payload);
  if (!info) return jsonResponse({ error: "Factura no encontrada" }, 404);

  const monto = numero(payload.monto, 0);
  if (monto <= 0) throw new Error("El monto debe ser mayor a 0");

  const donSheet = asegurarHoja(DONACIONES_SHEET, DONACIONES_HEADERS);
  const movSheet = asegurarHoja(MOVIMIENTOS_FACTURA_SHEET, MOVIMIENTOS_FACTURA_HEADERS);
  const fecha = fechaRegistro(payload.fecha);
  const estado = texto(payload.estado) || "confirmada";
  const donacion = {
    id: texto(payload.id) || generarId(donSheet, "DON"),
    factura_id: texto(info.factura.id),
    nombre_donante: texto(payload.nombre_donante || payload.nombreDonante || payload.donante) || "Anonimo",
    monto,
    referencia_pago: texto(payload.referencia_pago || payload.referenciaPago || payload.referencia),
    fecha,
    estado
  };
  anexarObjeto(DONACIONES_SHEET, DONACIONES_HEADERS, donacion);

  if (normalizar(estado) === "confirmada" || normalizar(estado) === "aprobada") {
    actualizarMontoFactura(info, monto, payload.estado_factura || payload.estadoFactura);
    anexarObjeto(MOVIMIENTOS_FACTURA_SHEET, MOVIMIENTOS_FACTURA_HEADERS, {
      id: generarId(movSheet, "MOV"),
      factura_id: texto(info.factura.id),
      tipo: "donacion",
      descripcion: texto(payload.descripcion) || "Donacion confirmada",
      monto,
      fecha
    });
  }

  return jsonResponse({ success: true, exito: true, donacion_id: donacion.id, factura: facturaPublica(info.factura) });
}

function registrarMovimientoFactura(payload) {
  const info = buscarFacturaConFila(payload);
  if (!info) return jsonResponse({ error: "Factura no encontrada" }, 404);

  const monto = numero(payload.monto, 0);
  const tipo = texto(payload.tipo);
  if (!tipo) throw new Error("Falta tipo de movimiento");

  const movSheet = asegurarHoja(MOVIMIENTOS_FACTURA_SHEET, MOVIMIENTOS_FACTURA_HEADERS);
  const movimiento = {
    id: texto(payload.id) || generarId(movSheet, "MOV"),
    factura_id: texto(info.factura.id),
    tipo,
    descripcion: texto(payload.descripcion),
    monto,
    fecha: fechaRegistro(payload.fecha)
  };
  anexarObjeto(MOVIMIENTOS_FACTURA_SHEET, MOVIMIENTOS_FACTURA_HEADERS, movimiento);

  if (payload.afecta_recaudado === true || normalizar(payload.afecta_recaudado || payload.afectaRecaudado) === "si") {
    actualizarMontoFactura(info, monto, payload.estado_factura || payload.estadoFactura);
  }

  return jsonResponse({ success: true, exito: true, movimiento_id: movimiento.id, factura: facturaPublica(info.factura) });
}

function registrarEvidenciaFactura(payload) {
  const info = buscarFacturaConFila(payload);
  if (!info) return jsonResponse({ error: "Factura no encontrada" }, 404);

  const archivo = texto(payload.archivo || payload.url || payload.link);
  if (!archivo) throw new Error("Falta archivo de evidencia");

  const evSheet = asegurarHoja(EVIDENCIAS_SHEET, EVIDENCIAS_HEADERS);
  const evidencia = {
    id: texto(payload.id) || generarId(evSheet, "EVI"),
    factura_id: texto(info.factura.id),
    archivo,
    descripcion: texto(payload.descripcion),
    fecha: fechaRegistro(payload.fecha)
  };
  anexarObjeto(EVIDENCIAS_SHEET, EVIDENCIAS_HEADERS, evidencia);
  return jsonResponse({ success: true, exito: true, evidencia_id: evidencia.id });
}

function listarFacturas() {
  const facturas = leerObjetos(FACTURAS_SHEET, FACTURAS_HEADERS).map(facturaPublica);
  return jsonResponse({ success: true, facturas, total: facturas.length });
}

function obtenerSeguimientoFactura(params) {
  const token = normalizarTokenPublico(params.token || params.token_publico || params.t);
  if (!token || !tokenFacturaValido(token)) return jsonResponse({ success: false, error: "Token invalido" }, 400);

  const info = buscarFacturaConFila({ token });
  if (!info) return jsonResponse({ success: false, error: "Factura no encontrada" }, 404);

  const facturaId = texto(info.factura.id);
  const historial = leerObjetos(MOVIMIENTOS_FACTURA_SHEET, MOVIMIENTOS_FACTURA_HEADERS)
    .filter(function (mov) { return texto(mov.factura_id) === facturaId; })
    .map(function (mov) {
      return {
        id: texto(mov.id),
        tipo: textoPublico(mov.tipo),
        descripcion: textoPublico(mov.descripcion),
        monto: numero(mov.monto, 0),
        fecha: fechaISO(mov.fecha)
      };
    })
    .sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });

  const evidencias = leerObjetos(EVIDENCIAS_SHEET, EVIDENCIAS_HEADERS)
    .filter(function (ev) { return texto(ev.factura_id) === facturaId; })
    .map(function (ev) {
      return {
        id: texto(ev.id),
        archivo: textoPublico(ev.archivo),
        descripcion: textoPublico(ev.descripcion),
        fecha: fechaISO(ev.fecha)
      };
    })
    .sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });

  return jsonResponse({
    success: true,
    factura: facturaPublica(info.factura),
    historial,
    movimientos: historial,
    evidencias,
    estado: textoPublico(info.factura.estado || "abierta")
  });
}

// -- DONACIONES A MOTORIZADOS ---------------------------------------------
function donarMotorizado(payload) {
  const idMotorizado = texto(payload.idMotorizado || payload.motorizadoId);
  if (!idMotorizado) throw new Error("Falta idMotorizado");

  const monto = numero(payload.monto, 0);
  if (monto <= 0) throw new Error("El monto debe ser mayor a 0");

  const ss = abrirSpreadsheet();
  const donSheet = ss.getSheetByName(DONACIONES_MOTORIZADOS_SHEET);
  const motorSheet = ss.getSheetByName(MOTORIZADOS_SHEET);
  if (!donSheet || !motorSheet) throw new Error("Faltan hojas de donaciones o motorizados");

  const motorData = motorSheet.getDataRange().getValues();

  let filaMotorizado = -1;
  let nuevoAporte = monto;
  let nombreMotorizado = texto(payload.nombreMotorizado);

  for (let i = 1; i < motorData.length; i++) {
    if (String(motorData[i][0]) === String(idMotorizado)) {
      filaMotorizado = i + 1;
      nombreMotorizado = nombreMotorizado || texto(motorData[i][1]);
      const aporteActual = parseFloat(motorData[i][10]) || 0;
      nuevoAporte = aporteActual + monto;
      break;
    }
  }

  if (filaMotorizado === -1) return jsonResponse({ error: "Motorizado no encontrado" }, 404);

  donSheet.appendRow([
    new Date(),
    idMotorizado,
    nombreMotorizado,
    monto,
    texto(payload.tipo) || "Aporte",
    texto(payload.donanteName) || "Anonimo",
    texto(payload.mensaje),
    texto(payload.ciudad)
  ]);

  motorSheet.getRange(filaMotorizado, 11).setValue(nuevoAporte);

  return jsonResponse({ success: true, exito: true, aporteDonado: nuevoAporte });
}

function construirDonacionesMotorizado(id) {
  const sheet = obtenerHoja(DONACIONES_MOTORIZADOS_SHEET);
  const data = sheet.getDataRange().getValues();
  const donaciones = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(id)) {
      donaciones.push({
        timestamp: fechaISO(data[i][0]),
        idMotorizado: data[i][1],
        nombreMotorizado: data[i][2],
        monto: data[i][3],
        tipo: data[i][4],
        donante: data[i][5],
        mensaje: data[i][6],
        ciudad: data[i][7]
      });
    }
  }

  donaciones.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  return donaciones;
}
