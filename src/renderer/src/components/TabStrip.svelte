<script lang="ts">
  import X from '@lucide/svelte/icons/x'
  import Volume2 from '@lucide/svelte/icons/volume-2'
  import VolumeX from '@lucide/svelte/icons/volume-x'
  import Moon from '@lucide/svelte/icons/moon'
  import Favicon from './Favicon.svelte'
  import { nd, ui } from '../lib/state.svelte'
  import { t } from '../lib/i18n'
  import { profileColor, profileName, serviceName } from '../lib/actions'

  let { vertical = false, collapsed = false }: { vertical?: boolean; collapsed?: boolean } = $props()

  let dragId = $state<string | null>(null)
  let dropIndex = $state<number | null>(null)

  function onPointerDown(e: PointerEvent, id: string) {
    if (e.button === 1) {
      e.preventDefault()
      void nd.invoke('tabs:close', id)
    } else if (e.button === 0) {
      void nd.invoke('tabs:activate', id)
    }
  }

  function onDragStart(e: DragEvent, id: string) {
    dragId = id
    e.dataTransfer?.setData('text/plain', id)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: DragEvent, index: number) {
    if (!dragId) return
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const after = vertical ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2
    dropIndex = after ? index + 1 : index
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    if (dragId !== null && dropIndex !== null) {
      const from = ui.tabs.findIndex((x) => x.id === dragId)
      const to = dropIndex > from ? dropIndex - 1 : dropIndex
      if (to !== from) void nd.invoke('tabs:move', dragId, to)
    }
    dragId = null
    dropIndex = null
  }

  function tooltip(tab: (typeof ui.tabs)[number]): string {
    const parts = [tab.title || tab.url]
    if (ui.settings.profiles.length > 1) parts.push(t('tabs.profile', { name: profileName(tab.profileId) }))
    if (tab.sleeping) parts.push(t('tabs.sleeping'))
    return parts.join('\n')
  }
</script>

<div
  class="strip"
  class:vertical
  class:collapsed
  role="tablist"
  tabindex="-1"
  ondragover={(e) => dragId && e.preventDefault()}
  ondrop={onDrop}
