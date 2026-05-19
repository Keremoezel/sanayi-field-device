const router = require('express').Router();
const { ping } = require('../services/checker');
const store    = require('../services/projectStore');

router.get('/', (req, res) => {
  res.json(store.read());
});

router.post('/', (req, res) => {
  const projects = store.read();
  const { id, name, url, healthPath, host, color, features, deployHook } = req.body;
  if (!id || !name || !url) return res.status(400).json({ error: 'id, name ve url zorunludur' });
  if (projects.find(p => p.id === id)) return res.status(409).json({ error: 'Bu id zaten mevcut' });
  const project = {
    id,
    name,
    url,
    healthPath:  healthPath  || '/api/health',
    host:        host        || '',
    color:       color       || '#6366f1',
    features:    features    || [],
    deployHook:  deployHook  || null,
  };
  projects.push(project);
  store.write(projects);
  res.status(201).json(project);
});

router.put('/:id', (req, res) => {
  const projects = store.read();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Proje bulunamadı' });
  projects[idx] = { ...projects[idx], ...req.body, id: projects[idx].id };
  store.write(projects);
  res.json(projects[idx]);
});

router.delete('/:id', (req, res) => {
  const projects = store.read();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Proje bulunamadı' });
  projects.splice(idx, 1);
  store.write(projects);
  res.json({ ok: true });
});

router.get('/status', async (req, res) => {
  const projects = store.read();
  const results = await Promise.all(
    projects.map(async (p) => {
      const check = await ping(p.url + p.healthPath);
      return { id: p.id, name: p.name, host: p.host, color: p.color, features: p.features, url: p.url, ...check };
    })
  );
  res.json(results);
});

router.get('/:id/status', async (req, res) => {
  const projects = store.read();
  const project  = projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const check = await ping(project.url + project.healthPath);
  res.json({ id: project.id, name: project.name, host: project.host, url: project.url, ...check });
});

module.exports = router;
