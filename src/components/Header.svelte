<script>
  import { onMount, onDestroy } from 'svelte';

  let clock   = '—';
  let version = 'v1.0.0';
  let timer;

  onMount(async () => {
    tick();
    timer = setInterval(tick, 1000);
    try {
      const data = await fetch('/api/health').then(r => r.json());
      if (data.version) version = 'v' + data.version;
    } catch {}
  });

  onDestroy(() => clearInterval(timer));

  function tick() {
    clock = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<header id="header">
  <div class="header-brand">
    <div class="header-label">Sanayi</div>
    <div class="header-title">Field Device</div>
  </div>
  <div class="header-status">
    <div class="h-pill">
      <div class="led green pulse"></div>
      <span class="name">{version}</span>
    </div>
    <div class="h-pill">{clock}</div>
  </div>
</header>
