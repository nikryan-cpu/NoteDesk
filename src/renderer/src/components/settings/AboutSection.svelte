<script lang="ts">
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Download from '@lucide/svelte/icons/download'
  import RotateCw from '@lucide/svelte/icons/rotate-cw'
  import Code from '@lucide/svelte/icons/code'
  import Bug from '@lucide/svelte/icons/bug'
  import Scale from '@lucide/svelte/icons/scale'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import Group from './Group.svelte'
  import { nd, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  function openExternal(url: string) {
    void nd.invoke('app:openExternal', url)
  }

  function updateAction() {
    const u = ui.update
    if (u.state === 'available') {
      if (u.canInstall) void nd.invoke('app:installUpdate')
      else openExternal(u.url)
    } else if (u.state === 'ready') {
      void nd.invoke('app:installUpdate')
    }
  }
</script>

<div class="head">
  <div class="name">{t('app.name')}</div>
  <div class="muted">{t('about.version', { v: ui.version })}</div>
  <p class="tagline muted">{t('app.tagline')}</p>
</div>

<Group>
  <div class="update">
    <div class="status">
      {#if ui.update.state === 'checking'}
        <span class="muted">{t('about.checking')}</span>
      {:else if ui.update.state === 'available'}
        <span>{t('about.available', { v: ui.update.version })}</span>
      {:else if ui.update.state === 'downloading'}
        <span class="muted">{t('about.downloading', { v: ui.update.version, p: ui.update.percent })}</span>
      {:else if ui.update.state === 'ready'}
        <span>{t('about.ready', { v: ui.update.version })}</span>
      {:else if ui.update.state === 'error'}
        <span class="danger">{t('about.error', { error: ui.update.message })}</span>
      {:else}
        <span class="muted">{t('about.upToDate')}</span>
      {/if}
    </div>
    <div class="update-actions">
      {#if ui.update.state === 'available'}
        <button type="button" class="btn primary" onclick={updateAction}>
          <Download size={14} />
          {t('about.download')}
        </button>
      {:else if ui.update.state === 'ready'}
        <button type="button" class="btn primary" onclick={updateAction}>
          <RotateCw size={14} />
          {t('about.restartNow')}
        </button>
      {:else}
        <button
          type="button"
          class="btn ghost"
          disabled={ui.update.state === 'checking' || ui.update.state === 'downloading'}
          onclick={() => nd.invoke('app:checkUpdates')}
        >
          <RefreshCw size={14} />
          {t('about.checkUpdates')}
        </button>
      {/if}
    </div>
  </div>
</Group>

<Group>
  <button type="button" class="link" onclick={() => openExternal('https://github.com/nikryan-cpu/NoteDesk')}>
    <Code size={15} />
    <span>{t('about.github')}</span>
    <ExternalLink size={13} class="ext" />
  </button>
  <button type="button" class="link" onclick={() => openExternal('https://github.com/nikryan-cpu/NoteDesk/issues/new/choose')}>
    <Bug size={15} />
    <span>{t('about.issue')}</span>
    <ExternalLink size={13} class="ext" />
  </button>
  <button type="button" class="link" onclick={() => openExternal('https://github.com/nikryan-cpu/NoteDesk/blob/main/LICENSE')}>
    <Scale size={15} />
    <span>{t('about.license')}</span>
    <ExternalLink size={13} class="ext" />
  </button>
</Group>

<p class="disclaimer faint">{t('app.disclaimer')}</p>

<style>
  .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    padding: 8px 0 4px;
  }
  .name {
    font-size: 19px;
    font-weight: 750;
    font-family: var(--font-heading);
  }
  .tagline {
    max-width: 420px;
    font-size: 12px;
    margin: 2px 0 0;
  }
  .update {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    flex-wrap: wrap;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    text-align: left;
    color: var(--text);
  }
  .link:hover {
    background: var(--tab-hover);
  }
  .link span {
    flex: 1;
  }
  .link :global(.ext) {
    color: var(--text-3);
  }
  .disclaimer {
    font-size: 11px;
    line-height: 1.5;
    text-align: center;
    padding: 8px 4px 0;
    margin: 0;
  }
</style>