>
  {#each ui.tabs as tab, i (tab.id)}
    {@const active = tab.id === ui.activeId}
    {@const color = profileColor(tab.profileId)}
    <div
      class="tab no-drag"
      class:active
      class:sleeping={tab.sleeping}
      class:dragging={dragId === tab.id}
      class:drop-before={dropIndex === i && dragId !== tab.id}
      class:drop-after={dropIndex === i + 1 && i === ui.tabs.length - 1}
      role="tab"
      tabindex="0"
      aria-selected={active}
      title={tooltip(tab)}
      draggable="true"
      onpointerdown={(e) => onPointerDown(e, tab.id)}
      oncontextmenu={(e) => {
        e.preventDefault()
        void nd.invoke('tabs:menu', tab.id)
      }}
      onkeydown={(e) => e.key === 'Enter' && nd.invoke('tabs:activate', tab.id)}
      ondragstart={(e) => onDragStart(e, tab.id)}
      ondragover={(e) => onDragOver(e, i)}
      ondragend={() => {
        dragId = null
        dropIndex = null
      }}
    >
      {#if color}<span class="profile" style:background={color}></span>{/if}
      <Favicon {tab} />
      {#if !collapsed}
        <span class="title">{tab.title || serviceName(tab.service)}</span>
        {#if tab.sleeping}
          <span class="badge" aria-hidden="true"><Moon size={12} /></span>
        {/if}
        {#if tab.audible || tab.muted}
          <button
            class="mini"
            title={tab.muted ? t('tabs.unmute') : t('tabs.mute')}
            onpointerdown={(e) => e.stopPropagation()}
            onclick={() => nd.invoke('tabs:mute', tab.id)}
          >
            {#if tab.muted}<VolumeX size={13} />{:else}<Volume2 size={13} />{/if}
          </button>
        {/if}
        <button
          class="mini close"
          title={t('tabs.close')}
          onpointerdown={(e) => e.stopPropagation()}
          onclick={() => nd.invoke('tabs:close', tab.id)}
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }
  .strip.vertical {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    overflow-y: auto;
    overflow-x: hidden;
    height: auto;
    padding: 2px 0;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 200px;
    min-width: 40px;
    max-width: 232px;
    height: calc(100% - 10px);
    padding: 0 6px 0 10px;
    border-radius: var(--radius);
    color: var(--text-2);
    transition:
      background var(--dur) var(--ease),
      color var(--dur) var(--ease),
      box-shadow var(--dur) var(--ease),
      opacity var(--dur) var(--ease);
    outline: none;
    cursor: default;
  }
  .vertical .tab {
    flex: none;
    max-width: none;
    height: 34px;
    padding: 0 6px 0 10px;
  }
  :global([data-density='compact']) .vertical .tab {
    height: 30px;
  }
  .collapsed .tab {
    justify-content: center;
    padding: 0;
    height: 38px;
  }
  .tab:hover {
    background: var(--tab-hover);
    color: var(--text);
  }
  .tab.active {
    background: var(--tab-active);
    color: var(--tab-active-text);
  }
  .tab.sleeping:not(.active) {
    opacity: 0.62;
  }
  .tab.dragging {
    opacity: 0.35;
  }
  .tab.drop-before::before,
  .tab.drop-after::after {
    content: '';
    position: absolute;
    background: var(--accent);
    border-radius: 2px;
  }
  .strip:not(.vertical) .tab.drop-before::before {
    left: -2px;
    top: 6px;
    bottom: 6px;
    width: 2px;
  }
  .strip:not(.vertical) .tab.drop-after::after {
    right: -2px;
    top: 6px;
    bottom: 6px;
    width: 2px;
  }
  .vertical .tab.drop-before::before {
    top: -2px;
    left: 8px;
    right: 8px;
    height: 2px;
  }
  .vertical .tab.drop-after::after {
    bottom: -2px;
    left: 8px;
    right: 8px;
    height: 2px;
  }

  .profile {
    position: absolute;
    left: 3px;
    top: 50%;
    width: 3px;
    height: 14px;
    margin-top: -7px;
    border-radius: 3px;
  }

  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 500;
    mask-image: linear-gradient(90deg, #000 calc(100% - 14px), transparent);
  }
  .tab.active .title {
    font-weight: 600;
  }
  .badge {
    display: grid;
    place-items: center;
    color: var(--text-3);
  }
  .mini {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    color: var(--text-2);
    flex: none;
  }
  .mini:hover {
    background: var(--tab-hover);
    color: var(--text);
  }
  .close {
    opacity: 0;
  }
  .tab:hover .close,
  .tab.active .close {
    opacity: 1;
  }
  .strip:not(.vertical) .tab:not(.active):not(:hover) .title {
    mask-image: linear-gradient(90deg, #000 calc(100% - 20px), transparent);
  }

  /* ---- tab styles */
  :global([data-tab-style='pill']) .tab.active {
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.06),
      0 0 0 var(--border-w) var(--border);
  }
  :global([data-tab-style='pill'][data-surface='glass']) .tab.active {
    backdrop-filter: blur(12px) saturate(1.8);
    -webkit-backdrop-filter: blur(12px) saturate(1.8);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 1px 2px rgba(0, 0, 0, 0.06),
      0 0 0 var(--border-w) var(--border);
  }

  :global([data-theme='aurora']) .strip {
    background: linear-gradient(120deg, color-mix(in oklab, var(--accent) 10%, transparent), transparent 60%);
    border-radius: var(--radius);
  }

  :global([data-tab-style='underline']) .strip:not(.vertical) .tab {
    border-radius: var(--radius) var(--radius) 0 0;
  }
  :global([data-tab-style='underline']) .tab.active {
    background: transparent;
  }
  :global([data-tab-style='underline']) .strip:not(.vertical) .tab.active::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: -1px;
    height: 2px;
    border-radius: 2px;
    background: var(--accent);
  }
  :global([data-tab-style='underline']) .vertical .tab.active {
    background: var(--tab-active);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  :global([data-tab-style='card']) .strip:not(.vertical) .tab {
    height: calc(100% - 6px);
    align-self: flex-end;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  :global([data-tab-style='card'][data-floating='true']) .strip:not(.vertical) .tab.active {
    background: var(--surface);
    box-shadow: none;
  }
  :global([data-tab-style='card'][data-floating='true']) .strip:not(.vertical) .tab.active::before,
  :global([data-tab-style='card'][data-floating='true']) .strip:not(.vertical) .tab.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    width: var(--radius-lg);
    height: var(--radius-lg);
    background: transparent;
    pointer-events: none;
  }
  :global([data-tab-style='card'][data-floating='true']) .strip:not(.vertical) .tab.active::before {
    left: calc(-1 * var(--radius-lg));
    border-bottom-right-radius: var(--radius-lg);
    box-shadow: calc(var(--radius-lg) / 2) calc(var(--radius-lg) / 2) 0 calc(var(--radius-lg) / 2) var(--surface);
  }
  :global([data-tab-style='card'][data-floating='true']) .strip:not(.vertical) .tab.active::after {
    right: calc(-1 * var(--radius-lg));
    border-bottom-left-radius: var(--radius-lg);
    box-shadow: calc(var(--radius-lg) / -2) calc(var(--radius-lg) / 2) 0 calc(var(--radius-lg) / 2) var(--surface);
  }

  :global([data-tab-style='brutal']) .tab {
    border: 2px solid transparent;
    font-weight: 700;
  }
  :global([data-tab-style='brutal']) .tab:hover {
    border-color: var(--border);
  }
  :global([data-tab-style='brutal']) .tab.active {
    border-color: var(--border);
    box-shadow: 3px 3px 0 var(--border);
    transform: translate(-1px, -1px);
  }
</style>
