<script lang="ts">
  import { onMount } from 'svelte'
  import X from '@lucide/svelte/icons/x'
  import { ask, t, init, newConversation, focusComposer, focusSearch, copyLastAnswerOfFirstModel, dismissError } from './state.svelte'
  import TitleBar from './TitleBar.svelte'
  import Sidebar from './Sidebar.svelte'
  import ConversationPane from './ConversationPane.svelte'

  let wasNarrow = false

  function syncSidebarForWidth(): void {
    const narrow = window.innerWidth < 720
    if (narrow !== wasNarrow) {
      ask.sidebarOpen = !narrow
      wasNarrow = narrow
    }
  }

  onMount(() => {
    void init()
    syncSidebarForWidth()
  })

  function onKeydown(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    if (mod && !e.shiftKey && key === 'n') {
      e.preventDefault()
      newConversation()
      focusComposer()
    } else if (mod && !e.shiftKey && key === 'f') {
      e.preventDefault()
      focusSearch()
    } else if (mod && e.shiftKey && key === 'c') {
      e.preventDefault()
      copyLastAnswerOfFirstModel()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} onresize={syncSidebarForWidth} onfocus={focusComposer} />

<div class="ask-app">
  <TitleBar />
  <div class="body">
    <Sidebar />
    <ConversationPane />
  </div>
  {#if ask.error}
    <div class="error-line">
      <span>{ask.error}</span>
      <button type="button" class="icon-btn" onclick={dismissError} title={t('ask.close')}><X size={13} /></button>
    </div>
  {/if}
</div>

<style>
  .ask-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: var(--bg);
    overflow: hidden;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .error-line {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: color-mix(in oklab, var(--danger) 14%, var(--surface));
    color: var(--danger);
    font-size: 12px;
    border-top: var(--border-w) solid var(--border);
    flex: none;
  }
  .error-line span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
