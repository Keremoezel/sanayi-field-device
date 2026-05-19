<script>
  import { onMount } from 'svelte';
  import { fmtTime, timeAgo } from '../lib/utils.js';

  let info      = {};
  let pingState = { visible: false, ok: null, text: '' };
  let qrDataUrl = '';
  let qrUrl     = '';
  let netInfo   = {};
  let gitInfo   = {};
  let sysInfo   = {};

  // Command runner
  let cmdOutput  = '';
  let cmdError   = false;
  let cmdRunning = false;
  let lastCmd    = '';

  const COMMANDS = [
    { id: 'git-status',  label: 'git status',   icon: '📋' },
    { id: 'git-pull',    label: 'git pull',      icon: '⬇' },
    { id: 'git-log',     label: 'git log',       icon: '📜' },
    { id: 'git-branch',  label: 'branches',      icon: '🌿' },
    { id: 'git-diff',    label: 'diff --stat',   icon: '±'  },
    { id: 'git-stash',   label: 'stash list',    icon: '📌' },
    { id: 'npm-list',    label: 'npm list',      icon: '📦' },
    { id: 'node-v',      label: 'node -v',       icon: '🟩' },
    { id: 'disk',        label: 'disk usage',    icon: '💾' },
    { id: 'ps-node',     label: 'node procs',    icon: '⚙'  },
    { id: 'env-check',   label: 'env vars',      icon: '🔑' },
    { id: 'npm-v',       label: 'npm -v',        icon: '📦' },
  ];

  onMount(load);

  async function load() {
    await Promise.all([loadStatus(), loadQR(), loadNet(), loadGit(), loadSystem()]);
  }

  async function loadStatus() {
    try {
      const data = await fetch('/api/tools/status').then(r => r.json());
      info = {
        version: 'v' + data.version,
        uptime:  fmtTime(data.uptime),
        node:    data.node,
        memory:  data.memory + ' MB (RSS)',
        repo:    data.repo    || 'Bilinmiyor',
        commit:  data.commit  ? `${data.commit} (${timeAgo(new Date(data.commitAge))})` : '—',
        env:     data.env,
      };
    } catch {}
  }

  async function loadQR() {
    try {
      const qr = await fetch('/api/tools/qr').then(r => r.json());
      qrDataUrl = qr.dataUrl || '';
      qrUrl     = qr.url     || '';
    } catch {}
  }

  async function loadNet() {
    try {
      const net = await fetch('/api/tools/network').then(r => r.json());
      netInfo = net;
    } catch {}
  }

  async function loadGit() {
    try {
      gitInfo = await fetch('/api/tools/git').then(r => r.json());
    } catch {}
  }

  async function loadSystem() {
    try {
      sysInfo = await fetch('/api/tools/system').then(r => r.json());
    } catch {}
  }

  async function runCmd(id) {
    cmdRunning = true;
    cmdOutput  = '';
    cmdError   = false;
    lastCmd    = id;
    try {
      const res  = await fetch(`/api/tools/cmd/${id}`).then(r => r.json());
      cmdOutput  = res.output || '(çıktı yok)';
      cmdError   = res.error  || false;
    } catch (e) {
      cmdOutput = 'Hata: ' + e.message;
      cmdError  = true;
    }
    cmdRunning = false;
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(cmdOutput);
    } catch {}
  }

  async function pingNode(id) {
    pingState = { visible: true, ok: null, text: `Ping → ${id}...` };
    try {
      const d = await fetch(`/api/tools/ping/${id}`).then(r => r.json());
      if (d.online) pingState = { visible: true, ok: true,  text: `✓ ${d.name}\nHTTP ${d.status} · ${d.ms}ms\n${d.url}` };
      else          pingState = { visible: true, ok: false, text: `✗ ${d.name || id}\n${d.errorType || d.error || 'offline'} · ${d.ms}ms` };
    } catch { pingState = { visible: true, ok: false, text: '✗ Bağlantı hatası' }; }
  }

  async function pingAll() {
    pingState = { visible: true, ok: null, text: 'Ping ediliyor...' };
    try {
      const ids     = ['sanayi', 'zanzibar', 'local'];
      const results = await Promise.all(ids.map(id =>
        fetch(`/api/tools/ping/${id}`).then(r => r.json()).catch(() => ({ online: false, name: id, ms: 0 }))
      ));
      const lines = results.map(d => d.online ? `✓ ${d.name} · ${d.ms}ms` : `✗ ${d.name || '?'} · offline`);
      pingState   = { visible: true, ok: results.every(d => d.online), text: lines.join('\n') };
    } catch { pingState = { visible: true, ok: false, text: '✗ Bağlantı hatası' }; }
  }

  async function triggerUpdate() {
    if (!confirm('Güncelleme kontrolü başlatılsın mı?')) return;
    try {
      const res = await fetch('/api/tools/update', { method: 'POST' }).then(r => r.json());
      alert(res.note);
    } catch (e) { alert('Hata: ' + e.message); }
  }

  async function clearLogs() {
    if (!confirm('Yerel logları silmek istediğinize emin misiniz?')) return;
    await fetch('/api/tools/logs', { method: 'DELETE' });
    alert('Loglar temizlendi');
  }

  async function restartServer() {
    if (!confirm('Sunucuyu yeniden başlatmak istediğinize emin misiniz?')) return;
    await fetch('/api/tools/restart', { method: 'POST' });
    alert('Sunucu kapatılıyor, lütfen manuel yeniden başlatın.');
  }

  function copyURL() {
    const url = qrUrl || `http://${location.hostname}:8787`;
    navigator.clipboard.writeText(url).then(() => alert('Kopyalandı: ' + url)).catch(() => alert(url));
  }

  $: lanIfaces     = (netInfo.interfaces || []).filter(i => !i.internal);
  $: memPct        = sysInfo.memory?.percent || 0;
  $: gitStatusIcon = (gitInfo.modified > 0) ? '⚠' : '✓';
