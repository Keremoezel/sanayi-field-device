const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');

const FILE = path.join(__dirname, '../data/scans.json');

function readScans() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeScans(scans) {
  fs.writeFileSync(FILE, JSON.stringify(scans, null, 2));
}

router.get('/', (req, res) => {
  res.json(readScans());
});

router.post('/', (req, res) => {
  const scans = readScans();
  const scan  = { id: scans.length + 1, createdAt: new Date().toISOString(), ...req.body };
  scans.unshift(scan);
  writeScans(scans);
  res.json(scan);
});

router.delete('/:id', (req, res) => {
  const scans = readScans().filter(s => String(s.id) !== req.params.id);
  writeScans(scans);
  res.json({ ok: true });
});

module.exports = router;
