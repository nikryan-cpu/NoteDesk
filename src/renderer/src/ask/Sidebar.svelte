<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus'
  import Search from '@lucide/svelte/icons/search'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import LoaderCircle from '@lucide/svelte/icons/loader-circle'
  import ServiceIcon from '../components/ServiceIcon.svelte'
  import type { AskConversationSummary } from '@shared/ask'
  import { ask, t, nd, newConversation, selectConversation, registerSearch, renameConversation, togglePin, deleteConversation } from './state.svelte'

  let renamingId = $state<string | null>(null)
  let renameText = $state('')
  let cancelling = false
  let renameInputEl: HTMLInputElement | undefined = $state()
  let searchInputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    registerSearch(searchInputEl ?? null)
    return () => registerSearch(null)
  })

  function dayStart(ms: number): number {
    const d = new Date(ms)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }

  const filtered = $derived.by(() => {
    const q = ask.search.trim().toLowerCase()
    if (!q) return ask.conversations
    return ask.conversations.filter((c) => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))
  })

  const groups = $derived.by(() => {
    const todayStart = dayStart(Date.now())
    const yesterdayStart = todayStart - 86400000
    const pinned: AskConversationSummary[] = []
    const today: AskConversationSummary[] = []
    const yesterday: AskConversationSummary[] = []
    const earlier: AskConversationSummary[] = []
    for (const c of filtered) {
      if (c.pinned) pinned.push(c)
      else if (c.updatedAt >= todayStart) today.push(c)
      else if (c.updatedAt >= yesterdayStart) yesterday.push(c)
      else earlier.push(c)
    }
    const byRecent = (a: AskConversationSummary, b: AskConversationSummary): number => b.updatedAt - a.updatedAt
    pinned.sort(byRecent)
    today.sort(byRecent)
    yesterday.sort(byRecent)
    earlier.sort(byRecent)
    return [
      { key: 'pinned', label: t('ask.group.pinned'), items: pinned },
      { key: 'today', label: t('ask.group.today'), items: today },
      { key: 'yesterday', label: t('ask.group.yesterday'), items: yesterday },
      { key: 'earlier', label: t('ask.group.earlier'), items: earlier },
    ].filter((g) => g.items.length)
  })

  function startRename(item: AskConversationSummary): void {
    renamingId = item.id
    renameText = item.title
    queueMicrotask(() => renameInputEl?.focus())
  }

  function cancelRename(): void {
    cancelling = true
    renamingId = null
  }

  function commitRename(): void {
    if (cancelling) {
      cancelling = false
      return
    }
    if (renamingId) renameConversation(renamingId, renameText)
    renamingId = null
  }

  function onRenameKeydown(e: KeyboardEvent): void {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }

  async function confirmDelete(item: AskConversationSummary): Promise<void> {
    const id = await nd.invoke('menu:popup', [{ id: 'confirm', label: t('ask.deleteConfirm') }])
    if (id === 'confirm') deleteConversation(item.id)
  }

  async function openMenu(item: AskConversationSummary): Promise<void> {
    const id = await nd.invoke('menu:popup', [
      { id: 'rename', label: t('ask.rename') },
      { id: 'pin', label: item.pinned ? t('ask.unpin') : t('ask.pin') },
      { type: 'separator' },
      { id: 'delete', label: t('ask.delete') },
    ])
    if (id === 'rename') startRename(item)
    else if (id === 'pin') togglePin(item.id, !item.pinned)
    else if (id === 'delete') void confirmDelete(item)
  }

  function onContextMenu(e: MouseEvent, item: AskConversationSummary): void {
    e.preventDefault()
    void openMenu(item)
  }
</script>

