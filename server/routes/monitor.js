const router   = require('express').Router();
const { ping } = require('../services/checker');
const projects = require('../data/projects.json');

const SANAYI_URL = 'https://sanayi-uygulamasi.vercel.app';

// Sanayi core services — ping what we can, note what needs a backend endpoint
async function checkSanayiServices() {
  const apiCheck = await ping(SANAYI_URL + '/');

  return [
    {
      name: 'API',
      online: apiCheck.online,
      status: apiCheck.status,
      ms: apiCheck.ms,
      note: null,
    },
    {
      name: 'Database',
      online: apiCheck.online,  // inferred: if API is up, DB likely up
      status: null,
      ms: null,
      note: apiCheck.online ? 'API üzerinden' : 'bilinmiyor',
    },
    {
      name: 'AI Model',
      online: null,
      status: null,
      ms: null,
      note: 'endpoint gerekli',
    },
    {
      name: 'Blob Storage',
      online: null,
      status: null,
      ms: null,
      note: 'endpoint gerekli',
    },
  ];
}

router.get('/status', async (req, res) => {
  const [sanayiServices, ...projectChecks] = await Promise.all([
    checkSanayiServices(),
    ...projects.map(async (p) => {
      const check = await ping(p.url + p.healthPath);
      return { ...p, ...check };
    }),
  ]);

  res.json({
    sanayi: {
      services: sanayiServices,
      stats: {
        todayScans:  null,
        avgMs:       null,
        environment: 'production',
        lastError:   null,
      },
    },
    projects: projectChecks,
  });
});

module.exports = router;
