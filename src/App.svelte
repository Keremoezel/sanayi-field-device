<script>
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import Nav    from './components/Nav.svelte';
  import Modal  from './components/Modal.svelte';

  import Monitor from './tabs/Monitor.svelte';
  import Scanner from './tabs/Scanner.svelte';
  import History from './tabs/History.svelte';
  import Logs    from './tabs/Logs.svelte';
  import Tools   from './tabs/Tools.svelte';

  let currentTab   = 'monitor';
  let logBadge     = 0;

  function navigate(tab) { currentTab = tab; }

  onMount(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  });
</script>

<Header />

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
<Modal />
