require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const logger  = require('./services/logger');
const pkg     = require('../package.json');

const app = express();

// ─── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── Security headers ─────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// ─── Slow-request logger ──────────────────────────────────────
app.use((req, _res, next) => {
  req._startMs = Date.now();
  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    if (!req.path.startsWith('/api/')) return;
    const ms = Date.now() - (req._startMs || Date.now());
    if (res.statusCode >= 400) {
      logger.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`, 'warn');
    } else if (ms > 4000) {
      logger.log(`Yavaş istek: ${req.method} ${req.path} (${ms}ms)`, 'warn');
    }
  });
  next();
});

// ─── Static files ─────────────────────────────────────────────
const distPath   = path.join(__dirname, '../dist');
const publicPath = path.join(__dirname, '../public');
const staticPath = fs.existsSync(distPath) ? distPath : publicPath;
app.use(express.static(staticPath));

// ─── API routes ───────────────────────────────────────────────
app.use('/api/projects',  require('./routes/projects'));
app.use('/api/monitor',   require('./routes/monitor'));
app.use('/api/vercel',    require('./routes/vercel'));
app.use('/api/events',    require('./routes/events'));
app.use('/api/tools',     require('./routes/tools'));
app.use('/api/history',   require('./routes/history'));
app.use('/api/health',    require('./routes/health'));
app.use('/api/scanner',   require('./routes/scanner'));
app.use('/api/webhooks',  require('./routes/webhooks'));

// ─── Unknown API routes ───────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint bulunamadı' });
});

// ─── SPA fallback ─────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// ─── Global error handler ────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.log(`Unhandled error on ${req.method} ${req.path}: ${err.message}`, 'err');
  if (res.headersSent) return;
  res.status(500).json({ error: 'Sunucu hatası' });
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';

const server = app.listen(PORT, HOST, () => {
  logger.log(`Field Device v${pkg.version} başlatıldı — http://${HOST}:${PORT}`, 'ok');
  console.log(`\n  ┌─────────────────────────────────────────┐`);
  console.log(`  │  Sanayi Field Device  v${pkg.version.padEnd(12)}      │`);
  console.log(`  │  http://${HOST}:${PORT}                 │`);
  console.log(`  │  Ortam: ${(process.env.NODE_ENV || 'production').padEnd(13)}               │`);
  console.log(`  └─────────────────────────────────────────┘\n`);
  require('./workers/healthMonitor').start();
  require('./workers/watchdog').start();
  require('./workers/cleaner').start();
  require('./workers/updater').start();
});

// ─── Graceful shutdown ────────────────────────────────────────
function shutdown(signal) {
  logger.log(`${signal} alındı — sunucu kapatılıyor`, 'warn');
  server.close(() => {
    logger.log('Sunucu kapatıldı', 'ok');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.log(`Uncaught exception: ${err.message}`, 'err');
  console.error(err);
});

process.on('unhandledRejection', (reason) => {
  logger.log(`Unhandled rejection: ${String(reason).slice(0, 120)}`, 'warn');
});
