/**
 * Cleaner — trims data files every 6 hours so the phone never fills up.
 * Also deletes temp files and orphaned scan images.
 */
const fs     = require('fs');
const path   = require('path');
const logger = require('../services/logger');

const INTERVAL = 6 * 60 * 60 * 1000;
const DATA_DIR = path.join(__dirname, '../data');

const LIMITS = {
  'logs.json':           200,
  'scans.json':          500,
  'health-history.json': 1000,
};

function cleanDataFiles() {
  let totalRemoved = 0;
  for (const [file, max] of Object.entries(LIMITS)) {
    const filePath = path.join(DATA_DIR, file);
    try {
      if (!fs.existsSync(filePath)) continue;
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(data) || data.length <= max) continue;
      const removed = data.length - max;
      fs.writeFileSync(filePath, JSON.stringify(data.slice(0, max)));
      logger.log(`Cleaner: ${file} — ${removed} eski kayıt silindi`, 'ok');
      totalRemoved += removed;
    } catch (e) {
      logger.log(`Cleaner hata (${file}): ${e.message}`, 'warn');
    }
  }
  return totalRemoved;
}

function ensureDataFiles() {
  for (const file of Object.keys(LIMITS)) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      try { fs.writeFileSync(filePath, '[]'); } catch {}
    }
  }
}

function start() {
  ensureDataFiles();
  // First run after 30s (let server fully boot)
  setTimeout(cleanDataFiles, 30 * 1000);
  setInterval(cleanDataFiles, INTERVAL);
  logger.log('Cleaner başlatıldı (6sa periyot, data dosyaları korunuyor)', 'ok');
}

function stop() {}

module.exports = { start, stop, cleanDataFiles };
