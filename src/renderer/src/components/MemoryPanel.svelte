<script lang="ts">
  import X from '@lucide/svelte/icons/x'
  import Moon from '@lucide/svelte/icons/moon'
  import type { MemoryReport, TabInfo } from '@shared/ipc'
  import { closeOverlay, nd, ui } from '../lib/state.svelte'
  import { t } from '../lib/i18n'
  import Favicon from './Favicon.svelte'

  let report = $state<MemoryReport | null>(null)
  let freed = $state<number | null>(null)
  let busy = $state(false)

  async function poll(): Promise<void> {
    report = await nd.invoke('memory:get')
  }

  $effect(() => {
    void poll()
    const id = setInterval(poll, 1500)
    return () => clearInterval(id)
  })

  async function sleepAll(): Promise<void> {
    const before = report?.totalMB ?? null
    busy = true
    try {
      await nd.invoke('tabs:sleepInactive')
      await poll()
      if (before !== null && report) freed = Math.max(0, before - report.totalMB)
    } finally {
      busy = false
    }
  }

  async function sleepTab(id: string): Promise<void> {
    await nd.invoke('tabs:sleep', id)
    await poll()
  }

  const tabsMB = $derived(report ? report.tabs.reduce((a, x) => a + (x.mb ?? 0), 0) : 0)

  const parts = $derived.by(() => {
    if (!report) return []
    return [
      { key: 'tabs', mb: tabsMB, label: t('memory.tabs') },
      { key: 'shell', mb: report.shellMB, label: t('memory.shell') },
      { key: 'browser', mb: report.browserMB, label: t('memory.browser') },
      { key: 'gpu', mb: report.gpuMB, label: t('memory.gpu') },
      { key: 'other', mb: report.otherMB, label: t('memory.other') },
    ]
  })
  const partsTotal = $derived(Math.max(1, parts.reduce((a, p) => a + p.mb, 0)))

  interface Row {
    id: string
    title: string
    tab: TabInfo
    mb: number | null
  }
  const rows = $derived.by(() => {
    if (!report) return [] as Row[]
    const out: Row[] = []
    for (const r of report.tabs) {
      const tab = ui.tabs.find((x) => x.id === r.id)
      if (!tab) continue
      const title = tab.title || t(tab.service === 'gemini' ? 'service.gemini' : 'service.notebook')
      out.push({ id: r.id, title, tab, mb: r.mb })
    }
    return out.sort((a, b) => {
      if (a.mb === null || b.mb === null) return a.mb === b.mb ? 0 : a.mb === null ? 1 : -1
      return b.mb - a.mb
    })
  })
</script>

<div class="panel">
  <div class="header">
    <h2>{t('memory.title')}</h2>
    <button class="icon-btn" title={t('common.close')} onclick={closeOverlay}><X size={16} /></button>
  </div>

  {#if !report}
    <div class="skeleton">
      <div class="sk sk-total"></div>
      <div class="sk sk-bar"></div>
      <div class="sk sk-row"></div>
      <div class="sk sk-row"></div>
      <div class="sk sk-row"></div>
      <div class="sk sk-row"></div>
    </div>
  {:else}
    <div class="body">
      <div class="total">
        <span class="label muted">{t('memory.total')}</span>
        <span class="value">{t('memory.mb', { n: report.totalMB })}</span>
      </div>

      <div class="bar">
        {#each parts as p (p.key)}
          {#if p.mb > 0}
            <span class="seg seg-{p.key}" style:width="{(p.mb / partsTotal) * 100}%" title="{p.label}: {t('memory.mb', { n: p.mb })}"></span>
          {/if}
        {/each}
      </div>
      <div class="legend">
        {#each parts as p (p.key)}
          <div class="legend-item">
            <span class="dot dot-{p.key}"></span>
            <span class="legend-label">{p.label}</span>
            <span class="legend-value faint">{t('memory.mb', { n: p.mb })}</span>
          </div>
        {/each}
      </div>

      <div class="tabs">
        {#each rows as r (r.id)}
          <div class="tab-row">
            <Favicon tab={r.tab} size={16} />
            <span class="tab-title" title={r.title}>{r.title}</span>
            {#if r.mb === null}
              <span class="tab-state faint" title={t('tabs.sleeping')}><Moon size={13} /></span>
            {:else}
              <span class="tab-mb">{t('memory.mb', { n: r.mb })}</span>
              {#if r.id !== ui.activeId}
                <button class="icon-btn sleep-btn" title={t('memory.sleepNow')} onclick={() => sleepTab(r.id)}>
                  <Moon size={13} />
                </button>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="footer">
      {#if report.sleepingTabs > 0}
        <p class="muted small">{t('memory.sleeping', { n: report.sleepingTabs })}</p>
      {/if}
      <button class="btn" disabled={busy} onclick={sleepAll}>{t('memory.sleepAll')}</button>
      {#if freed !== null}
        <p class="freed faint small">{t('memory.freed', { n: freed })}</p>
      {/if}
      <p class="hint muted">{t('memory.hint')}</p>
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
    font-variant-numeric: tabular-nums;
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
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 18px 8px;
  }
  .total {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 14px;
  }
  .total .label {
    font-size: 12px;
  }
  .total .value {
    font-size: 32px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--surface-2);
  }
  .seg {
    height: 100%;
    transition: width 300ms var(--ease);
  }
  .seg-tabs {
    background: var(--accent);
  }
  .seg-shell {
    background: var(--success);
  }
  .seg-browser {
    background: var(--warning);
  }
  .seg-gpu {
    background: var(--danger);
  }
  .seg-other {
    background: var(--text-3);
  }
  .legend {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
    margin: 10px 0 18px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
  }
  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot-tabs {
    background: var(--accent);
  }
  .dot-shell {
    background: var(--success);
  }
  .dot-browser {
    background: var(--warning);
  }
  .dot-gpu {
    background: var(--danger);
  }
  .dot-other {
    background: var(--text-3);
  }
  .legend-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--text-2);
  }
  .legend-value {
    flex: none;
  }
  .tabs {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding-top: 6px;
    border-top: var(--border-w) solid var(--border);
  }
  .tab-row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
  }
  .tab-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .tab-state {
    flex: none;
    display: grid;
    place-items: center;
  }
  .tab-mb {
    flex: none;
    font-size: 12px;
    color: var(--text-2);
  }
  .sleep-btn {
    flex: none;
    width: 24px;
    height: 24px;
  }
  .footer {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px 18px 16px;
    border-top: var(--border-w) solid var(--border);
  }
  .footer .btn {
    align-self: stretch;
    justify-content: center;
  }
  .small {
    margin: 0;
    font-size: 12px;
  }
  .hint {
    margin: 0;
    line-height: 1.5;
  }

  /* ---- loading skeleton */
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }
  .sk {
    border-radius: var(--radius);
    background: var(--surface-2);
    animation: nd-pulse 1.3s ease-in-out infinite;
  }
  .sk-total {
    width: 45%;
    height: 30px;
  }
  .sk-bar {
    height: 8px;
    border-radius: 4px;
  }
  .sk-row {
    height: 20px;
  }
  .sk-row:nth-child(3) {
    width: 90%;
  }
  .sk-row:nth-child(4) {
    width: 75%;
  }
  .sk-row:nth-child(5) {
    width: 85%;
  }
  @keyframes nd-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
</style>
