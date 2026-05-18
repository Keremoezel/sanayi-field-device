const router = require('express').Router();

const BASE = 'https://api.vercel.com';

function headers() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function vercelFetch(path) {
  const res = await fetch(BASE + path, {
    headers: headers(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Vercel API ${res.status}`);
  return res.json();
}

// Tüm projeleri + son deployment'larını çek
router.get('/projects', async (req, res) => {
  if (!process.env.VERCEL_TOKEN) {
    return res.status(400).json({ error: 'VERCEL_TOKEN eksik' });
  }

  try {
    const { projects } = await vercelFetch('/v9/projects?limit=20');

    const enriched = await Promise.all(
      projects.map(async (p) => {
        try {
          const { deployments } = await vercelFetch(
            `/v6/deployments?projectId=${p.id}&limit=1&target=production`
          );
          const d = deployments?.[0];
          return {
            id:            p.id,
            name:          p.name,
            framework:     p.framework ?? null,
            url:           p.alias?.[0] ? `https://${p.alias[0]}` : null,
            lastDeploy: d ? {
              state:         d.state,
              createdAt:     d.createdAt,
              buildDuration: d.buildingAt && d.ready ? d.ready - d.buildingAt : null,
              commit:        d.meta?.githubCommitMessage?.split('\n')[0] ?? null,
              branch:        d.meta?.githubCommitRef ?? null,
              author:        d.meta?.githubCommitAuthorName ?? null,
            } : null,
          };
        } catch {
          return { id: p.id, name: p.name, lastDeploy: null };
        }
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tek proje son deployment
router.get('/projects/:name/deploy', async (req, res) => {
  if (!process.env.VERCEL_TOKEN) {
    return res.status(400).json({ error: 'VERCEL_TOKEN eksik' });
  }

  try {
    const { projects } = await vercelFetch(`/v9/projects?search=${req.params.name}&limit=5`);
    const project = projects.find(p => p.name === req.params.name) ?? projects[0];
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });

    const { deployments } = await vercelFetch(
      `/v6/deployments?projectId=${project.id}&limit=5&target=production`
    );

    res.json({
      project: project.name,
      deployments: deployments.map(d => ({
        state:         d.state,
        createdAt:     d.createdAt,
        buildDuration: d.buildingAt && d.ready ? d.ready - d.buildingAt : null,
        commit:        d.meta?.githubCommitMessage?.split('\n')[0] ?? null,
        branch:        d.meta?.githubCommitRef ?? null,
        author:        d.meta?.githubCommitAuthorName ?? null,
        url:           d.url ? `https://${d.url}` : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
