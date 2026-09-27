<script lang="ts">
  // Slim header for the Ask tab: no window chrome (the shell's own title bar and tab strip sit
  // above this), just the sidebar toggle, the conversation's editable title and a way to start
  // a fresh one.
  import Plus from '@lucide/svelte/icons/plus'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close'
  import { ask, t, newConversation, focusComposer, renameConversation } from './state.svelte'

  let renaming = $state(false)
  let renameText = $state('')
  let cancelling = false
  let inputEl: HTMLInputElement | undefined = $state()

  const titleText = $derived(ask.current ? ask.current.title : t('ask.title'))

  function startRename(): void {
    if (!ask.current) return
    renameText = ask.current.title
    renaming = true
    queueMicrotask(() => inputEl?.focus())
  }

  function cancel(): void {
    cancelling = true
    renaming = false
  }

  function commit(): void {
    if (cancelling) {
      cancelling = false
      return
    }
    if (ask.current) renameConversation(ask.current.id, renameText)
    renaming = false
  }

  function onInputKeydown(e: KeyboardEvent): void {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  function toggleSidebar(): void {
    ask.sidebarOpen = !ask.sidebarOpen
  }

  function startNew(): void {
    newConversation()
    focusComposer()
  }
</script>

<div class="title-bar">
  <button type="button" class="icon-btn" title={t('ask.toggleSidebar')} onclick={toggleSidebar}>
    {#if ask.sidebarOpen}<PanelLeftClose size={15} />{:else}<PanelLeft size={15} />{/if}
  </button>
  {#if renaming}
    <input
      class="title-input"
      bind:this={inputEl}
      bind:value={renameText}
      onkeydown={onInputKeydown}
      onblur={commit}
      spellcheck="false"
      autocomplete="off"
    />
  {:else}
    <button
      type="button"
      class="title-text"
      class:clickable={!!ask.current}
      disabled={!ask.current}
      onclick={startRename}
      title={ask.current ? t('ask.rename') : ''}
    >
      {titleText}
    </button>
  {/if}
  <div class="spacer"></div>
  <button type="button" class="icon-btn" title={t('ask.newConversation')} onclick={startNew}>
    <Plus size={16} />
  </button>
</div>

<style>
  .title-bar {
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 8px;
    gap: 6px;
    background: var(--surface);
    border-bottom: var(--border-w) solid var(--border);
    flex: none;
  }
  .title-text,
  .title-input {
    min-width: 0;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    font-size: 12.5px;
    color: var(--text);
    text-align: left;
    background: transparent;
    border: none;
    padding: 4px 7px;
    border-radius: var(--radius);
  }
  .title-text.clickable:hover {
    background: var(--tab-hover);
    cursor: pointer;
  }
  .title-text:disabled {
    cursor: default;
  }
  .title-input {
    outline: none;
    box-shadow: var(--ring);
    background: var(--surface-2);
  }
  .spacer {
    flex: 1;
  }
</style>
