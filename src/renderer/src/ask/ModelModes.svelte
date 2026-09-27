<script lang="ts">
  // Per-model switches: a variant dropdown (when the service offers more than its default) and
  // toggle chips for deeper reasoning and web search. Renders nothing for a model whose page
  // offers none of these.
  import Brain from '@lucide/svelte/icons/brain'
  import Globe from '@lucide/svelte/icons/globe'
  import type { ModelId } from '@shared/ask'
  import { capsFor, optionsFor, setModelOption, t } from './state.svelte'

  let { model }: { model: ModelId } = $props()

  const caps = $derived(capsFor(model))
  const opts = $derived(optionsFor(model))

  function onVariant(e: Event): void {
    setModelOption(model, { variant: (e.currentTarget as HTMLSelectElement).value })
  }
</script>

{#if caps && (caps.variants.length > 0 || caps.thinking || caps.search)}
  <div class="modes">
    {#if caps.variants.length > 0}
      <select class="variant-select" value={opts.variant} onchange={onVariant}>
        <option value="">{t('ask.variantAuto')}</option>
        {#each caps.variants as v (v.id)}
          <option value={v.id}>{v.label}</option>
        {/each}
      </select>
    {/if}
    {#if caps.thinking}
      <button
        type="button"
        class="mode-chip"
        class:on={opts.thinking}
        aria-pressed={opts.thinking}
        title={t('ask.thinking')}
        onclick={() => setModelOption(model, { thinking: !opts.thinking })}
      >
        <Brain size={13} />
        <span>{t('ask.thinking')}</span>
      </button>
    {/if}
    {#if caps.search}
      <button
        type="button"
        class="mode-chip"
        class:on={opts.search}
        aria-pressed={opts.search}
        title={t('ask.search')}
        onclick={() => setModelOption(model, { search: !opts.search })}
      >
        <Globe size={13} />
        <span>{t('ask.search')}</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .modes {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .variant-select {
    height: 27px;
    padding: 0 7px;
    border-radius: 999px;
    border: var(--border-w) solid var(--border);
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 550;
  }
  .mode-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 27px;
    padding: 0 9px;
    border-radius: 999px;
    border: var(--border-w) solid var(--border);
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 550;
    transition:
      background var(--dur) var(--ease),
      border-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }
  .mode-chip:hover {
    background: var(--tab-hover);
  }
  .mode-chip.on {
    background: var(--accent-soft);
    border-color: color-mix(in oklab, var(--accent) 45%, transparent);
    color: var(--text);
  }
</style>
