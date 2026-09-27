<script lang="ts">
  import Pin from '@lucide/svelte/icons/pin'
  import PinOff from '@lucide/svelte/icons/pin-off'
  import AppWindow from '@lucide/svelte/icons/app-window'
  import X from '@lucide/svelte/icons/x'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import PanelLeftClose from '@lucide/svelte/icons/panel-left-close'
  import logo from '../assets/logo-small.svg'
  import { ask, t, windowAction, renameConversation } from './state.svelte'

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
</script>

<div class="title-bar drag">
  <button type="button" class="icon-btn no-drag" title={t('ask.toggleSidebar')} onclick={toggleSidebar}>
    {#if ask.sidebarOpen}<PanelLeftClose size={15} />{:else}<PanelLeft size={15} />{/if}
  </button>
  <img class="mark" src={logo} alt="" draggable="false" />
  {#if renaming}
    <input
      class="title-input no-drag"
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
      class="title-text no-drag"
      class:clickable={!!ask.current}
      disabled={!ask.current}
      onclick={startRename}
      title={ask.current ? t('ask.rename') : ''}
    >
      {titleText}
    </button>
  {/if}
  <div class="spacer"></div>
  <div class="actions no-drag">
    <button
      type="button"
      class="icon-btn"
      class:active={ask.quick.pinned}
      title={t('ask.pinWindow')}
      aria-pressed={ask.quick.pinned}
      onclick={() => windowAction('pin')}
    >
      {#if ask.quick.pinned}<PinOff size={15} />{:else}<Pin size={15} />{/if}
    </button>
    <button type="button" class="icon-btn" title={t('ask.openMain')} onclick={() => windowAction('openInMain')}>
      <AppWindow size={15} />
    </button>
    <button type="button" class="icon-btn" title={t('ask.close')} onclick={() => windowAction('close')}>
      <X size={15} />
    </button>
  </div>
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
  .mark {
    width: 17px;
    height: 17px;
    flex: none;
  }
  .title-text,
  .title-input {
    min-width: 0;
    max-width: 42%;
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
  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }
  .icon-btn.active {
    color: var(--accent);
    background: var(--accent-soft);
  }
</style>
