<script>
  import { onMount, onDestroy } from 'svelte';
  import { openModal } from '../stores/modal.js';

  export let badge = 0;

  let allLogs    = { remote: [], local: [] };
  let srcFilter  = 'all';
  let typeFilter = 'all';
  let searchQuery = '';
  let sseConnected = false;
  let es = null;

  onMount(() => {
    load();
    connectSSE();
  });

  onDestroy(() => {
    if (es) es.close();
  });

  async function load() {
    try {
      const [remoteData, localData] = await Promise.all([
        fetch('/api/events').then(r => r.json()),
        fetch('/api/tools/logs').then(r => r.json()),
      ]);

      const normRemote = [];
      if (Array.isArray(remoteData)) {
        remoteData.forEach(p => {
          (p.events || []).forEach(e => {
            normRemote.push({
              _source: 'remote', _project: p.name,
              id: e.id || Math.random(), ts: e.ts,
              type: e.type, msg: e.action || 'Event',
              meta: [e.email, e.ip, e.meta?.message].filter(Boolean).join(' '),
              raw: e,
            });
          });
        });
      }

      allLogs.remote = normRemote;
      allLogs.local  = localData.map(l => normalizeLocal(l));
      allLogs = { ...allLogs };
      badge = 0;
    } catch {}
  }

  function normalizeLocal(l) {
    return {
      _source: 'local', _project: 'Field Device',
      id: l.ts + Math.random(), ts: l.ts,
      type: l.type === 'err' ? 'error' : l.type === 'ok' ? 'info' : l.type,
      msg: l.msg, meta: l.time, raw: l,
    };
  }

  function connectSSE() {
    if (es) { es.close(); es = null; }
    es = new EventSource('/api/tools/logs/stream');
    es.addEventListener('log', (e) => {
      try {
        const norm = normalizeLocal(JSON.parse(e.data));
        allLogs = { ...allLogs, local: [norm, ...allLogs.local].slice(0, 150) };
        sseConnected = true;
      } catch {}
    });
    es.onopen  = () => { sseConnected = true; };
    es.onerror = () => { sseConnected = false; };
  }

  $: combined = (() => {
    let list = [];
    if (srcFilter === 'all' || srcFilter === 'remote') list = list.concat(allLogs.remote);
    if (srcFilter === 'all' || srcFilter === 'device') list = list.concat(allLogs.local);
    if (typeFilter !== 'all') list = list.filter(l => l.type === typeFilter);
    return list.sort((a, b) => b.ts - a.ts);
  })();

  $: filtered = (() => {
    if (!searchQuery.trim()) return combined;
    const q = searchQuery.toLowerCase();
    return combined.filter(l =>
      l.msg.toLowerCase().includes(q) ||
      l._project.toLowerCase().includes(q) ||
      (l.meta && l.meta.toLowerCase().includes(q))
    );
  })();

  function rowClass(type) {
    if (type === 'error') return 'has-err';
    if (type === 'warn')  return 'has-warn';
    if (type === 'auth')  return 'has-auth';
    if (type === 'info' || type === 'ok') return 'has-info';
    return '';
  }

  function msgClass(type) {
    if (type === 'error') return 'err';
    if (type === 'warn')  return 'warn';
    if (type === 'auth')  return 'auth';
    if (type === 'info' || type === 'ok') return 'ok';
    return '';
  }

  function fmtTs(ts) {
    return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function copyLog(e, l) {
    e.stopPropagation();
    const text = `[${fmtTs(l.ts)}] [${l.type.toUpperCase()}] ${l.msg}${l.meta ? ' — ' + l.meta : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      const btn = e.currentTarget;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = '⎘'; }, 800);
    } catch {}
  }

  function showLogModal(l) {
    let rawStr = '';
    try { rawStr = JSON.stringify(l.raw, null, 2); } catch { rawStr = String(l.raw); }
    openModal('Log Detayı', `
      <div class="modal-field"><div class="modal-key">Proje</div><div class="modal-val">${l._project}</div></div>
      <div class="modal-field"><div class="modal-key">Tip</div><div class="modal-val">${l.type.toUpperCase()}</div></div>
      <div class="modal-field"><div class="modal-key">Mesaj</div><div class="modal-val">${l.msg}</div></div>
      <div class="modal-field">
        <div class="modal-key">Raw Payload</div>
        <div class="modal-code">${rawStr.replace(/</g, '&lt;')}</div>
      </div>
    `);
  }
</script>

<div class="ftabs">
  <button class="ftab" class:active={srcFilter === 'all'}    on:click={() => srcFilter = 'all'}>Tümü</button>
  <button class="ftab" class:active={srcFilter === 'device'} on:click={() => srcFilter = 'device'}>Device</button>
  <button class="ftab" class:active={srcFilter === 'remote'} on:click={() => srcFilter = 'remote'}>Remote</button>
  <span style="margin-left:auto;display:flex;align-items:center;font-size:10px;color:var(--c-t3)">
    <span class="sse-dot" class:live={sseConnected}></span>
    {sseConnected ? 'Live' : 'Polling'}
  </span>
</div>

<div class="ftabs">
  <button class="ftab" class:active={typeFilter === 'all'}   on:click={() => typeFilter = 'all'}>Tümü</button>
  <button class="ftab" class:active={typeFilter === 'auth'}  on:click={() => typeFilter = 'auth'}>Auth</button>
  <button class="ftab" class:active={typeFilter === 'error'} on:click={() => typeFilter = 'error'}>Error</button>
  <button class="ftab" class:active={typeFilter === 'warn'}  on:click={() => typeFilter = 'warn'}>Warn</button>
  <button class="ftab" class:active={typeFilter === 'info'}  on:click={() => typeFilter = 'info'}>Info</button>
</div>

<div class="search-wrap">
  <span class="search-icon">🔍</span>
  <input
    class="search-input"
    bind:value={searchQuery}
    placeholder="Loglarda ara..."
    type="search"
  />
</div>

<div class="group" style="margin-bottom:12px">
  {#if filtered.length === 0}
    <div class="log-row">
      <div class="log-body"><div class="log-msg" style="color:var(--c-t3)">
        {searchQuery ? 'Arama sonucu bulunamadı.' : 'Bu filtrede log yok.'}
      </div></div>
    </div>
  {:else}
    {#each filtered as l (l.id)}
      <div
        class="log-row {rowClass(l.type)}"
        on:click={() => showLogModal(l)}
        role="button" tabindex="0"
      >
        <div class="log-time">{fmtTs(l.ts)}</div>
        <div class="log-body">
          <div class="log-msg {msgClass(l.type)}">{l.msg}</div>
          <div class="log-meta">{l._project}{l.meta ? ' · ' + l.meta : ''}</div>
        </div>
        <span class="tag">{l.type}</span>
        <button class="log-copy" on:click={(e) => copyLog(e, l)} title="Kopyala">⎘</button>
      </div>
    {/each}
  {/if}
</div>

<button class="action-btn action-btn-inline" style="width:100%" on:click={load}>
  <span style="color:var(--c-blue)">↻</span>
  <span class="action-title">Logları Yenile</span>
</button>
