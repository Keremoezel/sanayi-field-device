async function ping(url, timeoutMs = 6000) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'SanayiFieldDevice/0.1' },
    });
    clearTimeout(timer);
    return {
      online: res.status < 500,
      status: res.status,
      ms: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      online: false,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      ms: Date.now() - start,
    };
  }
}

module.exports = { ping };
