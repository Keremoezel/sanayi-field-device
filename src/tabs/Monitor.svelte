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

  // ── Auto-refresh interval ──────────────────
  const INTERVALS = [10, 30, 60];
  let refreshInterval = Number(
    typeof localStorage !== 'undefined' ? (localStorage.getItem('fd_refresh') || 30) : 30
  );

  function setRefresh(s) {
    refreshInterval = s;
    if (typeof localStorage !== 'undefined') localStorage.setItem('fd_refresh', s);
    countdown = s;
  }

  // ── Notification permission ────────────────
  let notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

  async function requestNotif() {
    notifPerm = await Notification.requestPermission();
  }

  // ── Sparkline history ──────────────────────
  let sparkData = {};

  function getHistory(key) {
    try { return JSON.parse(localStorage.getItem('fd_spark_' + key) || '[]'); }
    catch { return []; }
  }

  function pushHistory(key, ms) {
    const h = getHistory(key);
    h.push(ms);
    if (h.length > 20) h.splice(0, h.length - 20);
    if (typeof localStorage !== 'undefined') localStorage.setItem('fd_spark_' + key, JSON.stringify(h));
    return h;
  }

  function sparkPath(values) {
    if (!values || values.length === 0) return '';
    if (values.length === 1) return `M2,11L58,11`;
    const w = 56, h = 22, max = Math.max(...values, 1);
    const pts = values.map((v, i) => {
      const x = 2 + (i / (values.length - 1)) * w;
      const y = h - (v / max) * (h - 4) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${pts.join('L')}`;
  }

  // ── Down state tracking for notifications ──
  const prevStatus = {};

  // ── Project CRUD state ─────────────────────
  let showCrudForm  = false;
  let editingId     = null;
  let formData      = emptyForm();

  function emptyForm() {
    return { id: '', name: '', url: '', healthPath: '/api/health', host: '', deployHook: '' };
  }

  function openAddForm() {
    editingId    = null;
    formData     = emptyForm();
    showCrudForm = true;
  }

  function openEditForm(p) {
    editingId    = p.id;
    formData     = { id: p.id, name: p.name, url: p.url, healthPath: p.healthPath || '/api/health', host: p.host || '', deployHook: p.deployHook || '' };
    showCrudForm = true;
  }

  async function saveProject() {
    if (!formData.id || !formData.name || !formData.url) return;
    const method = editingId ? 'PUT' : 'POST';
    const url    = editingId ? `/api/projects/${editingId}` : '/api/projects';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error); return; }
      showCrudForm = false;
      await load();
    } catch (e) { alert('Hata: ' + e.message); }
  }

  async function deleteProject(id) {
    if (!confirm('Bu projeyi silmek istediğinize emin misiniz?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    await load();
  }

  // ── Deploy trigger ─────────────────────────
  let deploying = {};

  async function triggerDeploy(id, name) {
    if (!confirm(`${name} için deploy tetiklensin mi?`)) return;
    deploying = { ...deploying, [id]: true };
    try {
      const res  = await fetch(`/api/vercel/redeploy/${id}`, { method: 'POST' });
      const data = await res.json();
      alert(res.ok ? data.note : data.error);
    } catch (e) { alert('Hata: ' + e.message); }
    deploying = { ...deploying, [id]: false };
  }

  // ── Load ───────────────────────────────────
  onMount(() => {
    load();
    timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) load();
    }, 1000);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('fd-refresh', load);

    // Pre-load sparkline history
    if (typeof localStorage !== 'undefined') {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('fd_spark_')) {
          const svc = key.replace('fd_spark_', '');
          try { sparkData[svc] = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        }
      }
      sparkData = { ...sparkData };
    }
  });

  onDestroy(() => {
    clearInterval(timer);
    window.removeEventListener('beforeinstallprompt', onInstallPrompt);
    window.removeEventListener('fd-refresh', load);
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
    countdown = refreshInterval;
    try {
      const data = await fetch('/api/monitor/status').then(r => r.json());
      const newSvcs = data.sanayi?.services || [];

      // Notification checks
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        newSvcs.forEach(s => {
          const k = svcKey(s.name);
          if (prevStatus[k] === true && s.online === false) {
            new Notification(`${s.name} offline`, { body: 'Servise erişilemiyor', icon: '/icon-192.png' });
          }
          prevStatus[k] = s.online;
        });
      } else {
        newSvcs.forEach(s => { prevStatus[svcKey(s.name)] = s.online; });
      }

      // Sparklines
      newSvcs.forEach(s => {
        if (s.ms != null) sparkData[svcKey(s.name)] = pushHistory(svcKey(s.name), s.ms);
      });
      sparkData = { ...sparkData };

      services = newSvcs;
      stats    = data.sanayi?.stats || {};
      projects = data.projects      || [];
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

  $: countdownPct = countdown / refreshInterval;
</script>

<!-- Summary banner -->
{#if services.length > 0}
  {@const onlineCount = services.filter(s => s.online === true).length}
  {@const total = services.length}
  <div class="summary-card">
    <div class="summary-pill {onlineCount === total ? 'green' : onlineCount === 0 ? 'red' : 'blue'}">
      <div>
        <div class="summary-num">{onlineCount}/{total}</div>
        <div class="summary-label">Servis Online</div>
      </div>
    </div>
    {#if stats.todayScans !== undefined}
      <div class="summary-pill blue">
        <div>
          <div class="summary-num">{stats.todayScans ?? '—'}</div>
          <div class="summary-label">Bugün Analiz</div>
        </div>
      </div>
    {/if}
    {#if stats.avgMs}
      <div class="summary-pill">
        <div>
          <div class="summary-num" style="font-size:16px">{stats.avgMs}ms</div>
          <div class="summary-label">Ort. Yanıt</div>
        </div>
      </div>
    {/if}
  </div>
{/if}

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

{#if typeof Notification !== 'undefined' && notifPerm === 'default'}
  <div class="notif-banner">
    <span>Servis düşünce bildirim al</span>
    <button class="notif-btn" on:click={requestNotif}>İzin Ver</button>
  </div>
{/if}

<div class="sec-row">
  <div class="sec" style="margin:0;flex:1">Sanayi Servisleri</div>
  <div class="refresh-sel">
    <span class="refresh-lbl">Yenile:</span>
    {#each INTERVALS as s}
      <button class="refresh-btn" class:active={refreshInterval === s} on:click={() => setRefresh(s)}>{s}s</button>
    {/each}
  </div>
</div>

<div class="svc-grid">
  {#each services as s}
    {@const ok  = s.online === true ? 'ok' : s.online === false ? 'down' : 'unknown'}
    {@const key = svcKey(s.name)}
    <div class="svc-card {ok}" data-svc={key} on:click={() => showServiceModal(s)} role="button" tabindex="0">
      <div class="svc-name">{s.name}</div>
      <div class="svc-val {ok}">{ok === 'ok' ? 'Online' : ok === 'down' ? 'Offline' : '—'}</div>
      <div class="svc-ms">{s.ms ? s.ms + 'ms' : (s.note || '')}</div>
      {#if sparkData[key]?.length >= 1}
        <svg class="svc-spark" width="60" height="22" viewBox="0 0 60 22">
          <path class="spark-line {ok}" d={sparkPath(sparkData[key])} />
        </svg>
      {/if}
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
      <div class="row" style="cursor:default">
        <div class="row-body" style="cursor:pointer" on:click={() => showProjectModal(p)} role="button" tabindex="0">
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
        <button class="row-edit-btn" on:click={() => openEditForm(p)} title="Düzenle">✎</button>
        <button class="row-edit-btn" style="color:var(--c-red)" on:click={() => deleteProject(p.id)} title="Sil">✕</button>
      </div>
    {/each}
  {/if}
</div>

<button class="action-btn action-btn-inline" style="width:100%;margin-top:8px" on:click={openAddForm}>
  <span style="color:var(--c-blue);font-size:16px">+</span>
  <span class="action-title">Proje Ekle</span>
</button>

{#if showCrudForm}
  <div class="crud-panel">
    <div class="crud-title">{editingId ? 'Projeyi Düzenle' : 'Yeni Proje'}</div>
    {#if !editingId}
      <input class="crud-input" bind:value={formData.id} placeholder="ID (slug, örn: sanayi)" />
    {/if}
    <input class="crud-input" bind:value={formData.name} placeholder="Proje adı" />
    <input class="crud-input" bind:value={formData.url} placeholder="URL (https://...)" type="url" />
    <input class="crud-input" bind:value={formData.healthPath} placeholder="Health path (örn: /api/health)" />
    <input class="crud-input" bind:value={formData.host} placeholder="Host etiket (örn: vercel, coolify)" />
    <input class="crud-input" bind:value={formData.deployHook} placeholder="Vercel Deploy Hook URL (opsiyonel)" type="url" />
    <div class="crud-btns">
      <button class="crud-btn-ok" on:click={saveProject}>Kaydet</button>
      <button class="crud-btn-cancel" on:click={() => showCrudForm = false}>İptal</button>
      {#if editingId}
        <button class="crud-btn-del" on:click={() => deleteProject(editingId)}>Sil</button>
      {/if}
    </div>
  </div>
{/if}

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
      {@const projectExists = projects.find(pr => pr.id === p.id || pr.name === p.name)}
      <div class="row">
        <div class="row-body" style="cursor:pointer" on:click={() => showDeployModal(p)} role="button" tabindex="0">
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
        {#if projectExists?.deployHook}
          <button
            class="deploy-trigger"
            disabled={deploying[projectExists.id]}
            on:click={() => triggerDeploy(projectExists.id, p.name)}
          >
            {deploying[projectExists.id] ? '...' : '▶ Deploy'}
          </button>
        {/if}
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
