<script>
  import { onMount } from 'svelte';
  import { openModal, closeModal } from '../stores/modal.js';
  import { timeAgo } from '../lib/utils.js';

  let scans  = [];
  let filter = 'all';

  onMount(load);

  async function load() {
    try {
      scans = await fetch('/api/scanner/history').then(r => r.json());
    } catch {}
  }

  function setFilter(f, btn) {
    filter = f;
  }

  $: filtered = filter === 'synced' ? scans.filter(s => s.synced)
    : filter === 'local' ? scans.filter(s => !s.synced)
    : scans;

  const sColor = { low: 'tag green', medium: 'tag orange', high: 'tag red' };
  const sLbl   = { low: 'Düşük Risk', medium: 'Orta Risk', high: 'Yüksek Risk' };

  async function showScanModal(id) {
    openModal('Yükleniyor...', '<div class="spin"></div>');
    try {
      const s = await fetch('/api/scanner/' + id).then(r => r.json());
      if (s.error) return openModal('Hata', s.error);
      openModal(`Scan #${s.id}`, `
        ${s.annotatedUrl || s.imageUrl
          ? `<img src="${s.annotatedUrl || s.imageUrl}" style="width:100%;border-radius:var(--radius-sm);margin-bottom:12px">`
          : ''}
        <div class="modal-field"><div class="modal-key">Tarih</div>
          <div class="modal-val">${new Date(s.createdAt).toLocaleString('tr-TR')}</div>
        </div>
        <div class="modal-field"><div class="modal-key">Risk Seviyesi</div>
          <div class="modal-val">${s.severity || 'Bilinmiyor'}</div>
        </div>
        <div class="modal-field"><div class="modal-key">Özet</div>
          <div class="modal-val">${s.summary || '—'}</div>
        </div>
        ${!s.synced
          ? `<button class="scan-btn blue" style="width:100%;margin-top:12px" onclick="window._syncScan(${s.id})">📤 Backend'e Gönder</button>`
          : ''}
        <button class="scan-btn secondary" style="width:100%;margin-top:8px" onclick="window._deleteScan(${s.id})">🗑 Sil</button>
      `);
    } catch { openModal('Hata', 'Kayıt okunamadı'); }
  }

  // Modal action handlers exposed on window (modal body is raw HTML)
  if (typeof window !== 'undefined') {
    window._syncScan = async (id) => {
      const res = await fetch(`/api/scanner/${id}/sync`, { method: 'POST' }).then(r => r.json());
      if (res.error) alert(res.error);
      else { alert('Başarıyla senkronize edildi'); closeModal(); load(); }
    };
    window._deleteScan = async (id) => {
      if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
      await fetch('/api/scanner/' + id, { method: 'DELETE' });
      closeModal(); load();
    };
  }
</script>

<div class="ftabs">
  <button class="ftab" class:active={filter === 'all'}    on:click={() => setFilter('all')}>Tümü</button>
  <button class="ftab" class:active={filter === 'synced'} on:click={() => setFilter('synced')}>Gönderilenler</button>
  <button class="ftab" class:active={filter === 'local'}  on:click={() => setFilter('local')}>Bekleyenler</button>
</div>

{#if filtered.length === 0}
  <div class="empty">
    <div class="empty-icon">🗂</div>
    <div class="empty-title">Kayıt Bulunamadı</div>
    <div class="empty-sub">Bu filtrede gösterilecek tarama yok.</div>
  </div>
{:else}
  {#each filtered as s}
    <div class="scan-card" on:click={() => showScanModal(s.id)} role="button" tabindex="0">
      {#if s.annotatedUrl || s.imageUrl}
        <img src={s.annotatedUrl || s.imageUrl} class="scan-card-thumb" alt="scan" />
      {:else}
        <div class="scan-card-thumb">📷</div>
      {/if}
      <div class="scan-card-body">
        <div class="scan-card-top">
          <div class="scan-card-id">Scan #{s.id}</div>
          <div class="scan-card-time">{timeAgo(s.createdAt)}</div>
        </div>
        {#if s.summary}<div class="scan-card-summary">{s.summary}</div>{/if}
        <div class="tags">
          {#if s.severity}<span class={sColor[s.severity] || 'tag'}>{sLbl[s.severity] || s.severity}</span>{/if}
          {#if s.maxConfidence}<span class="tag">%{Math.round(s.maxConfidence * 100)} güven</span>{/if}
          {#if s.synced}
            <span class="tag blue">✓ Gönderildi</span>
          {:else}
            <span class="tag">Yerel</span>
          {/if}
        </div>
      </div>
    </div>
  {/each}
{/if}
