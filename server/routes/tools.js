const router  = require('express').Router();
const logger  = require('../services/logger');
const pkg     = require('../../package.json');
const { exec } = require('child_process');
const path    = require('path');

const ROOT = path.join(__dirname, '../..');

function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: ROOT, timeout: 15000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

// ─── GET /api/tools/status ────────────────────────────────────
router.get('/status', async (req, res) => {
  const [localSha, gitLog] = await Promise.all([
    run('git rev-parse --short HEAD'),
    run('git log -1 --format="%s|%an|%ar"'),
  ]);

  let commitMsg = null, commitAuthor = null, commitAge = null;
  if (gitLog) {
    const parts = gitLog.split('|');
    commitMsg    = parts[0] || null;
    commitAuthor = parts[1] || null;
    commitAge    = parts[2] || null;
  }

  res.json({
    version:  pkg.version,
    node:     process.version,
    uptime:   Math.floor(process.uptime()),
    memory:   Math.round(process.memoryUsage().rss / 1024 / 1024),
    repo:     process.env.GITHUB_REPO    || null,
    branch:   process.env.GITHUB_BRANCH  || 'master',
    commit:   localSha,
    commitMsg,
    commitAuthor,
    commitAge,
    host:     `${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8787}`,
    env:      process.env.NODE_ENV || 'production',
    sanayiUrl: process.env.SANAYI_API_URL || null,
  });
});

// ─── GET /api/tools/logs ─────────────────────────────────────
router.get('/logs', (req, res) => {
  const logs = logger.readLogs();
  const limit = Number(req.query.limit) || 100;
  res.json(logs.slice(0, limit));
});

// ─── DELETE /api/tools/logs ──────────────────────────────────
router.delete('/logs', (req, res) => {
  logger.clear();
  logger.log('Loglar temizlendi', 'ok');
  res.json({ ok: true });
});

// ─── GET /api/tools/logs/export ──────────────────────────────
router.get('/logs/export', (req, res) => {
  const logs = logger.readLogs();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Disposition', `attachment; filename="field-device-logs-${ts}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(logs, null, 2));
});

// ─── POST /api/tools/restart ─────────────────────────────────
router.post('/restart', (req, res) => {
  logger.log('Restart isteği alındı — sunucu yeniden başlatılıyor', 'warn');
  res.json({ ok: true, note: 'Sunucu 500ms içinde kapanacak. Termux\'ta pm2 veya npm start ile yeniden başlatın.' });
  setTimeout(() => process.exit(0), 500);
});

// ─── POST /api/tools/update ──────────────────────────────────
router.post('/update', async (req, res) => {
  logger.log('Manuel update isteği alındı', 'warn');
  res.json({ ok: true, note: 'Güncelleme arka planda başlatıldı. Logları takip edin.' });

  // Updater worker'ı tetikle
  try {
    require('../workers/updater').checkNow?.();
  } catch {
    // Updater checkNow export etmiyorsa sessizce geç
    exec('git pull origin ' + (process.env.GITHUB_BRANCH || 'master'), { cwd: ROOT }, (err, out) => {
      if (err) logger.log('Git pull hata: ' + err.message, 'err');
      else     logger.log('Git pull tamamlandı: ' + out.trim().slice(0, 80), 'ok');
    });
  }
});

// ─── GET /api/tools/ping/:id ─────────────────────────────────
const { ping } = require('../services/checker');
const projects = require('../data/projects.json');

router.get('/ping/:id', async (req, res) => {
  const id = req.params.id;

  if (id === 'local') {
    return res.json({
      online: true, status: 200, ms: 0,
      name: 'Local Server', url: `http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||8787}`,
    });
  }

  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });

  const result = await ping(project.url + project.healthPath);
  res.json({ id: project.id, name: project.name, url: project.url, ...result });
});

module.exports = router;
