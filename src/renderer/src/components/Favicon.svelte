<script lang="ts">
  import type { TabInfo } from '@shared/ipc'
  import MessagesSquare from '@lucide/svelte/icons/messages-square'
  import ServiceIcon from './ServiceIcon.svelte'

  let { tab, size = 16 }: { tab: TabInfo; size?: number } = $props()
  let failed = $state(false)
  $effect(() => {
    void tab.favicon
    failed = false
  })
</script>

<span class="fav" style:width="{size}px" style:height="{size}px">
  {#if tab.kind === 'ask'}
    <MessagesSquare size={size - 2} strokeWidth={2} />
  {:else if tab.loading && !tab.sleeping}
    <span class="spinner" style:width="{size - 2}px" style:height="{size - 2}px"></span>
  {:else if tab.favicon && !failed}
    <img src={tab.favicon} alt="" width={size} height={size} onerror={() => (failed = true)} draggable="false" />
  {:else}
    <ServiceIcon service={tab.service} {size} />
  {/if}
</span>

<style>
  .fav {
    display: inline-grid;
    place-items: center;
    flex: none;
    color: var(--text-2);
  }
  img {
    display: block;
    border-radius: 3px;
  }
  .spinner {
    border-radius: 50%;
    border: 2px solid color-mix(in oklab, var(--accent) 25%, transparent);
    border-top-color: var(--accent);
    animation: nd-spin 0.7s linear infinite;
  }
</style>
