const router  = require('express').Router();
const logger  = require('../services/logger');
const store   = require('../services/projectStore');
const pkg     = require('../../package.json');
const QRCode  = require('qrcode');
const os      = require('os');
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

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
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
    version:      pkg.version,
    node:         process.version,
    uptime:       Math.floor(process.uptime()),
    memory:       Math.round(process.memoryUsage().rss / 1024 / 1024),
    repo:         process.env.GITHUB_REPO   || null,
    branch:       process.env.GITHUB_BRANCH || 'master',
    commit:       localSha,
    commitMsg,
    commitAuthor,
    commitAge,
    host:         `${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8787}`,
    env:          process.env.NODE_ENV || 'production',
    sanayiUrl:    process.env.SANAYI_API_URL || null,
  });
});

// ─── GET /api/tools/qr ───────────────────────────────────────
router.get('/qr', async (_req, res) => {
  const port = process.env.PORT || 8787;
  const ip   = getLanIp();
  const url  = `http://${ip}:${port}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1, color: { light: '#ffffff', dark: '#070b18' } });
    res.json({ dataUrl, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/tools/network ──────────────────────────────────
router.get('/network', (_req, res) => {
  const ifaces = os.networkInterfaces();
  const interfaces = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4') {
        interfaces.push({ name, address: addr.address, internal: addr.internal });
      }
    }
  }
  res.json({
    hostname:   os.hostname(),
    platform:   os.platform(),
    arch:       os.arch(),
    interfaces,
    lanIp:      getLanIp(),
    port:       process.env.PORT || 8787,
  });
});

// ─── GET /api/tools/logs ─────────────────────────────────────
router.get('/logs', (req, res) => {
  const logs  = logger.readLogs();
  const limit = Number(req.query.limit) || 100;
  res.json(logs.slice(0, limit));
});

// ─── GET /api/tools/logs/stream (SSE) ───────────────────────
router.get('/logs/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const sendLog = (entry) => {
    res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
  };

  logger.emitter.on('log', sendLog);
  const hb = setInterval(() => res.write(':keepalive\n\n'), 20000);

  req.on('close', () => {
    logger.emitter.off('log', sendLog);
    clearInterval(hb);
  });
});

// ─── DELETE /api/tools/logs ──────────────────────────────────
router.delete('/logs', (_req, res) => {
  logger.clear();
  logger.log('Loglar temizlendi', 'ok');
  res.json({ ok: true });
});

// ─── GET /api/tools/logs/export ──────────────────────────────
router.get('/logs/export', (_req, res) => {
  const logs = logger.readLogs();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Disposition', `attachment; filename="field-device-logs-${ts}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(logs, null, 2));
});

// ─── POST /api/tools/restart ─────────────────────────────────
router.post('/restart', (_req, res) => {
  logger.log('Restart isteği alındı — sunucu yeniden başlatılıyor', 'warn');
  res.json({ ok: true, note: 'Sunucu 500ms içinde kapanacak. Termux\'ta pm2 veya npm start ile yeniden başlatın.' });
  setTimeout(() => process.exit(0), 500);
});

// ─── POST /api/tools/update ──────────────────────────────────
router.post('/update', async (req, res) => {
  logger.log('Manuel update isteği alındı', 'warn');
  res.json({ ok: true, note: 'Güncelleme arka planda başlatıldı. Logları takip edin.' });
  try {
    require('../workers/updater').checkNow?.();
  } catch {
    exec('git pull origin ' + (process.env.GITHUB_BRANCH || 'master'), { cwd: ROOT }, (err, out) => {
      if (err) logger.log('Git pull hata: ' + err.message, 'err');
      else     logger.log('Git pull tamamlandı: ' + out.trim().slice(0, 80), 'ok');
    });
  }
});

// ─── GET /api/tools/ping/:id ─────────────────────────────────
const { ping } = require('../services/checker');

router.get('/ping/:id', async (req, res) => {
  const id = req.params.id;

  if (id === 'local') {
    return res.json({
      online: true, status: 200, ms: 0,
      name: 'Local Server', url: `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8787}`,
    });
  }

  const projects = store.read();
  const project  = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });

  const result = await ping(project.url + project.healthPath);
  res.json({ id: project.id, name: project.name, url: project.url, ...result });
});

module.exports = router;
