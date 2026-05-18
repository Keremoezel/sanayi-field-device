const router   = require('express').Router();
const { ping } = require('../services/checker');
const projects = require('../data/projects.json');
const { notifyDown, notifyRecovered } = require('../services/notifier');

// Önceki kontrol durumları (down/up geçişlerini takip etmek için)
const prevStatus = {};

// Proje health endpoint'i varsa zengin veri çek, yoksa ping ile yetин
async function fetchHealth(project) {
  const healthUrl = project.url + project.healthPath;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(healthUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SanayiFieldDevice/0.2' },
    });
    clearTimeout(timer);
    const ms = Date.now() - start;

    if (!res.ok) {
      return { online: false, status: res.status, ms, rich: false };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { online: true, status: res.status, ms, rich: false };
    }

    const data = await res.json();
    // /api/health endpoint'i bizim formatı döndürüyorsa zengin veri var
    const rich = !!(data.services || data.status);
    return { online: data.status !== 'down', status: res.status, ms, rich, health: data };
  } catch (err) {
    const ms = Date.now() - start;
    let errorType = 'unknown';
    if (err.name === 'AbortError') errorType = 'timeout';
    else if (err.message?.includes('ENOTFOUND')) errorType = 'dns';
    else if (err.message?.includes('ECONNREFUSED')) errorType = 'refused';
    return { online: false, ms, errorType, rich: false };
  }
}

router.get('/status', async (req, res) => {
  const results = await Promise.all(projects.map(async (p) => {
    const result = await fetchHealth(p);
    const was = prevStatus[p.id];
    if (was === true && !result.online)  notifyDown(p.name);
    if (was === false && result.online)  notifyRecovered(p.name);
    prevStatus[p.id] = result.online;
    return {
      id:       p.id,
      name:     p.name,
      url:      p.url,
      host:     p.host,
      features: p.features,
      ...result,
    };
  }));

  // Sanayi'ye özel servisleri ayır
  const sanayi = results.find(r => r.id === 'sanayi');
  const sanayiServices = buildSanayiServices(sanayi);

  res.json({
    sanayi: {
      services: sanayiServices,
      stats: sanayi?.health ? {
        environment: sanayi.health.environment ?? '—',
        version:     sanayi.health.version ?? '—',
        todayScans:  sanayi.health.todayScans ?? null,
        avgMs:       sanayi.health.avgMs ?? null,
        lastError:   sanayi.health.lastError ?? null,
      } : {
        environment: 'production',
        version:     '—',
        todayScans:  null,
        avgMs:       null,
        lastError:   null,
      },
    },
    projects: results,
  });
});

function buildSanayiServices(sanayi) {
  if (!sanayi) return fallbackServices();

  // Zengin health verisi varsa servisleri oradan al
  if (sanayi.rich && sanayi.health?.services) {
    return Object.entries(sanayi.health.services).map(([name, val]) => ({
      name:   name.charAt(0).toUpperCase() + name.slice(1),
      online: val.status === 'ok',
      ms:     val.ms ?? null,
      note:   val.status !== 'ok' ? val.status : null,
    }));
  }

  // Sadece ping varsa API durumunu göster, diğerleri bilinmiyor
  return [
    {
      name:   'API',
      online: sanayi.online,
      status: sanayi.status,
      ms:     sanayi.ms,
      note:   sanayi.online ? null : 'offline',
    },
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
