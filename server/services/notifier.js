const { exec } = require('child_process');
const logger   = require('./logger');

// Termux:API kurulu mu kontrol et
let termuxAvailable = null;

function checkTermux() {
  if (termuxAvailable !== null) return Promise.resolve(termuxAvailable);
  return new Promise((resolve) => {
    exec('which termux-notification', (err) => {
      termuxAvailable = !err;
      resolve(termuxAvailable);
    });
  });
}

async function notify(title, content, id = 'field-device') {
  const available = await checkTermux();
  if (!available) return;

  const safeTitle   = title.replace(/'/g, '');
  const safeContent = content.replace(/'/g, '');

  exec(
    `termux-notification --title '${safeTitle}' --content '${safeContent}' --id '${id}' --priority high`,
    (err) => { if (err) logger.log('Bildirim gönderilemedi: ' + err.message, 'warn'); }
  );
}

async function notifyDown(projectName) {
  await notify(`⚠ ${projectName} erişilemez`, `Proje yanıt vermiyor — kontrol et`, projectName);
  logger.log(`Bildirim: ${projectName} down`, 'warn');
}

async function notifyRecovered(projectName) {
  await notify(`✓ ${projectName} geri döndü`, `Proje tekrar online`, projectName);
  logger.log(`Bildirim: ${projectName} recovered`, 'ok');
}

async function notifyUpdate(sha) {
  await notify('🔄 Field Device güncellendi', `Yeni versiyon: ${sha.slice(0, 7)}`, 'update');
}

module.exports = { notify, notifyDown, notifyRecovered, notifyUpdate };
