export function fmtTime(s) {
  if (s < 60)   return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

export function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)  return diff + ' sn önce';
  const m = Math.floor(diff / 60);
  if (m < 60)     return m + ' dk önce';
  const h = Math.floor(m / 60);
  if (h < 24)     return h + ' saat önce';
  return Math.floor(h / 24) + ' gün önce';
}

export function svcKey(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('database') || n.includes('db'))      return 'database';
  if (n.includes('ai') || n.includes('model'))         return 'ai';
  if (n.includes('blob') || n.includes('storage'))     return 'blob';
  return 'api';
}
