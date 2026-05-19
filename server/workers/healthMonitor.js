/**
 * Background health monitor — polls all projects every 60s independently
 * of frontend requests. Stores up/down history, fires Termux notifications,
 * emits SSE events, and caches results for the monitor route.
 */
const EventEmitter = require('events');
const fs           = require('fs');
const path         = require('path');
const store        = require('../services/projectStore');
const logger       = require('../services/logger');
const { notifyDown, notifyRecovered } = require('../services/notifier');

const HISTORY_FILE   = path.join(__dirname, '../data/health-history.json');
const MAX_HISTORY    = 1000;
const CHECK_INTERVAL = 60 * 1000;

const emitter = new EventEmitter();
emitter.setMaxListeners(30);

const prevStatus = {};
let cache    = null;
let cacheTs  = 0;
let inFlight = null;
let timer    = null;

// ── Health fetch ──────────────────────────────────────────────
async function fetchHealth(project) {
  const url   = project.url + (project.healthPath || '/api/health');
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 6000);
    const res  = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'SanayiFieldDevice/1.0' },
    });
    clearTimeout(t);
    const ms = Date.now() - start;
    if (!res.ok) return { online: false, status: res.status, ms, rich: false };
    const ct   = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { online: true, status: res.status, ms, rich: false };
    const data = await res.json();
    const rich = !!(data.services || data.status);
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

// ── History ───────────────────────────────────────────────────
function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch { return []; }
}

function appendHistory(entry) {
  const history = readHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(history)); } catch {}
}

// ── Core check ────────────────────────────────────────────────
async function performCheck() {
  const projects = store.read();

  const results = await Promise.all(projects.map(async (p) => {
    const result = await fetchHealth(p);
    const was    = prevStatus[p.id];

    if (was === true && !result.online) {
      notifyDown(p.name);
      const ev = { id: p.id, name: p.name, event: 'down', ms: result.ms, errorType: result.errorType || null, ts: Date.now() };
      appendHistory(ev);
      emitter.emit('status-change', ev);
      logger.log(`${p.name} erişilemez (${result.errorType || 'offline'})`, 'warn');
    }
    if (was === false && result.online) {
      notifyRecovered(p.name);
      const ev = { id: p.id, name: p.name, event: 'up', ms: result.ms, ts: Date.now() };
      appendHistory(ev);
      emitter.emit('status-change', ev);
      logger.log(`${p.name} geri döndü (${result.ms}ms)`, 'ok');
    }
    prevStatus[p.id] = result.online;
    return { id: p.id, name: p.name, url: p.url, host: p.host, features: p.features, ...result };
  }));

  const sanayi = results.find(r => r.id === 'sanayi');
  cache = {
    sanayi:    { services: buildSanayiServices(sanayi), stats: extractStats(sanayi) },
    projects:  results,
    checkedAt: Date.now(),
  };
  cacheTs = Date.now();
  emitter.emit('checked', cache);
  return cache;
}

// ── Helpers ───────────────────────────────────────────────────
function extractStats(sanayi) {
  if (!sanayi?.health) return { environment: 'production', version: '—', todayScans: null, avgMs: null, lastError: null };
  return {
    environment: sanayi.health.environment ?? '—',
    version:     sanayi.health.version     ?? '—',
    todayScans:  sanayi.health.todayScans  ?? null,
    avgMs:       sanayi.health.avgMs       ?? null,
    lastError:   sanayi.health.lastError   ?? null,
  };
}

function buildSanayiServices(sanayi) {
  if (!sanayi) return fallback();
  if (sanayi.rich && sanayi.health?.services) {
    return Object.entries(sanayi.health.services).map(([name, val]) => ({
      name:   name.charAt(0).toUpperCase() + name.slice(1),
      online: val.status === 'ok',
      ms:     val.ms ?? null,
      note:   val.status !== 'ok' ? val.status : null,
    }));
  }
  return [
    { name: 'API',          online: sanayi.online, ms: sanayi.ms, note: sanayi.online ? null : 'offline' },
    { name: 'Database',     online: null, ms: null, note: '/api/health ekle' },
    { name: 'AI Model',     online: null, ms: null, note: '/api/health ekle' },
    { name: 'Blob Storage', online: null, ms: null, note: '/api/health ekle' },
  ];
}

function fallback() {
  return ['API', 'Database', 'AI Model', 'Blob Storage'].map(name => ({ name, online: null, ms: null, note: 'bilinmiyor' }));
}

// ── Public API ────────────────────────────────────────────────
function getCache()   { return cache; }
function getCacheTs() { return cacheTs; }

async function checkNow() {
  if (inFlight) return inFlight;
  inFlight = performCheck().finally(() => { inFlight = null; });
  return inFlight;
}

function start() {
  setTimeout(checkNow, 15 * 1000);
  timer = setInterval(checkNow, CHECK_INTERVAL);
  logger.log('Health monitor başlatıldı (60s periyot)', 'ok');
}

function stop() {
  if (timer) clearInterval(timer);
}

module.exports = { start, stop, checkNow, getCache, getCacheTs, readHistory, emitter };
