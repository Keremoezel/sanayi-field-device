/**
 * Watchdog — monitors process memory and system resources every 2 minutes.
 * Logs uptime milestones and fires Termux alerts on high memory usage.
 */
const os     = require('os');
const logger = require('../services/logger');
const { notify } = require('../services/notifier');

const INTERVAL         = 2 * 60 * 1000;
const PROC_MEM_WARN_MB = 220;   // RSS threshold for this Node process
const SYS_MEM_WARN_PCT = 92;    // System-wide memory threshold %
const WARN_COOLDOWN_MS = 30 * 60 * 1000; // max one alert per 30min

let lastProcWarn = 0;
let lastSysWarn  = 0;
let timer        = null;

function check() {
  const now = Date.now();

  // ── Process memory ──────────────────────────────────────────
  const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
  if (rss > PROC_MEM_WARN_MB && (now - lastProcWarn) > WARN_COOLDOWN_MS) {
    logger.log(`Yüksek process belleği: ${rss}MB RSS`, 'warn');
    notify('⚠ Bellek Uyarısı', `Field Device ${rss}MB kullanıyor`, 'mem-proc');
    lastProcWarn = now;
  }

  // ── System memory ───────────────────────────────────────────
  const total   = os.totalmem();
  const free    = os.freemem();
  const usedPct = Math.round(((total - free) / total) * 100);
  if (usedPct > SYS_MEM_WARN_PCT && (now - lastSysWarn) > WARN_COOLDOWN_MS) {
    const usedMb  = Math.round((total - free) / 1024 / 1024);
    const totalMb = Math.round(total / 1024 / 1024);
    logger.log(`Sistem belleği %${usedPct} dolu (${usedMb}/${totalMb}MB)`, 'warn');
    notify('⚠ Sistem Belleği', `%${usedPct} kullanımda (${usedMb}MB/${totalMb}MB)`, 'mem-sys');
    lastSysWarn = now;
  }
}

function scheduleUptimeMilestones() {
  const MILESTONES = [
    { ms: 60 * 60 * 1000,       label: '1 saat' },
    { ms: 24 * 60 * 60 * 1000,  label: '1 gün'  },
    { ms: 7 * 24 * 60 * 60 * 1000, label: '1 hafta' },
  ];
  for (const { ms, label } of MILESTONES) {
    setTimeout(() => logger.log(`Field Device uptime: ${label}`, 'ok'), ms);
  }
}

function start() {
  scheduleUptimeMilestones();
  timer = setInterval(check, INTERVAL);
  logger.log('Watchdog başlatıldı (2dk kontrol, bellek/sistem izleme)', 'ok');
}

function stop() {
  if (timer) clearInterval(timer);
}

module.exports = { start, stop };
