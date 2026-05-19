const router = require('express').Router();
const { ping } = require('../services/checker');
const store    = require('../services/projectStore');

// ─── Validators ───────────────────────────────────────────────
function isValidId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id) && id.length <= 40;
}

function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch { return false; }
}

function sanitizeProject(body) {
  return {
    id:          String(body.id         || '').trim().toLowerCase(),
    name:        String(body.name       || '').trim().slice(0, 80),
    url:         String(body.url        || '').trim().replace(/\/$/, ''),
    healthPath:  String(body.healthPath || '/api/health').trim().slice(0, 120),
    host:        String(body.host       || '').trim().slice(0, 40),
    color:       /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '#6366f1',
    features:    Array.isArray(body.features) ? body.features.filter(f => typeof f === 'string') : [],
    deployHook:  body.deployHook ? String(body.deployHook).trim().slice(0, 500) : null,
  };
}

// ─── GET /api/projects ────────────────────────────────────────
router.get('/', (_req, res) => {
  res.json(store.read());
});

// ─── POST /api/projects ───────────────────────────────────────
router.post('/', (req, res) => {
  const projects = store.read();
  const data     = sanitizeProject(req.body);

  if (!data.id)              return res.status(400).json({ error: 'id zorunludur' });
  if (!isValidId(data.id))   return res.status(400).json({ error: 'id sadece küçük harf, rakam ve tire içerebilir' });
  if (!data.name)            return res.status(400).json({ error: 'name zorunludur' });
  if (!data.url)             return res.status(400).json({ error: 'url zorunludur' });
  if (!isValidUrl(data.url)) return res.status(400).json({ error: 'Geçersiz URL (http:// veya https:// ile başlamalı)' });
  if (projects.find(p => p.id === data.id)) return res.status(409).json({ error: `"${data.id}" id\'si zaten kullanımda` });
  if (data.deployHook && !isValidUrl(data.deployHook)) return res.status(400).json({ error: 'Geçersiz deployHook URL' });

  projects.push(data);
  store.write(projects);
  res.status(201).json(data);
});

// ─── PUT /api/projects/:id ────────────────────────────────────
router.put('/:id', (req, res) => {
  const projects = store.read();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Proje bulunamadı' });

  const data = sanitizeProject({ ...projects[idx], ...req.body });

  if (!isValidUrl(data.url)) return res.status(400).json({ error: 'Geçersiz URL' });
  if (data.deployHook && !isValidUrl(data.deployHook)) return res.status(400).json({ error: 'Geçersiz deployHook URL' });

  projects[idx] = { ...data, id: projects[idx].id };
  store.write(projects);
  res.json(projects[idx]);
});

// ─── DELETE /api/projects/:id ─────────────────────────────────
router.delete('/:id', (req, res) => {
  const projects = store.read();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Proje bulunamadı' });
  projects.splice(idx, 1);
  store.write(projects);
  res.json({ ok: true });
});

// ─── GET /api/projects/status ─────────────────────────────────
router.get('/status', async (_req, res) => {
  const projects = store.read();
  const results  = await Promise.all(
    projects.map(async (p) => {
      const check = await ping(p.url + (p.healthPath || '/api/health'));
      return { id: p.id, name: p.name, host: p.host, color: p.color, features: p.features, url: p.url, ...check };
    })
  );
  res.json(results);
});

// ─── GET /api/projects/:id/status ────────────────────────────
router.get('/:id/status', async (req, res) => {
  const projects = store.read();
  const project  = projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });
  const check = await ping(project.url + (project.healthPath || '/api/health'));
  res.json({ id: project.id, name: project.name, host: project.host, url: project.url, ...check });
});

module.exports = router;
