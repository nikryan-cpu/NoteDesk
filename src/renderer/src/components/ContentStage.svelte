<script lang="ts">
  // Draws the content card behind the web view, and the states the web view can't show:
  // sleeping, crashed, load error, no tabs.
  import Moon from '@lucide/svelte/icons/moon'
  import CloudOff from '@lucide/svelte/icons/cloud-off'
  import Bug from '@lucide/svelte/icons/bug'
  import BookOpen from '@lucide/svelte/icons/book-open'
  import Sparkles from '@lucide/svelte/icons/sparkles'
  import type { LayoutInsets } from '@shared/ipc'
  import { activeTab, nd, openSettings } from '../lib/state.svelte'
  import { t } from '../lib/i18n'
  import { newTab } from '../lib/actions'

  let { insets }: { insets: LayoutInsets } = $props()
  const tab = $derived(activeTab())
</script>

<div
  class="stage"
  style:top="{insets.top}px"
  style:left="{insets.left}px"
  style:right="{insets.right}px"
  style:bottom="{insets.bottom}px"
  style:border-radius="{insets.radius}px"
>
  {#if !tab}
    <div class="state">
      <h2>{t('tabs.empty')}</h2>
      <p class="muted">{t('tabs.emptyHint')}</p>
      <div class="row">
        <button class="btn primary" onclick={() => newTab('notebook')}><BookOpen size={15} /> {t('service.notebook')}</button>
        <button class="btn" onclick={() => newTab('gemini')}><Sparkles size={15} /> {t('service.gemini')}</button>
      </div>
    </div>
  {:else if tab.crashed}
    <div class="state">
      <div class="glyph danger"><Bug size={26} /></div>
      <h2>{t('tabs.crashedTitle')}</h2>
      <p class="muted">{t('tabs.crashedHint')}</p>
      <button class="btn primary" onclick={() => nd.invoke('tabs:reload', tab.id)}>{t('tabs.retry')}</button>
    </div>
  {:else if tab.error}
    <div class="state">
      <div class="glyph"><CloudOff size={26} /></div>
      <h2>{t('tabs.errorTitle')}</h2>
      <p class="muted">{t('tabs.errorHint')}</p>
      <p class="faint code">{t('tabs.errorCode', { code: tab.error.description || tab.error.code })}</p>
      <div class="row">
        <button class="btn primary" onclick={() => nd.invoke('tabs:reload', tab.id)}>{t('tabs.retry')}</button>
        <button class="btn" onclick={() => openSettings('network')}>{t('tabs.proxySettings')}</button>
      </div>
    </div>
  {:else if tab.sleeping}
    <div class="state">
      <div class="glyph"><Moon size={26} /></div>
      <button class="btn" onclick={() => nd.invoke('tabs:activate', tab.id)}>{t('tabs.sleeping')}</button>
    </div>
  {/if}
</div>

<style>
  .stage {
    position: absolute;
    background: var(--surface);
    box-shadow: var(--content-shadow);
    overflow: hidden;
    display: grid;
    place-items: center;
  }
  :global([data-floating='false']) .stage {
    box-shadow: none;
    border-top: var(--border-w) solid var(--border);
  }
  :global([data-surface='glass']) .stage {
    background: color-mix(in oklab, var(--surface) 70%, transparent);
  }
  /* The native material already blurs the desktop for us here; keep the tint faint. */
  :global([data-theme='glass'][data-material='true']) .stage {
    background: color-mix(in oklab, var(--surface) 40%, transparent);
  }
  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 420px;
    padding: 24px;
    text-align: center;
    animation: nd-fade-in 240ms var(--ease);
  }
  h2 {
    font-size: 18px;
    font-weight: 650;
  }
  p {
    margin: 0;
    line-height: 1.55;
  }
  .code {
    font-size: 12px;
  }
  .row {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .glyph {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent-softer);
    color: var(--accent);
    margin-bottom: 4px;
  }
  .glyph.danger {
    background: color-mix(in oklab, var(--danger) 12%, transparent);
    color: var(--danger);
  }
</style>
