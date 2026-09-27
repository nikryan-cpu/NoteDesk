<script lang="ts">
  import ChevronUp from '@lucide/svelte/icons/chevron-up'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import X from '@lucide/svelte/icons/x'
  import Search from '@lucide/svelte/icons/search'
  import { nd, ui } from '../lib/state.svelte'
  import { t } from '../lib/i18n'
  import { FINDBAR_H } from '../lib/layout'

  let { top, left, right }: { top: number; left: number; right: number } = $props()
  let query = $state('')
  let input: HTMLInputElement

  $effect(() => {
    input?.focus()
    input?.select()
  })

  function run(forward = true, findNext = false) {
    void nd.invoke('find:start', query, forward, findNext)
  }

  function close() {
    ui.findOpen = false
    ui.find = { matches: 0, active: 0 }
    void nd.invoke('find:stop')
  }
</script>

<div class="findbar" style:top="{top}px" style:left="{left}px" style:right="{right}px" style:height="{FINDBAR_H}px">
  <div class="box">
    <Search size={14} />
    <input
      bind:this={input}
      bind:value={query}
      placeholder={t('find.placeholder')}
      spellcheck="false"
      oninput={() => run(true, false)}
      onkeydown={(e) => {
        if (e.key === 'Enter') run(!e.shiftKey, true)
        if (e.key === 'Escape') close()
      }}
    />
    <span class="count faint">
      {#if query}{ui.find.matches ? t('find.count', { a: ui.find.active, b: ui.find.matches }) : t('find.none')}{/if}
    </span>
    <button class="icon-btn" title={t('find.prev')} disabled={!ui.find.matches} onclick={() => run(false, true)}><ChevronUp size={15} /></button>
    <button class="icon-btn" title={t('find.next')} disabled={!ui.find.matches} onclick={() => run(true, true)}><ChevronDown size={15} /></button>
    <button class="icon-btn" title={t('common.close')} onclick={close}><X size={15} /></button>
  </div>
</div>

<style>
  .findbar {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    z-index: 3;
    animation: nd-fade-in 140ms var(--ease);
  }
  .box {
    display: flex;
    align-items: center;
    gap: 4px;
    width: min(440px, 100%);
    height: 34px;
    padding: 0 4px 0 11px;
    border-radius: var(--radius);
    background: var(--surface);
    border: var(--border-w) solid var(--border);
    box-shadow: var(--shadow);
    color: var(--text-2);
  }
  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    padding: 0 4px;
  }
  .count {
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    padding-right: 4px;
  }
</style>
