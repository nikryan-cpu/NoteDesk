<script lang="ts">
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import Select from './Select.svelte'
  import Toggle from './Toggle.svelte'
  import { nd, openOverlay, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  // Restart prompt only shows once the setting actually differs from what it was at open time.
  const initialHwAccel = ui.settings.hardwareAcceleration

  const minutesLabel = (n: number) => (n === 0 ? t('common.never') : t('common.minutes', { n }))
  const sleepOptions = [0, 5, 10, 15, 30, 60].map((n) => ({ value: n, label: minutesLabel(n) }))
  const deepSleepOptions = [0, 15, 30, 60, 120].map((n) => ({ value: n, label: minutesLabel(n) }))
</script>

<Group>
  <Row label={t('performance.sleepAfter')} hint={t('performance.sleepAfterHint')}>
    <Select value={ui.settings.sleepAfterMinutes} options={sleepOptions} onchange={(v) => setSettings({ sleepAfterMinutes: v })} />
  </Row>
  <Row label={t('performance.deepSleep')} hint={t('performance.deepSleepHint')}>
    <Select value={ui.settings.deepSleepMinutes} options={deepSleepOptions} onchange={(v) => setSettings({ deepSleepMinutes: v })} />
  </Row>
  <Row label={t('performance.hardwareAccel')} hint={t('performance.hardwareAccelHint')}>
    <Toggle checked={ui.settings.hardwareAcceleration} onchange={(v) => setSettings({ hardwareAcceleration: v })} />
  </Row>
  {#if ui.settings.hardwareAcceleration !== initialHwAccel}
    <div class="restart">
      <span class="muted">{t('common.restartRequired')}</span>
      <button type="button" class="btn primary" onclick={() => nd.invoke('app:relaunch')}>{t('common.restart')}</button>
    </div>
  {/if}
</Group>

<button type="button" class="btn" onclick={() => openOverlay('memory')}>{t('performance.openMemory')}</button>

<style>
  .restart {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    font-size: 12px;
  }
  :global([data-density='compact']) .restart {
    padding: 8px 14px;
  }
</style>
