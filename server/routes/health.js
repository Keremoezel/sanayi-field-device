const router = require('express').Router();
const pkg    = require('../../package.json');

router.get('/', (req, res) => {
  res.json({
    status:  'online',
    uptime:  Math.floor(process.uptime()),
    version: pkg.version,
    node:    process.version,
    ts:      new Date().toISOString(),
    memory:  Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

module.exports = router;
