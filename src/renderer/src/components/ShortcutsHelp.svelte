<script lang="ts">
  import X from '@lucide/svelte/icons/x'
  import { IN_APP_SHORTCUTS, acceleratorKeys, keyLabel } from '../lib/shortcuts'
  import { closeOverlay, openSettings, ui } from '../lib/state.svelte'
  import { t } from '../lib/i18n'

  function comboKeys(combo: string[]): string[] {
    return combo.map((k) => keyLabel(k, ui.platform))
  }

  const globalRows = $derived([
    { label: t('shortcuts.toggleWindow'), keys: acceleratorKeys(ui.settings.hotkeys.toggleWindow, ui.platform) },
    { label: t('shortcuts.quickAsk'), keys: acceleratorKeys(ui.settings.hotkeys.quickAsk, ui.platform) },
  ])
</script>

<div class="panel">
  <div class="header">
    <h2>{t('shortcuts.title')}</h2>
    <button class="icon-btn" title={t('common.close')} onclick={closeOverlay}><X size={16} /></button>
  </div>

  <div class="body">
    <section>
      <h3>{t('shortcuts.inApp')}</h3>
      <div class="grid">
        {#each IN_APP_SHORTCUTS as row (row.label)}
          <div class="row">
            <span class="label">{t(row.label)}</span>
            <span class="keys">
              {#each row.combos as combo, i (i)}
                {#if i > 0}<span class="faint">/</span>{/if}
                {#each comboKeys(combo) as k (k)}<span class="kbd">{k}</span>{/each}
              {/each}
            </span>
          </div>
        {/each}
      </div>
    </section>

    <section>
      <h3>{t('shortcuts.global')}</h3>
      <div class="list">
        {#each globalRows as g (g.label)}
          <div class="row">
            <span class="label">{g.label}</span>
            <span class="keys">
              {#if g.keys.length === 0}
                <span class="faint">{t('shortcuts.disabled')}</span>
              {:else}
                {#each g.keys as k (k)}<span class="kbd">{k}</span>{/each}
              {/if}
            </span>
          </div>
        {/each}
      </div>
    </section>
  </div>

  <div class="footer">
    <button class="link" onclick={() => openSettings('shortcuts')}>{t('shortcuts.record')}</button>
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: 760px;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    animation: nd-pop-in 200ms var(--ease);
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 8px 14px 18px;
    border-bottom: var(--border-w) solid var(--border);
    flex: none;
  }
  h2 {
    font-size: 15px;
  }
  h3 {
    font-size: 12px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-3);
    margin: 0 0 6px;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .grid {
    columns: 2 320px;
    column-gap: 32px;
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 7px 0;
    break-inside: avoid;
  }
  .label {
    min-width: 0;
    line-height: 1.3;
    color: var(--text-2);
  }
  .keys {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    flex: none;
    max-width: 62%;
  }
  .footer {
    flex: none;
    display: flex;
    justify-content: center;
    padding: 4px 18px 18px;
  }
  .link {
    padding: 6px 10px;
    border-radius: var(--radius);
    color: var(--accent);
    font-weight: 550;
    transition: background var(--dur) var(--ease);
  }
  .link:hover {
    background: var(--tab-hover);
    text-decoration: underline;
  }
</style>
