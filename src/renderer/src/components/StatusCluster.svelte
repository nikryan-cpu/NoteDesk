<script lang="ts">
  import Search from '@lucide/svelte/icons/search'
  import Settings2 from '@lucide/svelte/icons/settings-2'
  import Download from '@lucide/svelte/icons/arrow-down-to-line'
  import WifiOff from '@lucide/svelte/icons/wifi-off'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import MemoryStick from '@lucide/svelte/icons/memory-stick'
  import { nd, openOverlay, openSettings, ui } from '../lib/state.svelte'
  import { t, modKey } from '../lib/i18n'

  let memMB = $state<number | null>(null)

  $effect(() => {
    if (!ui.focused || ui.overlay || ui.e2e) return
    const tick = () => void nd.invoke('memory:get').then((r) => (memMB = r.totalMB))
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  })

  const active = $derived(ui.downloads.filter((d) => d.state === 'progressing'))
  const progress = $derived.by(() => {
    const total = active.reduce((a, d) => a + (d.total || 0), 0)
    const got = active.reduce((a, d) => a + d.received, 0)
    return total > 0 ? got / total : 0
  })
</script>

<div class="cluster no-drag">
  {#if !ui.online}
    <span class="pill warn" title={t('status.offline')}><WifiOff size={13} /> <span>{t('status.offline')}</span></span>
  {/if}
  {#if ui.update.state === 'ready'}
    <button class="pill accent" onclick={() => nd.invoke('app:installUpdate')} title={t('update.readyToast', { v: ui.update.version })}>
      <RefreshCw size={13} />
      <span>{t('update.restart')}</span>
    </button>
  {/if}
  {#if memMB !== null}
    <button class="pill mem" onclick={() => openOverlay('memory')} title={t('memory.title')}>
      <MemoryStick size={13} />
      <span>{memMB} MB</span>
    </button>
  {/if}
  {#if ui.downloads.length}
    <button class="icon-btn dl" onclick={() => openOverlay('downloads')} title={t('downloads.title')}>
      <Download size={16} />
      {#if active.length}
        <svg class="ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="16" pathLength="100" stroke-dasharray="{Math.round(progress * 100)} 100" />
        </svg>
      {/if}
    </button>
  {/if}
  <button class="icon-btn" onclick={() => openOverlay('palette')} title="{t('shortcuts.palette')} ({modKey(ui.platform)}+K)">
    <Search size={16} />
  </button>
  <button class="icon-btn" onclick={() => openSettings()} title="{t('settings.title')} ({modKey(ui.platform)}+,)">
    <Settings2 size={16} />
  </button>
</div>

<style>
  .cluster {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 9px;
    margin-right: 4px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-2);
    background: var(--tab-hover);
    font-variant-numeric: tabular-nums;
    transition: background var(--dur) var(--ease);
  }
  .pill:hover {
    background: color-mix(in oklab, var(--tab-hover) 60%, var(--text) 10%);
    color: var(--text);
  }
  .pill.warn {
    color: var(--warning);
    background: color-mix(in oklab, var(--warning) 14%, transparent);
  }
  .pill.accent {
    color: var(--accent-text);
    background: var(--accent);
  }
  .dl {
    position: relative;
  }
  .ring {
    position: absolute;
    inset: 1px;
    transform: rotate(-90deg);
    pointer-events: none;
  }
  .ring circle {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.5;
    stroke-linecap: round;
    transition: stroke-dasharray 300ms var(--ease);
  }
  :global([data-density='compact']) .pill span {
    display: none;
  }
  :global([data-density='compact']) .pill.mem span {
    display: inline;
  }
</style>
