<script lang="ts">
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw'
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import Toggle from './Toggle.svelte'
  import { nd, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  async function pickFolder() {
    const dir = await nd.invoke('app:pickFolder')
    if (dir) setSettings({ downloadsDir: dir })
  }
</script>

<Group>
  <Row label={t('downloadsSettings.folder')} hint={ui.settings.downloadsDir || t('downloadsSettings.default')}>
    <div class="folder-actions">
      <button type="button" class="btn ghost" onclick={pickFolder}>
        <FolderOpen size={15} />
        {t('downloadsSettings.change')}
      </button>
      {#if ui.settings.downloadsDir}
        <button type="button" class="icon-btn" title={t('common.reset')} onclick={() => setSettings({ downloadsDir: '' })}>
          <RotateCcw size={15} />
        </button>
      {/if}
    </div>
  </Row>
  <Row label={t('downloadsSettings.ask')}>
    <Toggle checked={ui.settings.askWhereToSave} onchange={(v) => setSettings({ askWhereToSave: v })} />
  </Row>
</Group>

<style>
  .folder-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
