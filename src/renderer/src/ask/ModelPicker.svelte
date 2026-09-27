<script lang="ts">
  // The composer's model button: shows the current selection and opens a popover listing every
  // enabled model. Clicking a row switches to that model alone; its checkbox adds or removes it
  // from the comparison instead.
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import ServiceIcon from '../components/ServiceIcon.svelte'
  import { MODEL_IDS, SERVICES } from '@shared/services'
  import { MAX_COMPARE_MODELS, type ModelId } from '@shared/ask'
  import { ask, t, activeModels, toggleModel, selectOnlyModel, modelStatus, loginModel } from './state.svelte'
  import { modelButtonLabel } from '@shared/askFormat'

  let open = $state(false)
  let rootEl: HTMLDivElement | undefined = $state()

  const selected = $derived(activeModels())
  const models = $derived(MODEL_IDS.filter((m) => ask.enabledModels.includes(m)))
  const label = $derived(modelButtonLabel(selected, (n) => t('ask.modelsMore', { n })))

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

  function pickOnly(model: ModelId): void {
    selectOnlyModel(model)
    open = false
  }

  function onCheck(e: Event, model: ModelId): void {
    e.stopPropagation()
    toggleModel(model)
  }

  function onSignIn(e: MouseEvent | KeyboardEvent, model: ModelId): void {
    e.stopPropagation()
    loginModel(model)
  }

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

<div class="model-picker" bind:this={rootEl}>
  <button type="button" class="model-trigger" aria-expanded={open} onclick={() => (open = !open)}>
    {#if selected[0]}<ServiceIcon service={selected[0]} size={15} />{/if}
    <span class="trigger-label">{label}</span>
    <ChevronDown size={13} />
  </button>
  {#if open}
    <div class="popover panel" onkeydown={onKeydown} role="menu" tabindex="-1">
      {#each models as model (model)}
        {@const status = modelStatus(model)}
        {@const isOn = selected.includes(model)}
        <div class="model-row" class:on={isOn}>
          <button type="button" class="row-main" title={tooltipFor(model)} onclick={() => pickOnly(model)}>
            <ServiceIcon service={model} size={15} />
            <span class="row-name">{SERVICES[model].name}</span>
            <span class="dot {dotClass(model)}"></span>
            {#if status?.state === 'signed-out'}
              <span
                class="signin"
                role="link"
                tabindex="0"
                onclick={(e) => onSignIn(e, model)}
                onkeydown={(e) => e.key === 'Enter' && onSignIn(e, model)}
              >
                {t('ask.signInShort')}
              </span>
            {/if}
          </button>
          <input
            type="checkbox"
            class="compare-check"
            checked={isOn}
            aria-label={t('ask.compareToggle', { name: SERVICES[model].name })}
            disabled={(isOn && selected.length <= 1) || (!isOn && selected.length >= MAX_COMPARE_MODELS)}
            onclick={(e) => onCheck(e, model)}
          />
        </div>
      {/each}
      <div class="hint faint">{t('ask.maxModels', { n: MAX_COMPARE_MODELS })}</div>
    </div>
  {/if}
</div>

<style>
  .model-picker {
    position: relative;
    flex: none;
  }
  .model-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 9px 0 8px;
    border-radius: 999px;
    border: var(--border-w) solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 12.5px;
    font-weight: 600;
    max-width: 220px;
    transition:
      background var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .model-trigger:hover {
    background: var(--tab-hover);
  }
  .trigger-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 5;
    width: max-content;
    min-width: 230px;
    max-width: min(320px, calc(100vw - 24px));
    padding: 6px;
    animation: nd-pop-in 140ms var(--ease);
  }
  .model-row {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--radius);
  }
  .model-row:hover,
  .model-row.on {
    background: var(--tab-hover);
  }
  .row-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 6px 0 8px;
    text-align: left;
  }
  .row-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    font-weight: 550;
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
  .signin {
    flex: none;
    font-size: 11px;
    font-weight: 650;
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .compare-check {
    flex: none;
    width: 16px;
    height: 16px;
    margin-right: 8px;
    accent-color: var(--accent);
  }
  .hint {
    padding: 6px 8px 2px;
    font-size: 11px;
  }
</style>
