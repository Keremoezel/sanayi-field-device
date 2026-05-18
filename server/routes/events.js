const router   = require('express').Router();
const projects = require('../data/projects.json');

const KEY = process.env.FIELD_DEVICE_KEY || '';

async function fetchProjectLogs(project) {
  const url = project.url + '/api/field-logs';
  try {
    const headers = { 'User-Agent': 'SanayiFieldDevice/0.2' };
    if (KEY) headers['Authorization'] = `Bearer ${KEY}`;

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return { id: project.id, name: project.name, error: `HTTP ${res.status}`, events: [] };
    const data = await res.json();
    return { id: project.id, name: project.name, events: data.events || [], total: data.total || 0 };
  } catch (err) {
    return { id: project.id, name: project.name, error: err.name === 'AbortError' ? 'timeout' : 'unreachable', events: [] };
  }
}

// Tüm projelerin loglarını çek
router.get('/', async (req, res) => {
  const results = await Promise.all(projects.map(fetchProjectLogs));
  res.json(results);
});

// Tek proje logu
router.get('/:id', async (req, res) => {
  const project = projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const result = await fetchProjectLogs(project);
  res.json(result);
});

module.exports = router;
