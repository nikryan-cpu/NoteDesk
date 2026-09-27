<script lang="ts">
  // One "Modes" button that opens a popover with a row of variant/thinking/search controls per
  // compared model. Shown instead of ModelModes once more than one model is selected.
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import type { ModelId } from '@shared/ask'
  import { SERVICES } from '@shared/services'
  import ServiceIcon from '../components/ServiceIcon.svelte'
  import ModelModes from './ModelModes.svelte'
  import { capsFor, t } from './state.svelte'

  let { models }: { models: ModelId[] } = $props()

  let open = $state(false)
  let rootEl: HTMLDivElement | undefined = $state()

  const hasAny = $derived(
    models.some((m) => {
      const c = capsFor(m)
      return !!c && (c.variants.length > 0 || c.thinking || c.search)
    }),
  )

  function onDocClick(e: MouseEvent): void {
    if (rootEl && !rootEl.contains(e.target as Node)) open = false
  }

  $effect(() => {
    if (!open) return
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  })

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      open = false
    }
  }
</script>

{#if hasAny}
  <div class="modes-popover" bind:this={rootEl}>
    <button type="button" class="btn ghost modes-trigger" aria-expanded={open} onclick={() => (open = !open)}>
      <SlidersHorizontal size={14} />
      <span>{t('ask.modes')}</span>
    </button>
    {#if open}
      <div class="popover panel" onkeydown={onKeydown} role="menu" tabindex="-1">
        {#each models as model (model)}
          <div class="modes-row">
            <span class="modes-row-name"><ServiceIcon service={model} size={14} />{SERVICES[model].name}</span>
            <ModelModes {model} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .modes-popover {
    position: relative;
    flex: none;
  }
  .modes-trigger {
    height: 28px;
    padding: 0 10px;
    font-size: 12.5px;
  }
  .popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 5;
    width: max-content;
    max-width: min(420px, calc(100vw - 24px));
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: nd-pop-in 140ms var(--ease);
  }
  .modes-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 6px 8px;
  }
  .modes-row + .modes-row {
    border-top: var(--border-w) solid var(--border);
    padding-top: 10px;
  }
  .modes-row-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
  }
</style>
