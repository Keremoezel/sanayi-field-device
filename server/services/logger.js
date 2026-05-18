const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../data/logs.json');
const MAX_LOGS = 200;

function readLogs() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); }
  catch { return []; }
}

function log(msg, type = 'info') {
  const entry = { time: new Date().toLocaleTimeString('tr-TR'), msg, type, ts: Date.now() };
  const logs = readLogs();
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  try { fs.writeFileSync(LOG_FILE, JSON.stringify(logs)); } catch {}
  return entry;
}

function clear() {
  try { fs.writeFileSync(LOG_FILE, '[]'); } catch {}
}

module.exports = { log, readLogs, clear };
