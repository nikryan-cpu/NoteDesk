<script lang="ts">
  import ServiceIcon from '../components/ServiceIcon.svelte'
  import { MODEL_IDS, SERVICES } from '@shared/services'
  import { MAX_COMPARE_MODELS, type ModelId } from '@shared/ask'
  import { ask, t, activeModels, toggleModel, selectOnlyModel, modelStatus } from './state.svelte'

  const selected = $derived(activeModels())
  const models = $derived(MODEL_IDS.filter((m) => ask.enabledModels.includes(m)))

  function dotClass(model: ModelId): string {
    const s = modelStatus(model)?.state ?? 'unknown'
    if (s === 'ready') return 'ok'
    if (s === 'signed-out' || s === 'error') return 'bad'
    return 'warn'
  }

  function tooltipFor(model: ModelId): string {
    const status = modelStatus(model)
    const state = status?.state ?? 'unknown'
    const base = `${SERVICES[model].name} — ${t(`ask.status.${state}`)}`
    return status?.detail ? `${base} (${status.detail})` : base
  }
</script>

<div class="model-picker">
  <div class="chips">
    {#each models as model (model)}
      <button
        type="button"
        class="chip"
        class:selected={selected.includes(model)}
        title={tooltipFor(model)}
        onclick={() => toggleModel(model)}
        ondblclick={() => selectOnlyModel(model)}
      >
        <ServiceIcon service={model} size={14} />
        <span>{SERVICES[model].name}</span>
        <span class="dot {dotClass(model)}"></span>
      </button>
    {/each}
  </div>
  <span class="hint faint">{t('ask.maxModels', { n: MAX_COMPARE_MODELS })}</span>
</div>

<style>
  .model-picker {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 27px;
    padding: 0 9px 0 8px;
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
  .chip:hover {
    background: var(--tab-hover);
  }
  .chip.selected {
    background: var(--accent-soft);
    border-color: color-mix(in oklab, var(--accent) 45%, transparent);
    color: var(--text);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
  }
  .dot.ok {
    background: var(--success);
  }
  .dot.warn {
    background: var(--warning);
  }
  .dot.bad {
    background: var(--danger);
  }
  .hint {
    font-size: 11px;
    white-space: nowrap;
  }
</style>
