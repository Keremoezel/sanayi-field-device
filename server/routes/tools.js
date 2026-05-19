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

// ─── GET /api/tools/git ──────────────────────────────────────
router.get('/git', async (_req, res) => {
  const [branch, statusOut, logOut] = await Promise.all([
    run('git rev-parse --abbrev-ref HEAD'),
    run('git status --short'),
    run('git log --oneline -8'),
  ]);

  const upstream = await run('git rev-parse --abbrev-ref @{upstream}').catch(() => null);
  let ahead = 0, behind = 0;
  if (upstream) {
    const ab = await run(`git rev-list --left-right --count HEAD...${upstream}`);
    if (ab) { const p = ab.split(/\s+/); ahead = +p[0] || 0; behind = +p[1] || 0; }
  }

  const files = (statusOut || '').split('\n').filter(Boolean);
  res.json({
    branch:   branch  || 'unknown',
    ahead, behind,
    modified: files.length,
    files:    files.slice(0, 12),
    log:      (logOut || '').split('\n').filter(Boolean),
  });
});

// ─── GET /api/tools/system ───────────────────────────────────
router.get('/system', (_req, res) => {
  const total = os.totalmem();
  const free  = os.freemem();
  const used  = total - free;
  const load  = os.loadavg();
  const cpus  = os.cpus();
  res.json({
    memory: {
      total:   Math.round(total / 1024 / 1024),
      free:    Math.round(free  / 1024 / 1024),
      used:    Math.round(used  / 1024 / 1024),
      percent: Math.round((used / total) * 100),
    },
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model?.replace(/\s+/g, ' ').trim() || '—',
      load1:  load[0].toFixed(2),
      load5:  load[1].toFixed(2),
      load15: load[2].toFixed(2),
    },
    osUptime: Math.floor(os.uptime()),
    platform: os.platform(),
    arch:     os.arch(),
  });
});

// ─── GET /api/tools/cmd/:name ────────────────────────────────
const SAFE_CMDS = {
  'git-pull':   'git pull',
  'git-status': 'git status',
  'git-log':    'git log --oneline -12',
  'git-diff':   'git diff --stat',
  'npm-list':   'npm list --depth=0',
  'node-v':     'node --version',
  'npm-v':      'npm --version',
  'git-branch': 'git branch -a',
  'git-stash':  'git stash list',
  'disk':       os.platform() === 'win32' ? 'wmic logicaldisk get caption,freespace,size' : 'df -h .',
  'ps-node':    os.platform() === 'win32' ? 'tasklist /FI "IMAGENAME eq node.exe"' : 'ps aux | grep -E "node|npm" | grep -v grep',
};

// ─── GET /api/tools/env ──────────────────────────────────────
const ENV_KEYS  = ['PORT','HOST','NODE_ENV','GITHUB_REPO','GITHUB_BRANCH','SANAYI_API_URL','MAX_UPLOAD_SIZE_MB','SCAN_RATE_LIMIT_PER_MIN'];
const MASK_KEYS = ['VERCEL_TOKEN','SANAYI_API_KEY','FIELD_DEVICE_KEY'];

router.get('/env', (_req, res) => {
  const result = {};
  for (const k of [...ENV_KEYS, ...MASK_KEYS]) {
    const v = process.env[k];
    if (v) result[k] = MASK_KEYS.includes(k) ? v.slice(0, 4) + '***' : v;
    else   result[k] = null;
  }
  res.json(result);
});

router.get('/cmd/:name', async (req, res) => {
  const name = req.params.name;

  // Built-in env-check — cross-platform, no shell quoting issues
  if (name === 'env-check') {
    const lines = [...ENV_KEYS, ...MASK_KEYS].map(k => {
      const v = process.env[k];
      if (!v) return `${k} = (not set)`;
      return `${k} = ${MASK_KEYS.includes(k) ? v.slice(0, 4) + '***' : v}`;
    });
    return res.json({ name, output: lines.join('\n'), error: false });
  }

  const cmd = SAFE_CMDS[name];
  if (!cmd) return res.status(400).json({ error: 'Bilinmeyen komut: ' + name });

  exec(cmd, { cwd: ROOT, timeout: 20000 }, (err, stdout, stderr) => {
    const output = (stdout || '') + (err && !stdout ? (stderr || err.message) : '');
    res.json({ name, output: output.trim(), error: !!err && !stdout });
  });
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
