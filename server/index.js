require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path    = require('path');
const logger  = require('./services/logger');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/projects', require('./routes/projects'));
app.use('/api/monitor',  require('./routes/monitor'));
app.use('/api/vercel',   require('./routes/vercel'));
app.use('/api/events',   require('./routes/events'));
app.use('/api/tools',    require('./routes/tools'));
app.use('/api/history',  require('./routes/history'));
app.use('/api/health',   require('./routes/health'));

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  logger.log('Field Device başlatıldı v0.3.0', 'ok');
  console.log(`\n  Sanayi Field Device v0.3.0`);
  console.log(`  http://${HOST}:${PORT}\n`);

  // Auto-updater başlat
  require('./workers/updater').start();
});
