<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus'
  import BookOpen from '@lucide/svelte/icons/book-open'
  import Sparkles from '@lucide/svelte/icons/sparkles'
  import TabStrip from './TabStrip.svelte'
  import { ui } from '../lib/state.svelte'
  import { t, modKey } from '../lib/i18n'
  import { newTab, newTabMenu } from '../lib/actions'
  import { sidebarWidth, titlebarHeight } from '../lib/layout'

  const collapsed = $derived(ui.settings.sidebarCollapsed)
</script>

<aside
  class="sidebar"
  class:collapsed
  style:top="{titlebarHeight(ui.settings)}px"
  style:width="{sidebarWidth(ui.settings)}px"
>
  <div class="actions">
    {#if collapsed}
      <button class="icon-btn big" title="{t('tabs.new')} ({modKey(ui.platform)}+T)" onclick={() => newTab()} oncontextmenu={(e) => { e.preventDefault(); newTabMenu() }}>
        <Plus size={18} />
      </button>
    {:else}
      <button class="new" onclick={() => newTab('notebook')} oncontextmenu={(e) => { e.preventDefault(); newTabMenu() }}>
        <BookOpen size={15} />
        <span>{t('service.notebook.short')}</span>
      </button>
      <button class="new" onclick={() => newTab('gemini')} oncontextmenu={(e) => { e.preventDefault(); newTabMenu() }}>
        <Sparkles size={15} />
        <span>{t('service.gemini.short')}</span>
      </button>
    {/if}
  </div>
  <div class="list">
    <TabStrip vertical {collapsed} />
  </div>
</aside>

<style>
  .sidebar {
    position: absolute;
    left: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    padding: 4px 8px 10px 8px;
    gap: 8px;
    z-index: 1;
    transition: width 200ms var(--ease);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .collapsed .actions {
    justify-content: center;
  }
  .new {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 10px;
    border-radius: var(--radius);
    color: var(--text-2);
    border: var(--border-w) dashed color-mix(in oklab, var(--text) 16%, transparent);
    font-weight: 550;
    transition:
      background var(--dur) var(--ease),
      color var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .new:hover {
    background: var(--tab-hover);
    color: var(--text);
    border-color: color-mix(in oklab, var(--accent) 50%, transparent);
  }
  .big {
    width: 38px;
    height: 38px;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    margin: 0 -4px;
    padding: 0 4px;
  }
  .list :global(.strip.vertical) {
    height: auto;
  }
</style>
