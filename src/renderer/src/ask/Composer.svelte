<script lang="ts">
  import ArrowUp from '@lucide/svelte/icons/arrow-up'
  import Square from '@lucide/svelte/icons/square'
  import { ask, t, send, stop, registerComposer, draft, setDraft, isConversationBusy, activeModels } from './state.svelte'
  import ModelPicker from './ModelPicker.svelte'
  import ModelModes from './ModelModes.svelte'
  import ModesPopover from './ModesPopover.svelte'

  const MAX_ROWS = 10

  let textEl: HTMLTextAreaElement | undefined = $state()
  let text = $state(draft())
  let lastKey: string | null = null

  $effect(() => {
    registerComposer(textEl ?? null)
    return () => registerComposer(null)
  })

  // Each conversation (and the new-conversation screen) keeps its own draft.
  $effect(() => {
    const key = ask.current?.id ?? 'new'
    if (key === lastKey) return
    lastKey = key
    text = draft()
    resize()
  })

  function resize(): void {
    if (!textEl) return
    textEl.style.height = 'auto'
    const cs = getComputedStyle(textEl)
    const lineHeight = parseFloat(cs.lineHeight) || 20
    const vPadding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const max = lineHeight * MAX_ROWS + vPadding
    textEl.style.height = `${Math.min(textEl.scrollHeight, max)}px`
  }

  function onInput(): void {
    setDraft(text)
    resize()
  }

  function submit(): void {
    if (!text.trim() || busy) return
    void send(text)
    text = ''
    setDraft('')
    resize()
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.isComposing) return
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const busy = $derived(isConversationBusy(ask.current))
  const models = $derived(activeModels())
</script>

<div class="composer panel">
  <textarea
    class="composer-input"
    bind:this={textEl}
    bind:value={text}
    oninput={onInput}
    onkeydown={onKeydown}
    placeholder={t('ask.placeholder')}
    rows="1"
    spellcheck="true"
  ></textarea>
  <div class="footer">
    <div class="footer-left">
      <ModelPicker />
      {#if models.length === 1 && models[0]}
        <ModelModes model={models[0]} />
      {:else if models.length > 1}
        <ModesPopover {models} />
      {/if}
    </div>
    {#if busy}
      <button type="button" class="btn primary send-btn" title={t('ask.stop')} onclick={stop}>
        <Square size={15} />
      </button>
    {:else}
      <button type="button" class="btn primary send-btn" title={t('ask.send')} disabled={!text.trim()} onclick={submit}>
        <ArrowUp size={16} />
      </button>
    {/if}
  </div>
</div>

<style>
  .composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    padding: 10px 12px 10px;
    background: var(--surface);
    border: var(--border-w) solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
  }
  .composer-input {
    resize: none;
    font-size: 13.5px;
    line-height: 1.5;
    border: none;
    outline: none;
    padding: 2px 2px 4px;
    background: transparent;
    color: var(--text);
  }
  .composer-input:focus,
  .composer-input:focus-visible {
    box-shadow: none;
    outline: none;
  }
  .composer-input::placeholder {
    color: var(--text-3);
  }
  .footer {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .footer-left {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .send-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    flex: none;
    border-radius: var(--radius);
  }
</style>
