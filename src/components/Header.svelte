<script>
  import { onMount, onDestroy } from 'svelte';
  import { theme } from '../stores/theme.js';

  let clock    = '—';
  let version  = 'v1.0.0';
  let projects = [];
  let timer;

  const THEMES = ['dark', 'light', 'auto'];
  const ICONS  = { dark: '🌙', light: '☀️', auto: '⚙️' };

  function cycleTheme() {
    const i = THEMES.indexOf($theme);
    theme.set(THEMES[(i + 1) % THEMES.length]);
  }

  onMount(async () => {
    tick();
    timer = setInterval(tick, 1000);
    try {
      const [health, status] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/monitor/status').then(r => r.json()),
      ]);
      if (health.version) version = 'v' + health.version;
      projects = (status.projects || []).map(p => ({
        name:   p.name.replace('Uygulaması','').replace('Derneği','').trim(),
        online: p.online,
      }));
    } catch {}
  });

  onDestroy(() => clearInterval(timer));

  function tick() {
    clock = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<header id="header">
  <div class="header-top">
    <div class="header-brand">
      <div class="header-label">Developer Terminal</div>
      <div class="header-title">Field Device</div>
    </div>
    <div class="header-right">
      <button class="theme-toggle" on:click={cycleTheme} title="Tema değiştir">
        {ICONS[$theme]} {$theme}
      </button>
      <div class="h-pill">
        <div class="led green pulse"></div>
        <span class="name">{version}</span>
      </div>
      <div class="h-pill">{clock}</div>
    </div>
  </div>

  {#if projects.length > 0}
    <div class="header-projects">
      {#each projects as p}
        <div class="project-pill" class:online={p.online} class:offline={!p.online}>
          <div class="led" class:green={p.online} class:red={!p.online}></div>
          {p.name}
        </div>
      {/each}
    </div>
  {/if}
</header>
