<script lang="ts">
  import Download from '@lucide/svelte/icons/download'
  import X from '@lucide/svelte/icons/x'
  import FileAudio from '@lucide/svelte/icons/file-audio'
  import FileVideo from '@lucide/svelte/icons/file-video'
  import FileImage from '@lucide/svelte/icons/file-image'
  import FileText from '@lucide/svelte/icons/file-text'
  import FileIcon from '@lucide/svelte/icons/file'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import FolderOpen from '@lucide/svelte/icons/folder-open'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import Pause from '@lucide/svelte/icons/pause'
  import Play from '@lucide/svelte/icons/play'
  import type { DownloadInfo } from '@shared/ipc'
  import { formatBytes } from '@shared/text'
  import { closeOverlay, nd, ui } from '../lib/state.svelte'
  import { t } from '../lib/i18n'

  const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac|aac)$/i
  const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi)$/i
  const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i
  const DOC_EXT = /\.(pdf|txt|md|docx?|csv|json)$/i

  function fileIcon(name: string) {
    if (AUDIO_EXT.test(name)) return FileAudio
    if (VIDEO_EXT.test(name)) return FileVideo
    if (IMAGE_EXT.test(name)) return FileImage
    if (DOC_EXT.test(name)) return FileText
    return FileIcon
  }

  const hasFinished = $derived(ui.downloads.some((d) => d.state !== 'progressing'))

  function act(id: string, action: 'open' | 'show' | 'cancel' | 'pause' | 'resume' | 'remove'): void {
    void nd.invoke('downloads:action', id, action)
  }

  function openRow(d: DownloadInfo): void {
    if (d.state === 'completed') act(d.id, 'open')
  }
</script>

<div class="panel">
  <div class="header">
    <h2>{t('downloads.title')}</h2>
    <div class="header-actions">
      {#if hasFinished}
        <button class="btn ghost" onclick={() => nd.invoke('downloads:clear')}>{t('downloads.clear')}</button>
      {/if}
      <button class="icon-btn" title={t('common.close')} onclick={closeOverlay}><X size={16} /></button>
    </div>
  </div>

  {#if ui.downloads.length === 0}
    <div class="empty">
      <Download size={28} />
      <p>{t('downloads.empty')}</p>
    </div>
  {:else}
    <div class="list">
      {#each ui.downloads as d (d.id)}
        {@const Icon = fileIcon(d.filename)}
        {@const pct = d.total > 0 ? Math.min(100, (d.received / d.total) * 100) : 0}
        <div
          class="row"
          class:clickable={d.state === 'completed'}
          role="button"
          tabindex={d.state === 'completed' ? 0 : -1}
          onclick={() => openRow(d)}
          onkeydown={(e) => {
            if (d.state === 'completed' && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              openRow(d)
            }
          }}
        >
          <span class="icon"><Icon size={18} /></span>
          <div class="info">
            <div class="name" title={d.filename}>{d.filename}</div>
            {#if d.state === 'progressing'}
              <div class="track">
                {#if d.total > 0}
                  <div class="fill" class:paused={d.paused} style:width="{pct}%"></div>
                {:else}
                  <div class="fill indeterminate" class:paused={d.paused}></div>
                {/if}
              </div>
              <div class="meta faint">
                {#if d.paused}{t('downloads.paused')} · {/if}{formatBytes(d.received)}{#if d.total} / {formatBytes(d.total)}{/if}
              </div>
            {:else if d.state === 'completed'}
              <div class="meta faint">{formatBytes(d.received)}</div>
            {:else if d.state === 'cancelled'}
              <div class="meta faint">{t('downloads.cancelled')}</div>
            {:else}
              <div class="meta faint">{t('downloads.failed')}</div>
            {/if}
          </div>
          <div class="actions">
            {#if d.state === 'completed'}
              <button class="icon-btn" title={t('downloads.open')} onclick={(e) => { e.stopPropagation(); act(d.id, 'open') }}>
                <ExternalLink size={15} />
              </button>
              <button class="icon-btn" title={t('downloads.show')} onclick={(e) => { e.stopPropagation(); act(d.id, 'show') }}>
                <FolderOpen size={15} />
              </button>
              <button class="icon-btn" title={t('downloads.remove')} onclick={(e) => { e.stopPropagation(); act(d.id, 'remove') }}>
                <Trash2 size={15} />
              </button>
            {:else if d.state === 'progressing'}
              {#if d.paused}
                <button class="icon-btn" title={t('downloads.resume')} onclick={(e) => { e.stopPropagation(); act(d.id, 'resume') }}>
                  <Play size={15} />
                </button>
              {:else}
                <button class="icon-btn" title={t('downloads.pause')} onclick={(e) => { e.stopPropagation(); act(d.id, 'pause') }}>
                  <Pause size={15} />
                </button>
              {/if}
              <button class="icon-btn" title={t('downloads.cancel')} onclick={(e) => { e.stopPropagation(); act(d.id, 'cancel') }}>
                <X size={15} />
              </button>
            {:else}
              <button class="icon-btn" title={t('downloads.remove')} onclick={(e) => { e.stopPropagation(); act(d.id, 'remove') }}>
                <Trash2 size={15} />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: 380px;
    max-width: calc(100vw - 24px);
    height: 100%;
    overflow: hidden;
    animation: nd-slide-in 220ms var(--ease);
  }
  @keyframes nd-slide-in {
    from {
      opacity: 0;
      transform: translateX(18px);
    }
    to {
      opacity: 1;
      transform: none;
    }
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
  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 8px;
    border-radius: var(--radius);
    transition: background var(--dur) var(--ease);
  }
  .row.clickable {
    cursor: pointer;
  }
  .row:hover {
    background: var(--tab-hover);
  }
  .row.clickable:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }
  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    margin-top: 1px;
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text-2);
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-top: 2px;
  }
  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 550;
  }
  .meta {
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }
  .track {
    height: 4px;
    border-radius: 2px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 2px;
    background: var(--accent);
    transition: width 200ms var(--ease);
  }
  .fill.paused {
    background: var(--text-3);
  }
  .fill.indeterminate {
    width: 40% !important;
    animation: nd-indeterminate 1.1s ease-in-out infinite;
  }
  @keyframes nd-indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(250%);
    }
  }
  .actions {
    display: flex;
    align-items: flex-start;
    gap: 2px;
    flex: none;
    padding-top: 1px;
  }
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    text-align: center;
    color: var(--text-3);
  }
  .empty p {
    margin: 0;
    max-width: 260px;
    color: var(--text-2);
  }
</style>
