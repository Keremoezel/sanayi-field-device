<script>
  import { onMount, onDestroy } from 'svelte';
  import { openModal } from '../stores/modal.js';
  import { timeAgo, svcKey } from '../lib/utils.js';

  let services  = [];
  let stats     = {};
  let projects  = [];
  let vercel    = [];
  let countdown = 30;
  let timer;

  let deferredPrompt = null;
  let showInstall    = false;

  onMount(() => {
    load();
    timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) load();
    }, 1000);

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
  });

  onDestroy(() => {
    clearInterval(timer);
    window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  });

  function onInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstall    = true;
  }

  async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') showInstall = false;
  }

  async function load() {
    countdown = 30;
    try {
      const data = await fetch('/api/monitor/status').then(r => r.json());
      services = data.sanayi?.services || [];
      stats    = data.sanayi?.stats    || {};
      projects = data.projects         || [];
    } catch {}
    try {
      const v = await fetch('/api/vercel/projects').then(r => r.json());
      vercel = Array.isArray(v) ? v : [];
    } catch {}
  }

  const stateColor = { READY: 'deploy-ready', ERROR: 'deploy-error', BUILDING: 'deploy-building', CANCELED: 'deploy-canceled' };
  const stateLbl   = { READY: '✓ Hazır', ERROR: '✗ Hata', BUILDING: '⟳ Derleniyor', CANCELED: 'İptal' };

  function showServiceModal(s) {
    const ok = s.online === true ? 'ok' : s.online === false ? 'down' : 'unknown';
    openModal(`Servis: ${s.name}`, `
      <div class="modal-field"><div class="modal-key">Durum</div>
        <div class="modal-val ${ok === 'ok' ? 'deploy-ready' : 'deploy-error'}">${ok.toUpperCase()}</div>
      </div>
      <div class="modal-field"><div class="modal-key">Yanıt Süresi</div>
        <div class="modal-val">${s.ms ? s.ms + 'ms' : '—'}</div>
      </div>
    `);
  }

  function showProjectModal(p) {
    openModal(p.name, `
      <div class="modal-field"><div class="modal-key">URL</div>
        <div class="modal-val"><a href="${p.url}" target="_blank" style="color:var(--c-blue)">${p.url}</a></div>
      </div>
      <div class="modal-field"><div class="modal-key">Durum</div>
        <div class="modal-val">${p.online ? 'Online' : 'Offline'} (${p.ms}ms)</div>
      </div>
    `);
  }

  function showDeployModal(p) {
    const d = p.lastDeploy;
    const ago = d ? timeAgo(d.createdAt) : '—';
    openModal(`Deploy: ${p.name}`, `
      <div class="modal-field"><div class="modal-key">Durum</div><div class="modal-val">${d?.state || '—'}</div></div>
      <div class="modal-field"><div class="modal-key">Zaman</div><div class="modal-val">${ago}</div></div>
      <div class="modal-field"><div class="modal-key">Commit</div><div class="modal-val">${d?.commit || '—'}</div></div>
      <div class="modal-field"><div class="modal-key">Author</div><div class="modal-val">${d?.author || '—'}</div></div>
    `);
  }

  $: countdownPct = countdown / 30;
</script>

{#if showInstall}
  <div id="installBanner" class="show">
    <div class="install-text">
      Ana ekrana ekle
      <small>Uygulama gibi tam ekran kullanın</small>
    </div>
    <button class="install-ok" on:click={installPWA}>Ekle</button>
    <button class="install-x" on:click={() => showInstall = false}>×</button>
  </div>
{/if}

<div class="sec">Sanayi Servisleri</div>
<div class="svc-grid">
  {#each services as s}
    {@const ok = s.online === true ? 'ok' : s.online === false ? 'down' : 'unknown'}
    <div class="svc-card {ok}" data-svc={svcKey(s.name)} on:click={() => showServiceModal(s)} role="button" tabindex="0">
      <div class="svc-name">{s.name}</div>
      <div class="svc-val {ok}">{ok === 'ok' ? 'Online' : ok === 'down' ? 'Offline' : '—'}</div>
      <div class="svc-ms">{s.ms ? s.ms + 'ms' : (s.note || '')}</div>
    </div>
  {/each}
</div>

<div class="sec">Ortam Bilgisi (Sanayi)</div>
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-label">Environment</div>
    <div class="stat-value blue">{stats.environment || '—'}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Versiyon</div>
    <div class="stat-value">{stats.version || '—'}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Bugünkü Analiz</div>
    <div class="stat-value">{stats.todayScans ?? '—'}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Ort. Yanıt</div>
    <div class="stat-value">{stats.avgMs ? stats.avgMs + 'ms' : '—'}</div>
  </div>
</div>

<div class="sec">Projelerim</div>
<div class="group">
  {#if projects.length === 0}
    <div class="row">
      <div class="row-body"><div class="row-title" style="color:var(--c-t3)">Yükleniyor...</div></div>
      <div class="spin"></div>
    </div>
  {:else}
    {#each projects as p}
      <div class="row tap" on:click={() => showProjectModal(p)} role="button" tabindex="0">
        <div class="row-body">
          <div class="row-title">{p.name}</div>
          <div class="tags" style="margin-top:5px">
            {#if p.host}<span class="tag">{p.host}</span>{/if}
            {#if p.ms}
              <span class="tag {p.ms < 500 ? 'green' : p.ms < 1500 ? 'yellow' : 'orange'}">{p.ms}ms</span>
            {/if}
          </div>
        </div>
        <div class="badge {p.online ? 'online' : 'offline'}">
          <div class="led {p.online ? 'green' : 'red'}"></div>
          {p.online ? 'online' : 'offline'}
        </div>
      </div>
    {/each}
  {/if}
</div>

<div class="sec">Vercel Deploylar</div>
<div class="group">
  {#if vercel.length === 0}
    <div class="row">
      <div class="row-body"><div class="row-title" style="color:var(--c-t3)">Yükleniyor...</div></div>
      <div class="spin"></div>
    </div>
  {:else}
    {#each vercel as p}
      {@const d   = p.lastDeploy}
      {@const st  = d?.state || 'UNKNOWN'}
      {@const ago = d ? timeAgo(d.createdAt) : '—'}
      <div class="row tap" on:click={() => showDeployModal(p)} role="button" tabindex="0">
        <div class="row-body">
          <div class="row-title">{p.name}</div>
          {#if d?.commit}<div class="row-sub" style="margin-top:3px">"{d.commit}"</div>{/if}
          <div class="tags" style="margin-top:5px">
            {#if d?.branch}<span class="tag">{d.branch}</span>{/if}
            {#if ago !== '—'}<span class="tag">{ago}</span>{/if}
          </div>
        </div>
        <div class="badge {stateColor[st] || 'deploy-canceled'}" style="flex-shrink:0">
          {stateLbl[st] || st}
        </div>
      </div>
    {/each}
  {/if}
</div>

<div style="margin-top:16px">
  <button class="action-btn action-btn-inline" style="width:100%" on:click={load}>
    <span style="color:var(--c-blue);font-size:16px">↻</span>
    <span class="action-title">Hemen Yenile</span>
  </button>
</div>
<div class="countdown-wrap">
  <div class="countdown-bar" style="transform: scaleX({countdownPct})"></div>
</div>
