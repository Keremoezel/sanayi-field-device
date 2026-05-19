<script>
  import { onMount, onDestroy } from 'svelte';
  import { theme } from './stores/theme.js';
  import { closeModal } from './stores/modal.js';
  import Header from './components/Header.svelte';
  import Nav    from './components/Nav.svelte';
  import Modal  from './components/Modal.svelte';

  import Monitor from './tabs/Monitor.svelte';
  import Scanner from './tabs/Scanner.svelte';
  import History from './tabs/History.svelte';
  import Logs    from './tabs/Logs.svelte';
  import Tools   from './tabs/Tools.svelte';

  const TABS = ['scanner', 'monitor', 'history', 'logs', 'tools'];

  let currentTab = 'monitor';
  let logBadge   = 0;
  let offline    = false;

  function navigate(tab) { currentTab = tab; }

  // Apply theme to <html>
  $: if (typeof document !== 'undefined') {
    const effective = $theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : $theme;
    document.documentElement.setAttribute('data-theme', effective);
  }

  // Keyboard shortcuts: 1–5 = tabs, R = refresh, Esc = close modal
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const n = Number(e.key);
    if (n >= 1 && n <= 5) { navigate(TABS[n - 1]); return; }
    if (e.key === 'r' || e.key === 'R') { window.dispatchEvent(new CustomEvent('fd-refresh')); return; }
    if (e.key === 'Escape') closeModal();
  }

  // Swipe between tabs
  let tx = 0, ty = 0;
  function onTouchStart(e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) < 44 || Math.abs(dy) > Math.abs(dx) * 0.75) return;
    const i = TABS.indexOf(currentTab);
    if (dx < 0 && i < TABS.length - 1) navigate(TABS[i + 1]);
    if (dx > 0 && i > 0)               navigate(TABS[i - 1]);
  }

  function setOnline()  { offline = false; }
  function setOffline() { offline = true;  }

  onMount(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    offline = !navigator.onLine;
    window.addEventListener('online',   setOnline);
    window.addEventListener('offline',  setOffline);
    window.addEventListener('keydown',  onKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('online',   setOnline);
    window.removeEventListener('offline',  setOffline);
    window.removeEventListener('keydown',  onKeyDown);
  });
</script>

<div id="app-shell" on:touchstart={onTouchStart} on:touchend={onTouchEnd}>
  <Header />
  {#if offline}
    <div class="offline-banner">⚠ Çevrimdışı — İnternet bağlantısı yok</div>
  {/if}
  <main id="main">
    <div class="tab-page" class:active={currentTab === 'scanner'}><Scanner /></div>
    <div class="tab-page" class:active={currentTab === 'monitor'}><Monitor /></div>
    <div class="tab-page" class:active={currentTab === 'history'}><History /></div>
    <div class="tab-page" class:active={currentTab === 'logs'}>
      <Logs bind:badge={logBadge} />
    </div>
    <div class="tab-page" class:active={currentTab === 'tools'}><Tools /></div>
  </main>
  <Nav {currentTab} {logBadge} on:navigate={e => navigate(e.detail)} />
</div>

<Modal />
