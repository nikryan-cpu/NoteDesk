<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import ArrowRight from '@lucide/svelte/icons/arrow-right'
  import RotateCw from '@lucide/svelte/icons/rotate-cw'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import StatusCluster from './StatusCluster.svelte'
  import { activeTab, nd, setSettings, ui } from '../lib/state.svelte'
  import { t, modKey } from '../lib/i18n'
  import { captionInset, titlebarHeight, trafficInset } from '../lib/layout'

  const tab = $derived(activeTab())
</script>

<header
  class="topbar drag"
  style:height="{titlebarHeight(ui.settings)}px"
  style:padding-left="{trafficInset(ui.platform) + 8}px"
  style:padding-right="{captionInset(ui.platform)}px"
>
  <button
    class="icon-btn"
    title="{t('action.toggleSidebar')} ({modKey(ui.platform)}+B)"
    onclick={() => setSettings({ sidebarCollapsed: !ui.settings.sidebarCollapsed })}
  >
    <PanelLeft size={16} />
  </button>
  {#if tab?.kind !== 'ask'}
    <div class="nav">
      <button class="icon-btn" disabled={!tab?.canGoBack} title={t('nav.back')} onclick={() => tab && nd.invoke('tabs:navigate', tab.id, 'back')}>
        <ArrowLeft size={16} />
      </button>
      <button class="icon-btn" disabled={!tab?.canGoForward} title={t('nav.forward')} onclick={() => tab && nd.invoke('tabs:navigate', tab.id, 'forward')}>
        <ArrowRight size={16} />
      </button>
      <button class="icon-btn" disabled={!tab} title={t('nav.reload')} onclick={() => tab && nd.invoke('tabs:reload', tab.id)}>
        <RotateCw size={15} />
      </button>
    </div>
  {/if}
  <div class="title">{tab?.title || (tab?.kind === 'ask' ? t('tray.quickAsk') : '')}</div>
  <StatusCluster />
</header>

<style>
  .topbar {
    position: absolute;
    inset: 0 0 auto 0;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 2;
  }
  .nav {
    display: flex;
    gap: 0;
  }
  .title {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-weight: 600;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 12px;
  }

  :global([data-theme='glass']) .topbar,
  :global([data-theme='aurora']) .topbar {
    background: linear-gradient(180deg, color-mix(in oklab, var(--surface) 32%, transparent), transparent);
  }
</style>
