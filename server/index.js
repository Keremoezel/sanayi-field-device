require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const logger  = require('./services/logger');

const app = express();
app.use(express.json());

// Serve dist/ after build, public/ in dev fallback
const distPath   = path.join(__dirname, '../dist');
const publicPath = path.join(__dirname, '../public');
const staticPath = fs.existsSync(distPath) ? distPath : publicPath;
app.use(express.static(staticPath));

app.use('/api/projects', require('./routes/projects'));
app.use('/api/monitor',  require('./routes/monitor'));
app.use('/api/vercel',   require('./routes/vercel'));
app.use('/api/events',   require('./routes/events'));
app.use('/api/tools',    require('./routes/tools'));
app.use('/api/history',  require('./routes/history'));
app.use('/api/health',   require('./routes/health'));
app.use('/api/scanner',  require('./routes/scanner'));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  logger.log('Field Device başlatıldı v1.0.0', 'ok');
  console.log(`\n  ┌─────────────────────────────────────┐`);
  console.log(`  │  Sanayi Field Device  v1.0.0        │`);
  console.log(`  │  http://${HOST}:${PORT}             │`);
  console.log(`  └─────────────────────────────────────┘\n`);
  require('./workers/updater').start();
});
