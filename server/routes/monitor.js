const router        = require('express').Router();
const healthMonitor = require('../workers/healthMonitor');

const CACHE_TTL = 8000;

// ─── GET /api/monitor/status ──────────────────────────────────
router.get('/status', async (req, res) => {
  const cache  = healthMonitor.getCache();
  const cacheTs = healthMonitor.getCacheTs();
  const fresh  = req.query.fresh === '1';

  if (!fresh && cache && (Date.now() - cacheTs) < CACHE_TTL) {
    return res.json(cache);
  }

  try { res.json(await healthMonitor.checkNow()); }
  catch { res.status(503).json({ error: 'Monitor kontrol başarısız' }); }
});

// ─── GET /api/monitor/history ─────────────────────────────────
router.get('/history', (req, res) => {
  const limit   = Math.min(Number(req.query.limit) || 50, 200);
  const history = healthMonitor.readHistory();
  res.json(history.slice(0, limit));
});

// ─── GET /api/monitor/stream (SSE — real-time status changes) ─
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const sendChange = (ev) =>
    res.write(`event: status-change\ndata: ${JSON.stringify(ev)}\n\n`);

  const sendCheck = (data) =>
    res.write(`event: checked\ndata: ${JSON.stringify({ checkedAt: data.checkedAt })}\n\n`);

  healthMonitor.emitter.on('status-change', sendChange);
  healthMonitor.emitter.on('checked',       sendCheck);
  const hb = setInterval(() => res.write(':keepalive\n\n'), 20000);

  req.on('close', () => {
    healthMonitor.emitter.off('status-change', sendChange);
    healthMonitor.emitter.off('checked',       sendCheck);
    clearInterval(hb);
  });
});

module.exports = router;
