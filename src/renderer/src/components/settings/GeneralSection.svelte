<script lang="ts">
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import Select from './Select.svelte'
  import Toggle from './Toggle.svelte'
  import { setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  const serviceOptions = [
    { value: 'notebook', label: t('service.notebook') },
    { value: 'gemini', label: t('service.gemini') },
  ] as const
</script>

<Group>
  <Row label={t('general.defaultService')}>
    <Select value={ui.settings.defaultService} options={serviceOptions} onchange={(v) => setSettings({ defaultService: v })} />
  </Row>
  <Row label={t('general.restoreSession')} hint={t('general.restoreSessionHint')}>
    <Toggle checked={ui.settings.restoreSession} onchange={(v) => setSettings({ restoreSession: v })} />
  </Row>
  <Row label={t('general.closeToTray')}>
    <Toggle checked={ui.settings.closeToTray} onchange={(v) => setSettings({ closeToTray: v })} />
  </Row>
  <Row label={t('general.launchAtLogin')}>
    <Toggle checked={ui.settings.launchAtLogin} onchange={(v) => setSettings({ launchAtLogin: v })} />
  </Row>
  <Row label={t('general.startMinimized')}>
    <Toggle
      checked={ui.settings.startMinimized}
      disabled={!ui.settings.launchAtLogin}
      onchange={(v) => setSettings({ startMinimized: v })}
    />
  </Row>
  <Row label={t('general.quickAskService')}>
    <Select value={ui.settings.quickAskService} options={serviceOptions} onchange={(v) => setSettings({ quickAskService: v })} />
  </Row>
</Group>

<Group heading={t('advanced.notifications')}>
  <Row label={t('notifications.generationDone')} hint={t('notifications.generationDoneHint')}>
    <Toggle checked={ui.settings.notifyGenerationDone} onchange={(v) => setSettings({ notifyGenerationDone: v })} />
  </Row>
</Group>
