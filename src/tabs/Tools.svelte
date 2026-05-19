<script>
  import { onMount } from 'svelte';
  import { fmtTime, timeAgo } from '../lib/utils.js';

  let info      = {};
  let pingState = { visible: false, ok: null, text: '' };
  let qrDataUrl = '';
  let qrUrl     = '';
  let netInfo   = {};

  onMount(load);

  async function load() {
    try {
      const data = await fetch('/api/tools/status').then(r => r.json());
      info = {
        version: 'v' + data.version,
        uptime:  fmtTime(data.uptime),
        node:    data.node,
        memory:  data.memory + ' MB',
        repo:    data.repo    || 'Bilinmiyor',
        commit:  data.commit  ? `${data.commit} (${timeAgo(new Date(data.commitAge))})` : '—',
        env:     data.env,
      };
    } catch {}

    try {
      const qr = await fetch('/api/tools/qr').then(r => r.json());
      qrDataUrl = qr.dataUrl || '';
      qrUrl     = qr.url     || '';
    } catch {}

    try {
      const net = await fetch('/api/tools/network').then(r => r.json());
      netInfo = net;
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
    pingState = { visible: true, ok: null, text: 'Tüm node\'lar ping ediliyor...' };
    try {
      const ids = ['sanayi', 'zanzibar', 'local'];
      const results = await Promise.all(ids.map(id => fetch(`/api/tools/ping/${id}`).then(r => r.json()).catch(() => ({ online: false, name: id, ms: 0 }))));
      const lines = results.map(d => d.online ? `✓ ${d.name} · ${d.ms}ms` : `✗ ${d.name || '?'} · offline`);
      const allOk = results.every(d => d.online);
      pingState = { visible: true, ok: allOk, text: lines.join('\n') };
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

  $: lanIfaces = (netInfo.interfaces || []).filter(i => !i.internal);
</script>

<div class="group" style="margin-bottom:16px">
  <div class="row">
    <div class="row-body">
      <div class="row-title">Cihaz Adresi</div>
      <div class="row-sub" style="font-family:var(--mono)">{qrUrl || (typeof location !== 'undefined' ? location.hostname : '—') + ':8787'}</div>
    </div>
    <button class="copy-btn" on:click={copyURL}>📋 Kopyala</button>
  </div>
</div>

<!-- QR Code -->
{#if qrDataUrl}
  <div class="sec">QR Kod</div>
  <div class="group" style="margin-bottom:16px">
    <div class="qr-wrap">
      <img class="qr-img" src={qrDataUrl} alt="QR Kod" />
      <div class="qr-url">{qrUrl}</div>
    </div>
  </div>
{/if}

<!-- Network Info -->
{#if lanIfaces.length > 0}
  <div class="sec">Ağ Bilgisi</div>
  <div class="group" style="margin-bottom:16px">
    <div class="row">
      <div class="row-body"><div class="row-title">Hostname</div></div>
      <div class="row-right net-addr">{netInfo.hostname || '—'}</div>
    </div>
    {#each lanIfaces as iface}
      <div class="row">
        <div class="row-body">
          <div class="row-title">{iface.name}</div>
          <div class="row-sub">{netInfo.platform} · {netInfo.arch}</div>
        </div>
        <div class="row-right net-addr">{iface.address}</div>
      </div>
    {/each}
    <div class="row">
      <div class="row-body"><div class="row-title">Port</div></div>
      <div class="row-right" style="font-family:var(--mono);color:var(--c-blue)">{netInfo.port || 8787}</div>
    </div>
  </div>
{/if}

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

<div class="sec">Server Bilgisi</div>
<div class="group">
  <div class="row">
    <div class="row-body"><div class="row-title">Versiyon</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px;color:var(--c-blue)">{info.version || '—'}</div>
  </div>
  <div class="row">
    <div class="row-body"><div class="row-title">Uptime</div></div>
    <div class="row-right" style="font-family:var(--mono);font-size:13px;color:var(--c-t1)">{info.uptime || '—'}</div>
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
