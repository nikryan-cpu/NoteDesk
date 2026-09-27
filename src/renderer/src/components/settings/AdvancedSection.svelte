<script lang="ts">
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import type { CompatPreset } from '@shared/compat'
  import type { I18nKey } from '@shared/i18n'
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import Toggle from './Toggle.svelte'
  import ConfirmButton from './ConfirmButton.svelte'
  import { nd, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  const COMPAT_OPTIONS: { id: CompatPreset; label: I18nKey }[] = [
    { id: 'chrome', label: 'advanced.compatChrome' },
    { id: 'firefox', label: 'advanced.compatFirefox' },
    { id: 'electron', label: 'advanced.compatElectron' },
  ]

  // Restart prompt only shows once the preset actually differs from what it was at open time.
  const initialCompat = ui.settings.compatPreset
</script>

<Group heading={t('advanced.compat')}>
  <div class="compat">
    <p class="faint">{t('advanced.compatHint')}</p>
    <div class="radio-list" role="radiogroup" aria-label={t('advanced.compat')}>
      {#each COMPAT_OPTIONS as opt (opt.id)}
        <button
          type="button"
          role="radio"
          aria-checked={ui.settings.compatPreset === opt.id}
          class="radio-opt"
          class:active={ui.settings.compatPreset === opt.id}
          onclick={() => setSettings({ compatPreset: opt.id })}
        >
          <span class="dot" aria-hidden="true"></span>
          {t(opt.label)}
        </button>
      {/each}
    </div>
    {#if ui.settings.compatPreset !== initialCompat}
      <div class="restart">
        <span class="muted">{t('common.restartRequired')}</span>
        <button type="button" class="btn primary" onclick={() => nd.invoke('app:relaunch')}>{t('common.restart')}</button>
      </div>
    {/if}
  </div>
</Group>

<Group>
  <Row label={t('advanced.spellcheck')}>
    <Toggle checked={ui.settings.spellcheck} onchange={(v) => setSettings({ spellcheck: v })} />
  </Row>
  <Row label={t('advanced.autoUpdate')}>
    <Toggle checked={ui.settings.autoUpdate} onchange={(v) => setSettings({ autoUpdate: v })} />
  </Row>
</Group>

<button type="button" class="btn ghost" onclick={() => nd.invoke('app:openDataDir')}>
  <FolderOpen size={15} />
  {t('advanced.openDataDir')}
</button>

<ConfirmButton
  label={t('advanced.clearAll')}
  confirmText={t('advanced.clearAllConfirm')}
  onconfirm={() => nd.invoke('app:clearAllData')}
/>

<style>
  .compat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
  }
  .compat p {
    margin: 0;
    font-size: 11.5px;
  }
  .radio-list {
    display: flex;
    flex-direction: column;
  }
  .radio-opt {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 4px;
    border-radius: var(--radius);
    text-align: left;
    width: 100%;
  }
  .radio-opt:hover {
    background: var(--tab-hover);
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: var(--border-w) solid var(--text-3);
    flex: none;
    position: relative;
  }
  .radio-opt.active .dot {
    border-color: var(--accent);
  }
  .radio-opt.active .dot::after {
    content: '';
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    background: var(--accent);
  }
  .restart {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }
</style>
