#!/usr/bin/env node
// Generates PNG icons without any external dependencies
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t   = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(size) {
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 2; // 8-bit RGB

  const rowLen = size * 3;
  const raw    = Buffer.alloc((rowLen + 1) * size);

  const BG = [10, 10, 10];
  const FG = [48, 209, 88];

  // Fill background
  for (let y = 0; y < size; y++) {
    raw[y * (rowLen + 1)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const o = y * (rowLen + 1) + 1 + x * 3;
      raw[o] = BG[0]; raw[o+1] = BG[1]; raw[o+2] = BG[2];
    }
  }

  // Draw ">_" as pixel art scaled to icon size
  const S  = size;
  const u  = Math.floor(S / 32); // unit pixel

  function px(x, y) {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const o = y * (rowLen + 1) + 1 + x * 3;
    raw[o] = FG[0]; raw[o+1] = FG[1]; raw[o+2] = FG[2];
  }

  function rect(x, y, w, h) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) px(x+dx, y+dy);
  }

  const ox = Math.floor(S * 0.18);
  const oy = Math.floor(S * 0.28);
  const t  = Math.max(1, u);

  // ">" character (chevron)
  const cw = Math.floor(S * 0.22);
  const ch = Math.floor(S * 0.44);
  for (let i = 0; i < Math.floor(ch / 2); i++) {
    const w = Math.floor((i / (ch / 2)) * cw);
    rect(ox, oy + i, w + t, t);
  }
  for (let i = 0; i < Math.floor(ch / 2); i++) {
    const w = Math.floor(((Math.floor(ch/2) - i) / (ch / 2)) * cw);
    rect(ox, oy + Math.floor(ch/2) + i, w + t, t);
  }

  // "_" underline
  const ux = ox + Math.floor(S * 0.28);
  const uy = oy + Math.floor(ch * 0.85);
  rect(ux, uy, Math.floor(S * 0.22), Math.max(2, t));

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([SIG, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, '../public/icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makePNG(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makePNG(512));
console.log('✓ icon-192.png and icon-512.png generated');
