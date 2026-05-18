const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({
    status: 'online',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

module.exports = router;
