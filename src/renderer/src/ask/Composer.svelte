<script lang="ts">
  import ArrowUp from '@lucide/svelte/icons/arrow-up'
  import Square from '@lucide/svelte/icons/square'
  import { ask, t, send, stop, registerComposer, draft, setDraft, isConversationBusy } from './state.svelte'
  import ModelPicker from './ModelPicker.svelte'

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
    const max = Math.max(80, Math.round(window.innerHeight * 0.4))
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
</script>

<div class="composer">
  <ModelPicker />
  <div class="input-row">
    <textarea
      class="input composer-input"
      bind:this={textEl}
      bind:value={text}
      oninput={onInput}
      onkeydown={onKeydown}
      placeholder={t('ask.placeholder')}
      rows="1"
      spellcheck="true"
    ></textarea>
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
    gap: 9px;
    padding: 10px 12px 12px;
    background: var(--surface);
    border: var(--border-w) solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
  }
  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .composer-input {
    flex: 1;
    min-width: 0;
    resize: none;
    max-height: 40vh;
    font-size: 13.5px;
  }
  .send-btn {
    width: 34px;
    height: 34px;
    padding: 0;
    flex: none;
    border-radius: var(--radius);
  }
</style>
