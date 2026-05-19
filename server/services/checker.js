const UA = 'SanayiFieldDevice/1.0';

async function ping(url, timeoutMs = 6000) {
  const start      = Date.now();
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method:   'HEAD',
      signal:   controller.signal,
      headers:  { 'User-Agent': UA },
      redirect: 'follow',
    });
    clearTimeout(timer);
    const ms     = Date.now() - start;
    const online = res.status < 500;
    return {
      online,
      status:    res.status,
      ms,
      errorType: online ? null : 'server_error',
      error:     online ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    clearTimeout(timer);
    const ms  = Date.now() - start;
    const msg = err.message || '';
    let errorType = 'unknown';
    if (err.name === 'AbortError')                              errorType = 'timeout';
    else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) errorType = 'dns';
    else if (msg.includes('ECONNREFUSED'))                      errorType = 'refused';
    else if (msg.includes('ECONNRESET'))                        errorType = 'reset';
    else if (msg.includes('certificate') || msg.includes('SSL')) errorType = 'ssl';

    return {
      online:    false,
      status:    null,
      ms,
      errorType,
      error:     err.name === 'AbortError' ? 'timeout' : msg,
    };
  }
}

module.exports = { ping };
