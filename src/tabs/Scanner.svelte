<script>
  import { onDestroy } from 'svelte';

  let stream      = null;
  let video;
  let canvas;
  let ctx;

  let cameraActive  = false;
  let analyzing     = false;
  let scanResult    = null;
  let currentScanData = null;
  let btnSaveDone   = false;
  let btnSendState  = 'idle'; // idle | sending | done

  onDestroy(() => stopCamera());

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } }
      });
      video.srcObject = stream;
      ctx = canvas.getContext('2d');
      cameraActive  = true;
      scanResult    = null;
      btnSaveDone   = false;
      btnSendState  = 'idle';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (err) { alert('Kamera açılamadı: ' + err.message); }
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); }
    stream = null;
    cameraActive = false;
    scanResult   = null;
  }

  function captureAndAnalyze() {
    if (!stream) return;
    analyzing = true;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('image', blob, 'scan.jpg');
      formData.append('mode', 'photo');
      try {
        const res  = await fetch('/api/scanner/analyze', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) showResult(data);
        else alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
      } catch (err) {
        alert('Bağlantı hatası: ' + err.message);
      } finally { analyzing = false; }
    }, 'image/jpeg', 0.8);
  }

  function showResult(data) {
    currentScanData = data;
    scanResult = {
      time:          new Date().toLocaleTimeString('tr-TR'),
      severity:      data.severity || 'low',
      confidence:    Math.round((data.maxConfidence || 0) * 100),
    };
    btnSaveDone  = false;
    btnSendState = 'idle';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (data.detections?.length) {
      const color = data.severity === 'high' ? '#ff5b5b'
        : data.severity === 'medium' ? '#ff8c42' : '#ffcc00';
      data.detections.forEach(d => {
        if (!d.box) return;
        ctx.strokeStyle = color; ctx.lineWidth = 4;
        ctx.strokeRect(d.box.x, d.box.y, d.box.width, d.box.height);
        ctx.fillStyle = color; ctx.font = '16px Inter';
        ctx.fillText(`${Math.round(d.confidence * 100)}%`,
          d.box.x, d.box.y > 20 ? d.box.y - 5 : d.box.y + 20);
      });
    }
  }

  async function saveScanLocal() {
    if (!currentScanData) return;
    btnSaveDone = true;
    alert(`Tarama yerel olarak kaydedildi (ID: ${currentScanData.localId})`);
  }

  async function sendScanSanayi() {
    if (!currentScanData?.localId) return;
    btnSendState = 'sending';
    try {
      const res = await fetch(`/api/scanner/${currentScanData.localId}/sync`, { method: 'POST' }).then(r => r.json());
      if (res.error) { alert(res.error); btnSendState = 'idle'; }
      else             btnSendState = 'done';
    } catch { alert('Hata'); btnSendState = 'idle'; }
  }

  $: severityClass = scanResult
    ? (scanResult.severity === 'high' ? 'red' : scanResult.severity === 'medium' ? 'orange' : 'green')
    : '';
</script>

<div class="sec">Live Damage Scanner</div>
<div class="card">
  <div class="scanner-wrap">
    <!-- svelte-ignore a11y-media-has-caption -->
    <video bind:this={video} class="scanner-video" autoplay playsinline muted></video>
    <canvas bind:this={canvas} class="scanner-canvas"></canvas>
    <div class="scanner-overlay">
      <div class="scanner-corner tl"></div>
      <div class="scanner-corner tr"></div>
      <div class="scanner-corner bl"></div>
      <div class="scanner-corner br"></div>
    </div>
    {#if !cameraActive}
      <div class="scanner-placeholder">
        <div class="scanner-icon">📷</div>
        <div class="scanner-label">Kamera Kapalı</div>
        <div class="scanner-hint">Hasar taraması için kamerayı açın</div>
      </div>
    {/if}
  </div>
</div>

{#if !cameraActive}
  <div class="scan-btn-row">
    <button class="scan-btn blue" on:click={startCamera}>Kamerayı Aç</button>
  </div>
{:else}
  <div class="scan-btn-row">
    <button class="scan-btn primary" disabled={analyzing} on:click={captureAndAnalyze}>
      {analyzing ? '⏳ Analiz Ediliyor...' : '📸 Fotoğraf Çek & Analiz Et'}
    </button>
    <button class="scan-btn secondary" on:click={stopCamera}>Kapat</button>
  </div>
{/if}

{#if scanResult}
  <div class="scan-result-bar">
    <div>
      <span class="scan-result-label">Son Analiz:</span>
      <span class="scan-result-time">{scanResult.time}</span>
    </div>
    <span class="tag {severityClass}">
      {scanResult.severity.toUpperCase()} RİSK (%{scanResult.confidence})
    </span>
  </div>
  <div class="scan-btn-row">
    <button class="scan-btn secondary" disabled={btnSaveDone} on:click={saveScanLocal}>
      {btnSaveDone ? '✓ Kaydedildi' : '💾 Yerel Kaydet'}
    </button>
    <button class="scan-btn blue" disabled={btnSendState !== 'idle'} on:click={sendScanSanayi}>
      {btnSendState === 'sending' ? 'Gönderiliyor...' : btnSendState === 'done' ? '✓ Gönderildi' : "📤 Sanayi'ye Gönder"}
    </button>
  </div>
{/if}

<div class="sec" style="margin-top:24px">Yol Haritası</div>
<div class="group" style="padding:4px 16px">
  <div class="roadmap-step"><div class="step-dot done"></div><div class="step-text"><b>Faz 0-1</b> — Altyapı, API, Monitör UI</div></div>
  <div class="roadmap-step"><div class="step-dot done"></div><div class="step-text"><b>Faz 2</b> — Fotoğraf çek → AI'ya gönder</div></div>
  <div class="roadmap-step"><div class="step-dot current"></div><div class="step-text"><b>Faz 3</b> — Backend Senkronizasyonu</div></div>
  <div class="roadmap-step"><div class="step-dot todo"></div><div class="step-text"><b>Faz 4</b> — Canlı periyodik analiz (2sn)</div></div>
</div>
