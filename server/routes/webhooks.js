/**
 * Webhook receiver — accepts POST hooks from GitHub and Vercel,
 * stores them in memory, sends Termux notifications, and
 * streams new events to connected SSE clients.
 */
const router = require('express').Router();
const crypto = require('crypto');
const EventEmitter = require('events');
const logger = require('../services/logger');
const { notify } = require('../services/notifier');

const emitter   = new EventEmitter();
emitter.setMaxListeners(20);

const events    = [];
const MAX_EVENTS = 100;

function addEvent(ev) {
  events.unshift(ev);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  emitter.emit('webhook', ev);
  return ev;
}

// Optional HMAC verification for GitHub
function verifyGithub(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = req.headers['x-hub-signature-256'] || '';
  if (!sig) return false;
  try {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

// ─── POST /api/webhooks/github ────────────────────────────────
router.post('/github', (req, res) => {
  if (!verifyGithub(req)) return res.status(401).json({ error: 'Geçersiz imza' });

  const event  = req.headers['x-github-event'] || 'ping';
  const body   = req.body || {};
  const repo   = body.repository?.full_name || '?';
  const pusher = body.pusher?.name || body.sender?.login || '?';
  const branch = (body.ref || '').replace('refs/heads/', '') || '?';
  const commit = body.head_commit?.message?.split('\n')[0]?.slice(0, 80) || null;
  const compare = body.compare || null;

  const ev = { source: 'github', event, repo, pusher, branch, commit, compare, ts: Date.now() };
  addEvent(ev);
  logger.log(`GitHub ${event}: ${repo} (${branch})${commit ? ' — ' + commit : ''}`, 'ok');

  if (event === 'push') {
    notify(`📦 Push: ${repo}`, `${pusher} → ${branch}${commit ? ': ' + commit : ''}`, 'gh-push');
  } else if (event === 'pull_request') {
    const action = body.action;
    const title  = body.pull_request?.title?.slice(0, 60) || '';
    if (action === 'opened' || action === 'closed') {
      notify(`🔀 PR ${action}: ${repo}`, title, 'gh-pr');
    }
  } else if (event === 'workflow_run' && body.workflow_run?.conclusion === 'failure') {
    notify(`✗ CI Başarısız`, `${repo}: ${body.workflow_run.name}`, 'gh-ci');
  }

  res.json({ ok: true, event });
});

// ─── POST /api/webhooks/vercel ────────────────────────────────
router.post('/vercel', (req, res) => {
  const body  = req.body || {};
  const type  = body.type || 'deployment';
  const name  = body.payload?.name || body.name || '?';
  const state = body.payload?.deployment?.state || body.state || '?';
  const url   = body.payload?.deployment?.url   || null;

  const ev = { source: 'vercel', type, name, state, url, ts: Date.now() };
  addEvent(ev);
  logger.log(`Vercel ${type}: ${name} (${state})`, 'ok');

  if (state === 'READY'  || type === 'deployment.succeeded') {
    notify(`✓ Deploy: ${name}`, 'Vercel deploy başarılı', 'vcl-ok');
  } else if (state === 'ERROR' || type === 'deployment.error') {
    notify(`✗ Deploy Hata: ${name}`, 'Vercel deploy başarısız', 'vcl-err');
  } else if (state === 'BUILDING') {
    logger.log(`Vercel build başladı: ${name}`, 'ok');
  }

  res.json({ ok: true, type });
});

// ─── GET /api/webhooks/events ─────────────────────────────────
router.get('/events', (_req, res) => {
  res.json(events);
});

// ─── GET /api/webhooks/stream (SSE) ──────────────────────────
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (ev) => res.write(`event: webhook\ndata: ${JSON.stringify(ev)}\n\n`);
  emitter.on('webhook', send);
  const hb = setInterval(() => res.write(':keepalive\n\n'), 20000);

  req.on('close', () => {
    emitter.off('webhook', send);
    clearInterval(hb);
  });
});

module.exports = router;
