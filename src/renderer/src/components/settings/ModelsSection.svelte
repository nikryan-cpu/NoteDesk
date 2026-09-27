<script lang="ts">
  // One row per chat service: sign-in status, a "Sign in" button and an on/off toggle that
  // controls whether the service shows up in menus and the Ask window.
  import LogIn from '@lucide/svelte/icons/log-in'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Zap from '@lucide/svelte/icons/zap'
  import { MAX_COMPARE_MODELS, type ModelState, type ModelStatus } from '@shared/ask'
  import { MODEL_IDS, SERVICES, type ModelId } from '@shared/services'
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import Toggle from './Toggle.svelte'
  import ServiceIcon from '../ServiceIcon.svelte'
  import { nd, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'
  import { serviceName } from '../../lib/actions'
  import { acceleratorKeys } from '../../lib/shortcuts'

  let statuses = $state<Partial<Record<ModelId, ModelStatus>>>({})
  let checking = $state(false)

  function applyStatuses(list: ModelStatus[]) {
    const next = { ...statuses }
    for (const s of list) next[s.id] = s
    statuses = next
  }

  $effect(() => {
    void nd
      .invoke('ask:models')
      .then(applyStatuses)
      .catch(() => {})
  })

  $effect(() => {
    return nd.on('ask-models', (list) => applyStatuses(list))
  })

  async function checkAll() {
    checking = true
    try {
      applyStatuses(await nd.invoke('ask:checkModels'))
    } catch {
      // another agent's engine may still be starting up; statuses just stay as they were
    } finally {
      checking = false
    }
  }

  function signIn(id: ModelId) {
    void nd.invoke('ask:login', id).catch(() => {})
  }

  function statusOf(id: ModelId): ModelStatus {
    return statuses[id] ?? { id, state: 'unknown', checkedAt: 0 }
  }

  function statusLabel(state: ModelState): string {
    if (state === 'ready') return t('models.statusReady')
    if (state === 'signed-out') return t('models.statusSignedOut')
    if (state === 'needs-action') return t('models.statusNeedsAction')
    if (state === 'error') return t('models.statusError')
    return t('models.statusUnknown')
  }

  function setEnabled(id: ModelId, on: boolean) {
    if (id === 'gemini') return
    const enabled = new Set(ui.settings.enabledModels)
    if (on) enabled.add(id)
    else enabled.delete(id)
    const enabledModels = MODEL_IDS.filter((m) => m !== 'gemini' && enabled.has(m))
    let askModels = ui.settings.askModels
    if (!on && askModels.includes(id)) {
      askModels = askModels.filter((m) => m !== id)
      if (askModels.length === 0) askModels = ['gemini']
    }
    setSettings({ enabledModels, askModels })
  }

  const askOptions = $derived(MODEL_IDS.filter((id) => id === 'gemini' || ui.settings.enabledModels.includes(id)))

  function toggleAskModel(id: ModelId) {
    const cur = ui.settings.askModels
    if (cur.includes(id)) {
      if (cur.length <= 1) return
      setSettings({ askModels: cur.filter((m) => m !== id) })
    } else {
      if (cur.length >= MAX_COMPARE_MODELS) return
      setSettings({ askModels: [...cur, id] })
    }
  }
</script>

<p class="hint muted">{t('models.hint')}</p>

<Group heading={t('models.title')}>
  {#each MODEL_IDS as id (id)}
    {@const svc = SERVICES[id]}
    {@const status = statusOf(id)}
    {@const enabled = id === 'gemini' || ui.settings.enabledModels.includes(id)}
    <div class="model-row">
      <div class="main">
        <ServiceIcon service={id} size={22} />
        <div class="names">
          <span class="name">{svc.name}</span>
          <span class="vendor faint">{svc.vendor}</span>
        </div>
        <span class="chip {status.state}" title={status.detail ?? ''}>{statusLabel(status.state)}</span>
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" onclick={() => signIn(id)}>
          <LogIn size={14} />
          {t('models.signIn')}
        </button>
        <Toggle checked={enabled} disabled={id === 'gemini'} label={svc.name} onchange={(v) => setEnabled(id, v)} />
      </div>
    </div>
  {/each}
</Group>

<button type="button" class="btn" disabled={checking} onclick={checkAll}>
  <RefreshCw size={14} class={checking ? 'spin' : ''} />
  {checking ? t('models.checking') : t('models.checkAll')}
</button>

<Group heading={t('models.askGroup')}>
  <Row label={t('models.defaultModels')} hint={t('models.defaultModelsHint')}>
    <div class="chips">
      {#each askOptions as id (id)}
        {@const on = ui.settings.askModels.includes(id)}
        <button
          type="button"
          class="model-chip"
          class:on
          disabled={on ? ui.settings.askModels.length <= 1 : ui.settings.askModels.length >= MAX_COMPARE_MODELS}
          onclick={() => toggleAskModel(id)}
        >
          <ServiceIcon service={id} size={14} />
          {serviceName(id)}
        </button>
      {/each}
    </div>
  </Row>
  <Row label={t('models.hotkey')}>
    <span class="hotkey">
      {#each acceleratorKeys(ui.settings.hotkeys.quickAsk, ui.platform) as key (key)}
        <span class="kbd">{key}</span>
      {/each}
    </span>
    <button type="button" class="btn ghost" onclick={() => nd.invoke('quick:action', 'show')}>
      <Zap size={14} />
      {t('models.openWindow')}
    </button>
  </Row>
</Group>

<style>
  .hint {
    font-size: 12px;
  }
  .model-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 14px;
  }
  .main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .names {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .name {
    font-weight: 550;
  }
  .vendor {
    font-size: 11px;
  }
  .chip {
    flex: none;
    font-size: 11px;
    font-weight: 650;
    padding: 3px 9px;
    border-radius: 999px;
    white-space: nowrap;
    background: var(--surface-2);
    color: var(--text-2);
  }
  .chip.ready {
    background: color-mix(in oklab, var(--success) 16%, transparent);
    color: var(--success);
  }
  .chip.signed-out,
  .chip.needs-action {
    background: color-mix(in oklab, var(--warning) 16%, transparent);
    color: var(--warning);
  }
  .chip.error {
    background: color-mix(in oklab, var(--danger) 14%, transparent);
    color: var(--danger);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .btn :global(.spin) {
    animation: nd-spin 0.9s linear infinite;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .model-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    border: var(--border-w) solid var(--border);
    color: var(--text-2);
    font-weight: 550;
    transition:
      background var(--dur) var(--ease),
      color var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .model-chip:hover:not(:disabled) {
    background: var(--tab-hover);
    color: var(--text);
  }
  .model-chip.on {
    background: var(--accent-soft);
    border-color: color-mix(in oklab, var(--accent) 45%, transparent);
    color: var(--text);
  }
  .model-chip:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .hotkey {
    display: flex;
    gap: 3px;
  }

  :global([data-density='compact']) .model-row {
    padding: 8px 14px;
  }
</style>
