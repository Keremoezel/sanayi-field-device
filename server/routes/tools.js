const router = require('express').Router();
const logger = require('../services/logger');

router.get('/logs', (req, res) => {
  res.json(logger.readLogs());
});

router.delete('/logs', (req, res) => {
  logger.clear();
  res.json({ ok: true });
});

router.post('/restart', (req, res) => {
  logger.log('Restart isteği alındı', 'warn');
  res.json({ ok: true, note: 'Termux\'ta npm start ile yeniden başlatın' });
  setTimeout(() => process.exit(0), 300);
});

module.exports = router;