<div class="sidebar" class:collapsed={!ask.sidebarOpen}>
  <div class="new-row">
    <button type="button" class="btn primary new-btn" onclick={() => newConversation()}>
      <Plus size={15} />
      <span class="new-label">{t('ask.newConversation')}</span>
      <span class="kbd">{nd.platform === 'darwin' ? '⌘N' : 'Ctrl+N'}</span>
    </button>
  </div>

  <div class="search-row">
    <Search size={14} />
    <input
      class="search-input"
      bind:this={searchInputEl}
      bind:value={ask.search}
      placeholder={t('ask.searchPlaceholder')}
      spellcheck="false"
      autocomplete="off"
    />
  </div>

  <div class="list">
    {#if ask.conversations.length === 0}
      <div class="empty faint">{t('ask.empty')}</div>
    {:else if groups.length === 0}
      <div class="empty faint">{t('ask.noMatches')}</div>
    {:else}
      {#each groups as group (group.key)}
        <div class="group-label">{group.label}</div>
        {#each group.items as item (item.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="item-row" class:active={ask.current?.id === item.id} oncontextmenu={(e) => onContextMenu(e, item)}>
            {#if renamingId === item.id}
              <input
                class="rename-input"
                bind:this={renameInputEl}
                bind:value={renameText}
                onkeydown={onRenameKeydown}
                onblur={commitRename}
                spellcheck="false"
                autocomplete="off"
              />
            {:else}
              <button type="button" class="item-btn" onclick={() => selectConversation(item.id)}>
                <div class="item-main">
                  <span class="item-title">{item.title || t('ask.newConversation')}</span>
                  {#if item.preview}<span class="item-preview faint">{item.preview}</span>{/if}
                </div>
                <div class="item-meta">
                  {#if item.busy}<LoaderCircle size={13} class="spin" />{/if}
                  <div class="model-icons">
                    {#each item.models.slice(0, 4) as m (m)}<ServiceIcon service={m} size={12} />{/each}
                  </div>
                </div>
              </button>
              <button
                type="button"
                class="menu-btn icon-btn"
                title={t('ask.moreActions')}
                onclick={(e) => {
                  e.stopPropagation()
                  void openMenu(item)
                }}
              >
                <Ellipsis size={14} />
              </button>
            {/if}
          </div>
        {/each}
      {/each}
    {/if}
  </div>
</div>

<style>
  .sidebar {
    width: 252px;
    min-width: 252px;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-right: var(--border-w) solid var(--border);
    transition:
      width var(--dur) var(--ease),
      min-width var(--dur) var(--ease),
      opacity var(--dur) var(--ease);
    overflow: hidden;
  }
  .sidebar.collapsed {
    width: 0;
    min-width: 0;
    opacity: 0;
    pointer-events: none;
    border-right: none;
  }

  .new-row {
    padding: 10px 10px 6px;
    flex: none;
  }
  .new-btn {
    width: 100%;
    justify-content: flex-start;
    gap: 8px;
  }
  .new-label {
    flex: 1;
    text-align: left;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 10px 8px;
    padding: 0 10px;
    height: 32px;
    border-radius: var(--radius);
    border: var(--border-w) solid var(--border);
    background: var(--surface-2);
    color: var(--text-3);
    flex: none;
  }
  .search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font-size: 12.5px;
  }
  .search-input::placeholder {
    color: var(--text-3);
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 8px 10px;
  }
  .empty {
    padding: 30px 12px;
    text-align: center;
    font-size: 12.5px;
  }

  .group-label {
    padding: 10px 8px 4px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .group-label:first-child {
    padding-top: 4px;
  }

  .item-row {
    display: flex;
    align-items: center;
    border-radius: var(--radius);
    transition: background var(--dur) var(--ease);
  }
  .item-row.active {
    background: var(--accent-softer);
    box-shadow: inset 0 0 0 1px var(--accent-soft);
  }
  .item-row:hover:not(.active) {
    background: var(--tab-hover);
  }
  .item-btn {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 6px 7px 9px;
    text-align: left;
  }
  .item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .item-title {
    font-size: 12.5px;
    font-weight: 560;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item-preview {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    flex: none;
  }
  .model-icons {
    display: flex;
    gap: 2px;
  }
  .menu-btn {
    flex: none;
    width: 24px;
    height: 24px;
    margin-right: 4px;
    opacity: 0;
  }
  .item-row:hover .menu-btn,
  .item-row:focus-within .menu-btn {
    opacity: 1;
  }

  .rename-input {
    flex: 1;
    margin: 4px 8px;
    height: 26px;
    padding: 0 8px;
    border-radius: var(--radius);
    border: var(--border-w) solid color-mix(in oklab, var(--accent) 55%, var(--border));
    background: var(--surface);
    color: var(--text);
    font-size: 12.5px;
    outline: none;
  }

  :global(.spin) {
    animation: nd-spin 0.9s linear infinite;
    flex: none;
    color: var(--text-3);
  }
</style>
