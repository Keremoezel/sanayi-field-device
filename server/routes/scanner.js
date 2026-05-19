const router    = require('express').Router();
const multer    = require('multer');
const scanStore = require('../services/scan-store');
const logger    = require('../services/logger');

const MAX_MB = Number(process.env.MAX_UPLOAD_SIZE_MB) || 2;

// Bellek üzerinde tut — disk'e yazma (geçici buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Sadece görsel dosyaları kabul edilir'));
    }
    cb(null, true);
  },
});

// Rate limiting (basit in-memory)
const rateMap = new Map();
const RATE_LIMIT = Number(process.env.SCAN_RATE_LIMIT_PER_MIN) || 10;

function checkRate(ip) {
  const now   = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

// ─── POST /api/scanner/analyze ─────────────────────────────────
router.post('/analyze', upload.single('image'), async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Rate limit aşıldı. 1 dakika bekleyin.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Görsel dosyası gerekli (image/jpeg veya image/png)' });
  }

  const sanayiUrl = process.env.SANAYI_API_URL;
  if (!sanayiUrl) {
    return res.status(500).json({ error: 'SANAYI_API_URL env değişkeni tanımlı değil' });
  }

  const mode = req.body.mode || 'photo';

  try {
    // Sanayi backend'e multipart olarak ilet
    const { FormData, Blob } = await import('node:buffer').catch(() => {
      // Node 18 fallback
      return { FormData: global.FormData, Blob: global.Blob };
    });

    // Node 18'de native FormData var
    const form = new global.FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    form.append('file', blob, req.file.originalname || 'scan.jpg');
    form.append('mode', mode);

    const upstream = await fetch(`${sanayiUrl}/api/damage-analyses`, {
      method:  'POST',
      body:    form,
      headers: {
        'User-Agent':    'SanayiFieldDevice/1.0',
        ...(process.env.SANAYI_API_KEY
          ? { Authorization: `Bearer ${process.env.SANAYI_API_KEY}` }
          : {}),
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      logger.log(`Scanner proxy hata: HTTP ${upstream.status} ${errText.slice(0, 80)}`, 'err');
      return res.status(upstream.status).json({ error: `Sanayi API: HTTP ${upstream.status}` });
    }

    const data = await upstream.json();

    // Local'e kaydet
    const scan = scanStore.save({
      mode,
      severity:      data.severity      || null,
      maxConfidence: data.maxConfidence  || null,
      summary:       data.summary       || null,
      detections:    data.detections    || [],
      imageUrl:      data.imageUrl      || null,
      annotatedUrl:  data.annotatedImageUrl || null,
      scanId:        data.scanId        || null,
    });

    logger.log(`Scan analiz tamamlandı: #${scan.id} — ${data.severity || '?'} risk`, 'ok');
    res.json({ ...data, localId: scan.id });

  } catch (err) {
    logger.log(`Scanner hata: ${err.message}`, 'err');
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/scanner/history ──────────────────────────────────
router.get('/history', (req, res) => {
  const { mode, synced } = req.query;
  const filters = {};
  if (mode) filters.mode = mode;
  if (synced !== undefined) filters.synced = synced === 'true';
  res.json(scanStore.list(filters));
});

// ─── GET /api/scanner/stats ────────────────────────────────────
router.get('/stats', (req, res) => {
  res.json(scanStore.stats());
});

// ─── GET /api/scanner/:id ──────────────────────────────────────
router.get('/:id', (req, res) => {
  const scan = scanStore.get(req.params.id);
  if (!scan) return res.status(404).json({ error: 'Bulunamadı' });
  res.json(scan);
});

// ─── DELETE /api/scanner/:id ───────────────────────────────────
router.delete('/:id', (req, res) => {
  scanStore.remove(req.params.id);
  res.json({ ok: true });
});

// ─── POST /api/scanner/:id/sync ────────────────────────────────
router.post('/:id/sync', async (req, res) => {
  const scan = scanStore.get(req.params.id);
  if (!scan) return res.status(404).json({ error: 'Bulunamadı' });
  if (scan.synced) return res.json({ ok: true, note: 'Zaten senkronize edilmiş' });

  const sanayiUrl = process.env.SANAYI_API_URL;
  if (!sanayiUrl) return res.status(500).json({ error: 'SANAYI_API_URL eksik' });

  try {
    const r = await fetch(`${sanayiUrl}/api/devices/damage-scans`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':   'SanayiFieldDevice/1.0',
        ...(process.env.SANAYI_API_KEY
          ? { Authorization: `Bearer ${process.env.SANAYI_API_KEY}` }
          : {}),
      },
      body:   JSON.stringify({ localId: scan.id, ...scan }),
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) return res.status(r.status).json({ error: `Sync hata: HTTP ${r.status}` });

    const updated = scanStore.markSynced(scan.id);
    logger.log(`Scan #${scan.id} backend'e senkronize edildi`, 'ok');
    res.json({ ok: true, scan: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multer hata yönetimi
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Dosya çok büyük (max ${MAX_MB}MB)` });
  }
  res.status(400).json({ error: err.message });
});

module.exports = router;
