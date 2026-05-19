const router   = require('express').Router();
const { ping } = require('../services/checker');
const store    = require('../services/projectStore');
const { notifyDown, notifyRecovered } = require('../services/notifier');

// ─── State ────────────────────────────────────────────────────
const prevStatus = {};
let   cached     = null;
let   cacheTs    = 0;
let   inFlight   = null;

const CACHE_TTL = 8000; // ms — prevents hammering remote services

// ─── Health fetch ─────────────────────────────────────────────
async function fetchHealth(project) {
  const healthUrl = project.url + (project.healthPath || '/api/health');
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res   = await fetch(healthUrl, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'SanayiFieldDevice/1.0' },
    });
    clearTimeout(timer);
    const ms = Date.now() - start;

    if (!res.ok) return { online: false, status: res.status, ms, rich: false };

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { online: true, status: res.status, ms, rich: false };

    const data = await res.json();
    const rich  = !!(data.services || data.status);
    return { online: data.status !== 'down', status: res.status, ms, rich, health: data };
  } catch (err) {
    const ms = Date.now() - start;
    let errorType = 'unknown';
    if (err.name === 'AbortError')                  errorType = 'timeout';
    else if (err.message?.includes('ENOTFOUND'))    errorType = 'dns';
    else if (err.message?.includes('ECONNREFUSED')) errorType = 'refused';
    return { online: false, ms, errorType, rich: false };
  }
}

// ─── Check all projects ───────────────────────────────────────
async function performCheck() {
  const projects = store.read();

  const results = await Promise.all(projects.map(async (p) => {
    const result = await fetchHealth(p);
    const was = prevStatus[p.id];
    if (was === true  && !result.online) notifyDown(p.name);
    if (was === false &&  result.online) notifyRecovered(p.name);
    prevStatus[p.id] = result.online;
    return { id: p.id, name: p.name, url: p.url, host: p.host, features: p.features, ...result };
  }));

  const sanayi         = results.find(r => r.id === 'sanayi');
  const sanayiServices = buildSanayiServices(sanayi);

  const response = {
    sanayi: {
      services: sanayiServices,
      stats: sanayi?.health ? {
        environment: sanayi.health.environment ?? '—',
        version:     sanayi.health.version     ?? '—',
        todayScans:  sanayi.health.todayScans  ?? null,
        avgMs:       sanayi.health.avgMs       ?? null,
        lastError:   sanayi.health.lastError   ?? null,
      } : { environment: 'production', version: '—', todayScans: null, avgMs: null, lastError: null },
    },
    projects: results,
    checkedAt: Date.now(),
  };

  cached  = response;
  cacheTs = Date.now();
  return response;
}

// ─── GET /api/monitor/status ──────────────────────────────────
router.get('/status', async (req, res) => {
  const now   = Date.now();
  const fresh = req.query.fresh === '1';

  // Serve cached result if still fresh
  if (!fresh && cached && (now - cacheTs) < CACHE_TTL) {
    return res.json(cached);
  }

  // If a check is already in progress, attach to it
  if (inFlight) {
    try { return res.json(await inFlight); }
    catch { return res.status(503).json({ error: 'Monitor kontrol başarısız' }); }
  }

  inFlight = performCheck().finally(() => { inFlight = null; });

  try { res.json(await inFlight); }
  catch { res.status(503).json({ error: 'Monitor kontrol başarısız' }); }
});

// ─── Sanayi service builder ───────────────────────────────────
function buildSanayiServices(sanayi) {
  if (!sanayi) return fallbackServices();

  if (sanayi.rich && sanayi.health?.services) {
    return Object.entries(sanayi.health.services).map(([name, val]) => ({
      name:   name.charAt(0).toUpperCase() + name.slice(1),
      online: val.status === 'ok',
      ms:     val.ms   ?? null,
      note:   val.status !== 'ok' ? val.status : null,
    }));
  }

  return [
    { name: 'API', online: sanayi.online, status: sanayi.status, ms: sanayi.ms, note: sanayi.online ? null : 'offline' },
    { name: 'Database',     online: null, ms: null, note: '/api/health ekle' },
    { name: 'AI Model',     online: null, ms: null, note: '/api/health ekle' },
    { name: 'Blob Storage', online: null, ms: null, note: '/api/health ekle' },
  ];
}

function fallbackServices() {
  return [
    { name: 'API',          online: null, ms: null, note: 'bilinmiyor' },
    { name: 'Database',     online: null, ms: null, note: 'bilinmiyor' },
    { name: 'AI Model',     online: null, ms: null, note: 'bilinmiyor' },
    { name: 'Blob Storage', online: null, ms: null, note: 'bilinmiyor' },
  ];
}

module.exports = router;
