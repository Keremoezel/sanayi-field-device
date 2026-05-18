const { exec } = require('child_process');
const path     = require('path');
const logger   = require('../services/logger');

const ROOT        = path.join(__dirname, '../..');
const REPO        = process.env.GITHUB_REPO || 'Keremoezel/sanayi-field-device';
const BRANCH      = process.env.GITHUB_BRANCH || 'master';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 dakika

let lastKnownSHA = null;
let checking     = false;

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: ROOT, timeout: 30000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

async function getLocalSHA() {
  return run('git rev-parse HEAD');
}

async function getRemoteSHA() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
    { headers: { 'User-Agent': 'SanayiFieldDevice/0.2' }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  return data.sha;
}

async function applyUpdate() {
  logger.log('Güncelleme uygulanıyor...', 'warn');
  await run('git pull origin ' + BRANCH);

  // package.json değiştiyse npm install çalıştır
  const changed = await run('git diff HEAD@{1} HEAD --name-only').catch(() => '');
  if (changed.includes('package.json')) {
    logger.log('package.json değişti, npm install çalışıyor...', 'warn');
    await run('npm install --production');
  }

  logger.log('Güncelleme tamamlandı. Yeniden başlatılıyor...', 'ok');
  setTimeout(() => process.exit(0), 500);
}

async function checkForUpdate() {
  if (checking) return;
  checking = true;

  try {
    const remote = await getRemoteSHA();

    if (!lastKnownSHA) {
      lastKnownSHA = await getLocalSHA();
    }

    if (remote !== lastKnownSHA) {
      logger.log(`Yeni commit: ${remote.slice(0, 7)} → güncelleniyor`, 'ok');
      await applyUpdate();
    }
  } catch (err) {
    // Sessizce geç — bağlantı yok veya GitHub API limiti
  } finally {
    checking = false;
  }
}

function start() {
  // İlk kontrol 30s sonra (boot sırasında yük oluşmasın)
  setTimeout(checkForUpdate, 30 * 1000);
  setInterval(checkForUpdate, CHECK_INTERVAL);
  logger.log('Auto-updater başlatıldı (5dk kontrol)', 'ok');
}

module.exports = { start };
