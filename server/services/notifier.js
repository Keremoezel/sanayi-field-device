const { execFile } = require('child_process');
const logger       = require('./logger');

let termuxAvailable = null;

function checkTermux() {
  if (termuxAvailable !== null) return Promise.resolve(termuxAvailable);
  return new Promise((resolve) => {
    execFile('which', ['termux-notification'], (err) => {
      termuxAvailable = !err;
      resolve(termuxAvailable);
    });
  });
}

function notify(title, content, id = 'field-device') {
  return checkTermux().then((available) => {
    if (!available) return;
    // execFile avoids shell interpretation — no injection possible
    execFile('termux-notification', [
      '--title',    title,
      '--content',  content,
      '--id',       String(id),
      '--priority', 'high',
    ], (err) => {
      if (err) logger.log('Bildirim gönderilemedi: ' + err.message, 'warn');
    });
  });
}

function notifyDown(projectName) {
  logger.log(`Bildirim: ${projectName} down`, 'warn');
  return notify(`⚠ ${projectName} erişilemez`, 'Proje yanıt vermiyor — kontrol et', projectName);
}

function notifyRecovered(projectName) {
  logger.log(`Bildirim: ${projectName} recovered`, 'ok');
  return notify(`✓ ${projectName} geri döndü`, 'Proje tekrar online', projectName);
}

function notifyUpdate(sha) {
  return notify('🔄 Field Device güncellendi', `Yeni versiyon: ${sha.slice(0, 7)}`, 'update');
}

module.exports = { notify, notifyDown, notifyRecovered, notifyUpdate };
