const fs   = require('fs');
const path = require('path');

const FILE     = path.join(__dirname, '../data/scans.json');
const MAX_SCANS = 500;

function readScans() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function writeScans(scans) {
  fs.writeFileSync(FILE, JSON.stringify(scans, null, 2));
}

function save(scanData) {
  const scans = readScans();
  const id    = scans.length > 0 ? Math.max(...scans.map(s => s.id)) + 1 : 1;
  const scan  = {
    id,
    createdAt: new Date().toISOString(),
    synced: false,
    ...scanData,
  };
  scans.unshift(scan);
  if (scans.length > MAX_SCANS) scans.length = MAX_SCANS;
  writeScans(scans);
  return scan;
}

function list(filters = {}) {
  let scans = readScans();
  if (filters.mode)   scans = scans.filter(s => s.mode === filters.mode);
  if (filters.synced !== undefined) scans = scans.filter(s => s.synced === filters.synced);
  return scans;
}

function get(id) {
  return readScans().find(s => s.id === Number(id)) || null;
}

function remove(id) {
  const scans = readScans().filter(s => s.id !== Number(id));
  writeScans(scans);
}

function markSynced(id) {
  const scans = readScans();
  const scan  = scans.find(s => s.id === Number(id));
  if (scan) {
    scan.synced   = true;
    scan.syncedAt = new Date().toISOString();
    writeScans(scans);
    return scan;
  }
  return null;
}

function stats() {
  const scans = readScans();
  const today = new Date().toISOString().slice(0, 10);
  return {
    total:   scans.length,
    today:   scans.filter(s => s.createdAt.startsWith(today)).length,
    synced:  scans.filter(s => s.synced).length,
    pending: scans.filter(s => !s.synced).length,
  };
}

module.exports = { save, list, get, remove, markSynced, stats };
