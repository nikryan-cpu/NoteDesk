<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import TabStrip from './TabStrip.svelte'
  import StatusCluster from './StatusCluster.svelte'
  import { ui } from '../lib/state.svelte'
  import { t, modKey } from '../lib/i18n'
  import { captionInset, titlebarHeight, trafficInset } from '../lib/layout'
  import { newTab, newTabMenu } from '../lib/actions'
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<header
  class="titlebar drag"
  style:height="{titlebarHeight(ui.settings)}px"
  style:padding-left="{trafficInset(ui.platform) + 8}px"
  style:padding-right="{captionInset(ui.platform)}px"
  ondblclick={(e) => {
    if (ui.platform === 'darwin' && e.target === e.currentTarget) window.nd.invoke('window:control', 'maximize')
  }}
>
  <div class="tabs">
    <TabStrip />
    <div class="new no-drag">
      <button class="icon-btn" title="{t('tabs.new')} ({modKey(ui.platform)}+T)" onclick={() => newTab()}>
        <Plus size={17} />
      </button>
      <button class="icon-btn chev" title={t('tabs.openIn')} onclick={() => newTabMenu()}>
        <ChevronDown size={13} />
      </button>
    </div>
  </div>
  <div class="spacer"></div>
  <StatusCluster />
</header>

<style>
  .titlebar {
    position: absolute;
    inset: 0 0 auto 0;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 2;
  }
  .tabs {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 0 1 auto;
    height: 100%;
    gap: 2px;
  }
  .new {
    display: flex;
    align-items: center;
    flex: none;
  }
  .chev {
    width: 18px;
    margin-left: -2px;
  }
  .spacer {
    flex: 1;
    min-width: 24px;
    height: 100%;
  }
</style>
