const router = require('express').Router();
const { ping } = require('../services/checker');
const projects = require('../data/projects.json');

router.get('/', (req, res) => {
  res.json(projects);
});

router.get('/status', async (req, res) => {
  const results = await Promise.all(
    projects.map(async (p) => {
      const check = await ping(p.url + p.healthPath);
      return { id: p.id, name: p.name, host: p.host, color: p.color, features: p.features, url: p.url, ...check };
    })
  );
  res.json(results);
});

router.get('/:id/status', async (req, res) => {
  const project = projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const check = await ping(project.url + project.healthPath);
  res.json({ id: project.id, name: project.name, host: project.host, url: project.url, ...check });
});

module.exports = router;
