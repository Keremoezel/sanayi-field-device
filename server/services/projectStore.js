const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/projects.json');

function read() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function write(projects) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));
}

module.exports = { read, write };
