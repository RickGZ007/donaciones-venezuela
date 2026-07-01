(function (window) {
  'use strict';

  let config = {
    appsScriptUrl: ''
  };

  function configure(nextConfig) {
    config = Object.assign({}, config, nextConfig || {});
  }

  function assertConfigured() {
    if (!config.appsScriptUrl || !/\/exec$/.test(config.appsScriptUrl)) {
      throw new Error('Apps Script URL no configurada');
    }
  }

  function emptyAll() {
    return {
      lugares: [],
      centros: [],
      voluntarios: [],
      rescatistas: [],
      motorizados: [],
      trayectos: [],
      historial: [],
      facturas: [],
      estadisticas: {}
    };
  }

  function withQuery(action, params) {
    assertConfigured();
    const url = new URL(config.appsScriptUrl);
    if (action) url.searchParams.set('accion', action);
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data && data.error) throw new Error(data.error);
    return data || {};
  }

  function normalizeAll(data) {
    return Object.assign(emptyAll(), data || {}, {
      lugares: data.lugares || data.centros || [],
      centros: data.centros || data.lugares || [],
      voluntarios: data.voluntarios || [],
      rescatistas: data.rescatistas || [],
      motorizados: data.motorizados || [],
      trayectos: data.trayectos || [],
      historial: data.historial || data.movimientos || [],
      facturas: data.facturas || [],
      estadisticas: data.estadisticas || data.stats || {}
    });
  }

  async function getAll() {
    try {
      const data = await fetchJson(withQuery('', {}));
      return { data: normalizeAll(data), source: 'live' };
    } catch (err) {
      return { data: emptyAll(), source: 'error', error: err };
    }
  }

  async function getAction(action, responseKey, params) {
    try {
      const data = await fetchJson(withQuery(action, params || {}));
      return { data: data[responseKey] || [], source: 'live' };
    } catch (err) {
      return { data: [], source: 'error', error: err };
    }
  }

  async function post(payload) {
    const data = await fetchJson(withQuery(payload && payload.accion, payload || {}));
    if (data.success === false || data.exito === false) {
      throw new Error(data.error || 'No se pudo guardar en Google Sheets');
    }
    return data;
  }

  async function getSeguimiento(token) {
    try {
      const data = await fetchJson(withQuery('seguimiento_factura', { token }));
      return { data, source: 'live' };
    } catch (err) {
      return { data: null, source: 'error', error: err };
    }
  }

  window.SheetsService = {
    configure,
    getAll,
    getLugares: (params) => getAction('lugares', 'lugares', params),
    getVoluntarios: (params) => getAction('voluntarios', 'voluntarios', params),
    getRescatistas: (params) => getAction('rescatistas', 'rescatistas', params),
    getMotorizados: (params) => getAction('motorizados', 'motorizados', params),
    getTrayectos: (motorizadoId) => getAction('trayectos', 'trayectos', { motorizado: motorizadoId }),
    getHistorial: (lugar) => getAction('historial', 'movimientos', { centro: lugar }),
    getFamiliares: (query) => getAction('buscar_familiar', 'resultados', { q: query }),
    getFacturas: (params) => getAction('facturas', 'facturas', params),
    getSeguimiento,
    post
  };
})(window);