</script>

<!-- Address + QR -->
<div class="group" style="margin-bottom:16px">
  <div class="row">
    <div class="row-body">
      <div class="row-title">Cihaz Adresi</div>
      <div class="row-sub" style="font-family:var(--mono)">{qrUrl || (typeof location !== 'undefined' ? location.hostname : '—') + ':8787'}</div>
    </div>
    <button class="copy-btn" on:click={copyURL}>📋 Kopyala</button>
  </div>
  {#if qrDataUrl}
    <div class="qr-wrap">
      <img class="qr-img" src={qrDataUrl} alt="QR" />
      <div class="qr-url">{qrUrl}</div>
    </div>
  {/if}
</div>

<!-- Git Panel -->
<div class="sec">Git Durumu</div>
<div class="group" style="margin-bottom:16px">
  <div class="row">
    <div class="row-body">
      <div class="row-title">Branch</div>
    </div>
    <div class="row-right">
      <span class="tag blue" style="font-size:13px;padding:3px 12px">{gitInfo.branch || '—'}</span>
    </div>
  </div>
  <div class="row">
    <div class="row-body"><div class="row-title">Değişiklik</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px;color:{gitInfo.modified > 0 ? 'var(--c-yellow)' : 'var(--c-green)'}">
      {gitStatusIcon} {gitInfo.modified ?? '—'} dosya
    </div>
  </div>
  {#if gitInfo.ahead > 0 || gitInfo.behind > 0}
    <div class="row">
      <div class="row-body"><div class="row-title">Remote</div></div>
      <div class="row-right" style="display:flex;gap:8px">
        {#if gitInfo.ahead  > 0}<span class="tag green">↑ {gitInfo.ahead} ahead</span>{/if}
        {#if gitInfo.behind > 0}<span class="tag orange">↓ {gitInfo.behind} behind</span>{/if}
      </div>
    </div>
  {/if}
  {#if gitInfo.files?.length > 0}
    <div class="row" style="flex-direction:column;align-items:flex-start;gap:4px">
      <div class="row-title" style="margin-bottom:4px">Değişen Dosyalar</div>
      {#each gitInfo.files as f}
        <div class="git-file">{f}</div>
      {/each}
    </div>
  {/if}
  {#if gitInfo.log?.length > 0}
    <div class="row" style="flex-direction:column;align-items:flex-start;gap:4px">
      <div class="row-title" style="margin-bottom:4px">Son Commitler</div>
      {#each gitInfo.log as line}
        <div class="git-commit">{line}</div>
      {/each}
    </div>
  {/if}
</div>

<!-- Command Runner -->
<div class="sec">Komut Çalıştır</div>
<div class="cmd-grid">
  {#each COMMANDS.slice(0, 10) as c}
    <button
      class="cmd-btn"
      class:running={cmdRunning && lastCmd === c.id}
      class:active={!cmdRunning && lastCmd === c.id}
      on:click={() => runCmd(c.id)}
      disabled={cmdRunning}
    >
      <span class="cmd-icon">{c.icon}</span>
      <span class="cmd-label">{c.label}</span>
    </button>
  {/each}
</div>

{#if cmdOutput || cmdRunning}
  <div class="term-wrap">
    <div class="term-header">
      <span class="term-title">{lastCmd || '—'}</span>
      {#if cmdRunning}
        <span class="term-status">running...</span>
      {:else}
        <button class="term-copy" on:click={copyOutput}>⎘ kopyala</button>
      {/if}
    </div>
    <pre class="term-out" class:term-err={cmdError}>{cmdRunning ? '⠋ çalışıyor...' : cmdOutput}</pre>
  </div>
{/if}

<!-- System Stats -->
{#if sysInfo.memory}
  <div class="sec">Sistem Kaynakları</div>
  <div class="group" style="margin-bottom:16px">
    <div class="row" style="flex-direction:column;align-items:stretch;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="row-title">Bellek</div>
        <span style="font-family:var(--mono);font-size:12px;color:var(--c-t2)">
          {sysInfo.memory.used} / {sysInfo.memory.total} MB · %{sysInfo.memory.percent}
        </span>
      </div>
      <div class="mem-bar-bg">
        <div class="mem-bar" style="width:{memPct}%;background:{memPct > 85 ? 'var(--grad-orange)' : memPct > 60 ? 'var(--grad-blue)' : 'var(--grad-green)'}"></div>
      </div>
    </div>
    <div class="row">
      <div class="row-body"><div class="row-title">CPU Yük (1/5/15dk)</div></div>
      <div class="row-right" style="font-family:var(--mono);font-size:12px;color:var(--c-t2)">
        {sysInfo.cpu?.load1} / {sysInfo.cpu?.load5} / {sysInfo.cpu?.load15}
      </div>
    </div>
    <div class="row">
      <div class="row-body"><div class="row-title">CPU Çekirdek</div></div>
      <div class="row-right" style="font-family:var(--mono);font-size:12px;color:var(--c-t2)">{sysInfo.cpu?.cores} × {sysInfo.cpu?.model}</div>
    </div>
    <div class="row">
      <div class="row-body"><div class="row-title">OS Uptime</div></div>
      <div class="row-right" style="font-family:var(--mono);font-size:12px;color:var(--c-t2)">{fmtTime(sysInfo.osUptime || 0)}</div>
    </div>
  </div>
{/if}

<!-- Network -->
{#if lanIfaces.length > 0}
  <div class="sec">Ağ Bilgisi</div>
  <div class="group" style="margin-bottom:16px">
    <div class="row">
      <div class="row-body"><div class="row-title">Hostname</div></div>
      <div class="row-right net-addr">{netInfo.hostname || '—'}</div>
    </div>
    {#each lanIfaces as iface}
      <div class="row">
        <div class="row-body"><div class="row-title">{iface.name}</div></div>
        <div class="row-right net-addr">{iface.address}</div>
      </div>
    {/each}
  </div>
{/if}

<!-- Background Workers -->
<div class="sec">Arka Plan İşleri</div>
<div class="group" style="margin-bottom:16px">
  {#each [
    { name: 'Health Monitor', desc: '60s periyot — servis up/down takibi', icon: '💓' },
    { name: 'Watchdog',       desc: '2dk periyot — bellek + sistem izleme', icon: '🐕' },
    { name: 'Cleaner',        desc: '6sa periyot — eski log/scan temizliği', icon: '🧹' },
    { name: 'Auto-Updater',   desc: '5dk periyot — GitHub commit kontrolü',  icon: '🔄' },
  ] as w}
    <div class="row">
      <div class="row-icon" style="background:rgba(16,185,129,.08)">{w.icon}</div>
      <div class="row-body">
        <div class="row-title">{w.name}</div>
        <div class="row-sub">{w.desc}</div>
      </div>
      <span class="badge online"><div class="led green"></div> aktif</span>
    </div>
  {/each}
</div>

<!-- Webhook URLs -->
<div class="sec">Webhook URL'leri</div>
<div class="group" style="margin-bottom:16px">
  {#each ['github', 'vercel'] as src}
    {@const hookUrl = (qrUrl || (typeof location !== 'undefined' ? `http://${location.hostname}:8787` : '')) + `/api/webhooks/${src}`}
    <div class="row">
      <div class="row-body">
        <div class="row-title">{src === 'github' ? 'GitHub' : 'Vercel'} Hook</div>
        <div class="row-sub" style="font-family:var(--mono);font-size:10px;word-break:break-all">{hookUrl}</div>
      </div>
      <button class="copy-btn" on:click={() => navigator.clipboard?.writeText(hookUrl)}>📋</button>
    </div>
  {/each}
  <div class="row">
    <div class="row-body">
      <div class="row-title">GitHub Secret (opsiyonel)</div>
      <div class="row-sub">GITHUB_WEBHOOK_SECRET env değişkeni ile imza doğrulama</div>
    </div>
  </div>
</div>

<!-- Ping -->
<div class="sec">Hızlı Kontrol</div>
<div class="action-grid">
  <button class="action-btn" on:click={() => pingNode('sanayi')}>
    <div class="action-icon">🔵</div>
    <div class="action-title">Sanayi API</div>
    <div class="action-sub">vercel.app</div>
  </button>
  <button class="action-btn" on:click={() => pingNode('zanzibar')}>
    <div class="action-icon">🟢</div>
    <div class="action-title">Zanzibar</div>
    <div class="action-sub">coolify</div>
  </button>
  <button class="action-btn" on:click={() => pingNode('local')}>
    <div class="action-icon">🖥</div>
    <div class="action-title">Local Server</div>
    <div class="action-sub">localhost:8787</div>
  </button>
  <button class="action-btn" on:click={pingAll}>
    <div class="action-icon">⚡</div>
    <div class="action-title">Tümünü Ping</div>
    <div class="action-sub">hepsini kontrol et</div>
  </button>
</div>

{#if pingState.visible}
  <div class="ping-result" class:ok={pingState.ok === true} class:err={pingState.ok === false}>
    {pingState.text}
  </div>
{/if}

<!-- Server Info -->
<div class="sec">Server Bilgisi</div>
<div class="group">
  <div class="row">
    <div class="row-body"><div class="row-title">Versiyon</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px;color:var(--c-blue)">{info.version || '—'}</div>
  </div>
  <div class="row">
    <div class="row-body"><div class="row-title">Uptime</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px">{info.uptime || '—'}</div>
  </div>
  <div class="row">
    <div class="row-body"><div class="row-title">Node.js</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px;color:var(--c-t2)">{info.node || '—'}</div>
  </div>
  <div class="row">
    <div class="row-body"><div class="row-title">Bellek (RSS)</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px;color:var(--c-t2)">{info.memory || '—'}</div>
  </div>
  <div class="row">
    <div class="row-body">
      <div class="row-title">GitHub Repo</div>
      <div class="row-sub">{info.repo || '—'}</div>
    </div>
    <div class="row-right" style="font-family:var(--mono);font-size:11px;color:var(--c-t2)">{info.commit || '—'}</div>
  </div>
  <div class="row">
    <div class="row-body"><div class="row-title">Çevre (Env)</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px;color:var(--c-orange)">{info.env || '—'}</div>
  </div>
</div>

<!-- Management -->
<div class="sec">Yönetim</div>
<div class="group">
  <div class="row tap" on:click={triggerUpdate} role="button" tabindex="0">
    <div class="row-icon" style="background:rgba(52,217,136,.08)">🔃</div>
    <div class="row-body"><div class="row-title" style="color:var(--c-green)">Git Update Kontrolü</div></div>
  </div>
  <a class="row tap" href="/api/tools/logs/export" target="_blank">
    <div class="row-icon" style="background:rgba(79,142,247,.08)">📤</div>
    <div class="row-body"><div class="row-title" style="color:var(--c-blue)">Logları Dışa Aktar (JSON)</div></div>
  </a>
  <div class="row tap" on:click={clearLogs} role="button" tabindex="0">
    <div class="row-icon" style="background:rgba(255,204,0,.08)">🗑</div>
    <div class="row-body"><div class="row-title" style="color:var(--c-yellow)">Yerel Logları Temizle</div></div>
  </div>
  <div class="row tap" on:click={restartServer} role="button" tabindex="0">
    <div class="row-icon" style="background:rgba(255,91,91,.08)">🔄</div>
    <div class="row-body"><div class="row-title" style="color:var(--c-red)">Sunucuyu Yeniden Başlat</div></div>
  </div>
</div>
