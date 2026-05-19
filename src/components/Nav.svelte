<script>
  import { createEventDispatcher } from 'svelte';

  export let currentTab = 'monitor';
  export let logBadge   = 0;

  const dispatch = createEventDispatcher();

  const tabs = [
    { id: 'scanner', icon: '📷', label: 'Scanner' },
    { id: 'monitor', icon: '📊', label: 'Monitor' },
    { id: 'history', icon: '🗂',  label: 'History' },
    { id: 'logs',    icon: '📋', label: 'Logs'    },
    { id: 'tools',   icon: '⚙️', label: 'Tools'   },
  ];
</script>

<nav id="nav">
  {#each tabs as tab}
    <button
      class="nav-btn"
      class:active={currentTab === tab.id}
      on:click={() => dispatch('navigate', tab.id)}
    >
      <span class="nav-icon">{tab.icon}</span>
      <span class="nav-label">{tab.label}</span>
      {#if tab.id === 'logs' && logBadge > 0}
        <div class="nav-badge show">{logBadge}</div>
      {/if}
    </button>
  {/each}
</nav>
