const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({
    status:  'online',
    uptime:  Math.floor(process.uptime()),
    version: '0.2.0',
    node:    process.version,
    ts:      new Date().toISOString(),
  });
});

module.exports = router;
