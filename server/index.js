const express = require('express');
const path    = require('path');
const logger  = require('./services/logger');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/projects', require('./routes/projects'));
app.use('/api/monitor',  require('./routes/monitor'));
app.use('/api/tools',    require('./routes/tools'));
app.use('/api/history',  require('./routes/history'));
app.use('/api/health',   require('./routes/health'));

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  logger.log('Field Device başlatıldı', 'ok');
  console.log(`\n  Sanayi Field Device`);
  console.log(`  http://${HOST}:${PORT}\n`);
});
