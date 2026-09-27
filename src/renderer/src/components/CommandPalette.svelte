<script lang="ts">
  // Unified launcher: jump to a tab, revisit something recent, run a shell command, drop in a
  // prompt or switch theme, all from one fuzzy-filtered list. '>' / '/' / '@' narrow the scope.
  import { onMount } from 'svelte'
  import type { HistoryEntry, PromptSnippet, TabInfo } from '@shared/ipc'
  import { fuzzyMatch } from '@shared/text'
  import { historyKey } from '@shared/services'
  import { THEME_IDS, THEMES } from '@shared/themes'
  import Search from '@lucide/svelte/icons/search'
  import BookOpen from '@lucide/svelte/icons/book-open'
  import Sparkles from '@lucide/svelte/icons/sparkles'
  import History from '@lucide/svelte/icons/history'
  import X from '@lucide/svelte/icons/x'
  import RotateCw from '@lucide/svelte/icons/rotate-cw'
  import ZoomIn from '@lucide/svelte/icons/zoom-in'
  import ZoomOut from '@lucide/svelte/icons/zoom-out'
  import Percent from '@lucide/svelte/icons/percent'
  import Copy from '@lucide/svelte/icons/copy'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import Moon from '@lucide/svelte/icons/moon'
  import Focus from '@lucide/svelte/icons/focus'
  import SunMoon from '@lucide/svelte/icons/sun-moon'
  import PanelsTopLeft from '@lucide/svelte/icons/panels-top-left'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line'
  import MemoryStick from '@lucide/svelte/icons/memory-stick'
  import Keyboard from '@lucide/svelte/icons/keyboard'
  import Settings2 from '@lucide/svelte/icons/settings-2'
  import MessageSquareText from '@lucide/svelte/icons/message-square-text'
  import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Zap from '@lucide/svelte/icons/zap'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import Palette from '@lucide/svelte/icons/palette'
  import Check from '@lucide/svelte/icons/check'
  import Favicon from './Favicon.svelte'
  import { activeTab, closeOverlay, isDark, nd, openOverlay, openSettings, setSettings, ui } from '../lib/state.svelte'
  import { newTab, profileName } from '../lib/actions'
  import { t } from '../lib/i18n'
  import { keyLabel } from '../lib/shortcuts'

  let { mode = 'all' }: { mode?: 'all' | 'prompts' } = $props()

  interface PaletteItem {
    id: string
    section: 'tabs' | 'recent' | 'commands' | 'prompts' | 'themes'
    label: string
    secondary?: string
    icon?: typeof Search
    tab?: TabInfo
    dot?: string
    sleeping?: boolean
    checked?: boolean
    combo?: string[]
    run: () => void
  }
  type RankedItem = PaletteItem & { hits: number[] }

  let query = $state('')
  let selected = $state(0)
  let history = $state<HistoryEntry[]>([])
  let prompts = $state<PromptSnippet[]>([])
  let inputEl: HTMLInputElement | undefined = $state()
  let listEl: HTMLDivElement | undefined = $state()

  onMount(() => {
    inputEl?.focus()
    void nd.invoke('history:list').then((h) => (history = h))
    void nd.invoke('prompts:list').then((p) => (prompts = p))
  })

  // Reset the search whenever the palette switches between the 'all' and 'prompts' overlays.
  $effect(() => {
    void mode
    query = ''
    selected = 0
  })

  function openRecent(entry: HistoryEntry): void {
    const key = historyKey(entry.url)
    const open = ui.tabs.find((tb) => historyKey(tb.url) === key)
    if (open) void nd.invoke('tabs:activate', open.id)
    else void nd.invoke('tabs:create', { url: entry.url, profileId: entry.profileId })
  }

  function refocus(): void {
    inputEl?.focus()
  }

  const active = $derived(activeTab())
  const vertical = $derived(ui.settings.tabLayout === 'vertical')
  const multiProfile = $derived(ui.settings.profiles.length > 1)

  const tabItems: PaletteItem[] = $derived(
    ui.tabs.map((tb) => ({
      id: `tab-${tb.id}`,
      section: 'tabs',
      label: tb.title || t(tb.service === 'gemini' ? 'service.gemini' : 'service.notebook'),
      secondary: multiProfile ? profileName(tb.profileId) : undefined,
      tab: tb,
      sleeping: tb.sleeping,
      run: () => {
        closeOverlay()
        void nd.invoke('tabs:activate', tb.id)
      },
    })),
  )

  const recentItems: PaletteItem[] = $derived(
    history.map((h) => {
      const kind = t(h.kind === 'notebook' ? 'palette.recentNotebook' : 'palette.recentChat')
      const parts = multiProfile ? [kind, profileName(h.profileId)] : [kind]
      return {
        id: `recent-${h.key}`,
        section: 'recent',
        label: h.title || h.url,
        secondary: parts.join(' · '),
        icon: h.kind === 'notebook' ? BookOpen : Sparkles,
        run: () => {
          closeOverlay()
          openRecent(h)
        },
      }
    }),
  )

  const commandItems: PaletteItem[] = $derived.by(() => {
    const list: PaletteItem[] = []

    list.push({
      id: 'cmd-new-notebook',
      section: 'commands',
      label: t('action.newNotebook'),
      icon: BookOpen,
      combo: ['Mod', 'T'],
      run: () => {
        closeOverlay()
        newTab('notebook')
      },
    })
    list.push({
      id: 'cmd-new-gemini',
      section: 'commands',
      label: t('action.newGemini'),
      icon: Sparkles,
      combo: ['Mod', 'Shift', 'G'],
      run: () => {
        closeOverlay()
        newTab('gemini')
      },
    })
    if (multiProfile) {
      for (const p of ui.settings.profiles) {
        list.push({
          id: `cmd-new-profile-${p.id}`,
          section: 'commands',
          label: t('action.newInProfile', { name: p.name }),
          dot: p.color,
          run: () => {
            closeOverlay()
            newTab(ui.settings.defaultService, p.id)
          },
        })
      }
    }
    list.push({
      id: 'cmd-reopen-tab',
      section: 'commands',
      label: t('action.reopenTab'),
      icon: History,
      combo: ['Mod', 'Shift', 'T'],
      run: () => {
        closeOverlay()
        void nd.invoke('tabs:reopen')
      },
    })

    if (active) {
      const id = active.id
      list.push({
        id: 'cmd-close-tab',
        section: 'commands',
        label: t('action.closeTab'),
        icon: X,
        combo: ['Mod', 'W'],
        run: () => {
          closeOverlay()
          void nd.invoke('tabs:close', id)
        },
      })
      list.push({
        id: 'cmd-reload-tab',
        section: 'commands',
        label: t('action.reload'),
        icon: RotateCw,
        combo: ['Mod', 'R'],
        run: () => {
          closeOverlay()
          void nd.invoke('tabs:reload', id)
        },
      })
      list.push({
        id: 'cmd-find',
        section: 'commands',
        label: t('action.find'),
        icon: Search,
        combo: ['Mod', 'F'],
        run: () => {
          closeOverlay()
          ui.findOpen = true
        },
      })
      list.push({
        id: 'cmd-zoom-in',
        section: 'commands',
        label: t('action.zoomIn'),
        icon: ZoomIn,
        combo: ['Mod', '+'],
        run: () => {
          closeOverlay()
          void nd.invoke('tabs:zoom', id, 1)
        },
      })
      list.push({
        id: 'cmd-zoom-out',
        section: 'commands',
        label: t('action.zoomOut'),
        icon: ZoomOut,
        combo: ['Mod', '−'],
        run: () => {
          closeOverlay()
          void nd.invoke('tabs:zoom', id, -1)
        },
      })
      list.push({
        id: 'cmd-zoom-reset',
        section: 'commands',
        label: t('action.zoomReset'),
        icon: Percent,
        combo: ['Mod', '0'],
        run: () => {
          closeOverlay()
          void nd.invoke('tabs:zoom', id, 0)
        },
      })
      list.push({
        id: 'cmd-copy-link',
        section: 'commands',
        label: t('action.copyLink'),
        icon: Copy,
        run: () => {
          closeOverlay()
          void nd.invoke('tabs:copyLink', id)
        },
      })
      list.push({
        id: 'cmd-open-browser',
        section: 'commands',
        label: t('action.openInBrowser'),
        icon: ExternalLink,
        run: () => {
          closeOverlay()
          void nd.invoke('tabs:openInBrowser', id)
        },
      })
    }

    list.push({
      id: 'cmd-sleep-inactive',
      section: 'commands',
      label: t('action.sleepInactive'),
      icon: Moon,
      run: () => {
        closeOverlay()
        void nd.invoke('tabs:sleepInactive')
      },
    })
    list.push({
      id: 'cmd-focus-mode',
      section: 'commands',
      label: t('action.focusMode'),
      icon: Focus,
      combo: ['F11'],
      run: () => {
        closeOverlay()
        void nd.invoke('window:control', 'focusMode')
      },
    })
    list.push({
      id: 'cmd-toggle-color',
      section: 'commands',
      label: t('action.toggleColorMode'),
      icon: SunMoon,
      run: () => {
        closeOverlay()
        setSettings({ colorMode: isDark() ? 'light' : 'dark' })
      },
    })
    list.push({
      id: 'cmd-toggle-layout',
      section: 'commands',
      label: t('action.toggleLayout'),
      icon: PanelsTopLeft,
      run: () => {
        closeOverlay()
        setSettings({ tabLayout: vertical ? 'top' : 'vertical' })
      },
    })
    if (vertical) {
      list.push({
        id: 'cmd-toggle-sidebar',
        section: 'commands',
        label: t('action.toggleSidebar'),
        icon: PanelLeft,
        combo: ['Mod', 'B'],
        run: () => {
          closeOverlay()
          setSettings({ sidebarCollapsed: !ui.settings.sidebarCollapsed })
        },
      })
    }
    list.push({
      id: 'cmd-downloads',
      section: 'commands',
      label: t('action.downloads'),
      icon: ArrowDownToLine,
      combo: ['Mod', 'J'],
      run: () => openOverlay('downloads'),
    })
    list.push({
      id: 'cmd-memory',
      section: 'commands',
      label: t('action.memory'),
      icon: MemoryStick,
      run: () => openOverlay('memory'),
    })
    list.push({
      id: 'cmd-shortcuts',
      section: 'commands',
      label: t('action.shortcuts'),
      icon: Keyboard,
      combo: ['Mod', '/'],
      run: () => openOverlay('shortcuts'),
    })
    list.push({
      id: 'cmd-settings',
      section: 'commands',
      label: t('action.settings'),
      icon: Settings2,
      combo: ['Mod', ','],
      run: () => openSettings(),
    })
    list.push({
      id: 'cmd-manage-prompts',
      section: 'commands',
      label: t('action.managePrompts'),
      icon: MessageSquareText,
      run: () => openSettings('prompts'),
    })
    list.push({
      id: 'cmd-insert-prompt',
      section: 'commands',
      label: t('action.prompts'),
      icon: MessageSquarePlus,
      combo: ['Mod', 'P'],
      run: () => {
        query = '/'
        selected = 0
        refocus()
      },
    })
    list.push({
      id: 'cmd-check-updates',
      section: 'commands',
      label: t('action.checkUpdates'),
      icon: RefreshCw,
      run: () => {
        void nd.invoke('app:checkUpdates')
        openSettings('about')
      },
    })
    list.push({
      id: 'cmd-quick-ask',
      section: 'commands',
      label: t('action.quickAsk'),
      icon: Zap,
      run: () => {
        closeOverlay()
        void nd.invoke('quick:action', 'show')
      },
    })
    list.push({
      id: 'cmd-clear-history',
      section: 'commands',
      label: t('action.clearHistory'),
      icon: Trash2,
      run: () => {
        void nd.invoke('history:clear')
        history = []
        refocus()
      },
    })

    return list
  })

  const promptItems: PaletteItem[] = $derived(
    prompts.map((p) => ({
      id: `prompt-${p.id}`,
      section: 'prompts',
      label: p.title,
      secondary: p.text.trim().replace(/\s+/g, ' ').slice(0, 72),
      icon: MessageSquareText,
      run: () => {
        closeOverlay()
        void nd.invoke('prompts:insert', p.text)
      },
    })),
  )

  const themeItems: PaletteItem[] = $derived(
    THEME_IDS.map((id) => ({
      id: `theme-${id}`,
      section: 'themes',
      label: t('action.theme', { name: THEMES[id].name }),
      icon: Palette,
      checked: ui.settings.theme === id,
      run: () => {
        closeOverlay()
        setSettings({ theme: id })
      },
    })),
  )

  function parsePrefix(q: string): { scope: 'all' | 'commands' | 'prompts' | 'tabs'; text: string } {
    if (q.startsWith('>')) return { scope: 'commands', text: q.slice(1).trim() }
    if (q.startsWith('/')) return { scope: 'prompts', text: q.slice(1).trim() }
    if (q.startsWith('@')) return { scope: 'tabs', text: q.slice(1).trim() }
    return { scope: 'all', text: q.trim() }
  }

  const parsed = $derived.by(() => {
    const p = parsePrefix(query)
    if (mode === 'prompts') return { scope: 'prompts' as const, text: p.scope === 'prompts' ? p.text : query.trim() }
    return p
  })
  const isEmpty = $derived(parsed.text.length === 0)
  const hasPrefix = $derived(parsed.scope !== 'all')

  function rank<T extends { label: string }>(items: T[], text: string): (T & { hits: number[] })[] {
    const scored: { item: T; score: number; hits: number[] }[] = []
    for (const item of items) {
      const m = fuzzyMatch(text, item.label)
      if (m) scored.push({ item, score: m.score, hits: m.hits })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.map((s) => ({ ...s.item, hits: s.hits }))
  }

  function capFor(section: PaletteItem['section']): number | null {
    if (hasPrefix) return null
    if (isEmpty) return section === 'recent' ? 8 : null
    return 6
  }

  function capArr<T>(arr: T[], n: number | null): T[] {
    return n === null ? arr : arr.slice(0, n)
  }

  const showTabs = $derived(parsed.scope === 'all' || parsed.scope === 'tabs')
  const showRecent = $derived(parsed.scope === 'all')
  const showCommands = $derived(parsed.scope === 'all' || parsed.scope === 'commands')
  const showPrompts = $derived(parsed.scope === 'prompts' || (parsed.scope === 'all' && !isEmpty))
  const showThemes = $derived(parsed.scope === 'all' && !isEmpty)

  const tabsOut = $derived(showTabs ? capArr(rank(tabItems, parsed.text), capFor('tabs')) : [])
  const recentOut = $derived(showRecent ? capArr(rank(recentItems, parsed.text), capFor('recent')) : [])
  const commandsOut = $derived(showCommands ? capArr(rank(commandItems, parsed.text), capFor('commands')) : [])
  const promptsOut = $derived(showPrompts ? capArr(rank(promptItems, parsed.text), capFor('prompts')) : [])
  const themesOut = $derived(showThemes ? capArr(rank(themeItems, parsed.text), capFor('themes')) : [])

  const visibleItems: RankedItem[] = $derived([...tabsOut, ...recentOut, ...commandsOut, ...promptsOut, ...themesOut])

  const sectionLabel = {
    tabs: 'palette.tabs',
    recent: 'palette.recent',
    commands: 'palette.actions',
    prompts: 'palette.prompts',
    themes: 'palette.themes',
  } as const

  // Clamp selection whenever the result set changes shape (new query, items loaded, …).
  $effect(() => {
    const n = visibleItems.length
    if (n === 0) selected = 0
    else if (selected >= n) selected = n - 1
  })

  $effect(() => {
    const row = listEl?.querySelector<HTMLElement>(`[data-idx="${selected}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  })

  function move(dir: 1 | -1): void {
    const n = visibleItems.length
    if (!n) return
    selected = (selected + dir + n) % n
  }

  function activate(item: RankedItem): void {
    item.run()
  }

  function onKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        selected = 0
        break
      case 'End':
        e.preventDefault()
        if (visibleItems.length) selected = visibleItems.length - 1
        break
      case 'Enter':
        e.preventDefault()
        if (visibleItems[selected]) activate(visibleItems[selected])
        break
      case 'Tab':
        e.preventDefault()
        break
    }
  }

  function highlightParts(label: string, hits: number[]): { text: string; on: boolean }[] {
    if (!hits.length) return [{ text: label, on: false }]
    const set = new Set(hits)
    const parts: { text: string; on: boolean }[] = []
    let i = 0
    while (i < label.length) {
      const on = set.has(i)
      let j = i + 1
      while (j < label.length && set.has(j) === on) j++
      parts.push({ text: label.slice(i, j), on })
      i = j
    }
    return parts
  }
</script>

<div class="panel palette" data-mode={mode}>
  <div class="input-row">
    <Search size={16} />
    <input
      bind:this={inputEl}
      bind:value={query}
      placeholder={mode === 'prompts' ? t('palette.placeholderPrompts') : t('palette.placeholder')}
      spellcheck="false"
      autocomplete="off"
      onkeydown={onKeydown}
    />
  </div>

  <div class="list" bind:this={listEl} role="listbox">
    {#if visibleItems.length === 0}
      <div class="empty muted">{t('palette.noResults')}</div>
    {:else}
      {#each visibleItems as item, i (item.id)}
        {#if mode !== 'prompts' && (i === 0 || visibleItems[i - 1].section !== item.section)}
          <div class="section-label">{t(sectionLabel[item.section])}</div>
        {/if}
        <button
          type="button"
          class="row"
          class:selected={i === selected}
          class:sleeping={item.sleeping}
          role="option"
          aria-selected={i === selected}
          tabindex="-1"
          data-idx={i}
          onmouseenter={() => (selected = i)}
          onclick={() => activate(item)}
        >
          <span class="row-icon">
            {#if item.tab}
              <Favicon tab={item.tab} size={16} />
            {:else if item.dot}
              <span class="dot" style:background={item.dot}></span>
            {:else if item.icon}
              <item.icon size={16} />
            {/if}
          </span>
          <span class="label">
            {#each highlightParts(item.label, item.hits) as part, pi (pi)}
              {#if part.on}<mark>{part.text}</mark>{:else}{part.text}{/if}
            {/each}
          </span>
          {#if item.secondary}<span class="secondary faint">{item.secondary}</span>{/if}
          {#if item.sleeping}<Moon size={12} class="sleep-icon" />{/if}
          {#if item.checked}<Check size={14} class="check-icon" />{/if}
          {#if item.combo}
            <span class="combo">
              {#each item.combo as key (key)}<span class="kbd">{keyLabel(key, ui.platform)}</span>{/each}
            </span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>

  <div class="footer">
    <span class="hint"><span class="kbd">↑</span><span class="kbd">↓</span>{t('palette.hintNavigate')}</span>
    <span class="hint"><span class="kbd">↵</span>{t('palette.hintOpen')}</span>
    <span class="hint"><span class="kbd">Esc</span>{t('palette.hintClose')}</span>
    {#if mode !== 'prompts'}<span class="modes faint">{t('palette.hintModes')}</span>{/if}
  </div>
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    width: 640px;
    max-width: 100%;
    max-height: min(520px, 70vh);
    overflow: hidden;
    animation: nd-pop-in 160ms var(--ease);
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 16px;
    border-bottom: var(--border-w) solid var(--border);
    color: var(--text-2);
    flex: none;
  }
  :root[data-density='compact'] .input-row {
    height: 44px;
  }
  .input-row input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font-size: 14px;
  }
  .input-row input:focus-visible {
    box-shadow: none;
  }
  .input-row input::placeholder {
    color: var(--text-3);
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
  }

  .empty {
    padding: 36px 10px;
    text-align: center;
    font-size: 13px;
  }

  .section-label {
    padding: 9px 10px 4px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .section-label:first-child {
    padding-top: 3px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border-radius: var(--radius);
    color: var(--text);
    text-align: left;
    transition: background var(--dur) var(--ease);
  }
  :root[data-density='compact'] .row {
    height: 32px;
  }
  .row.selected {
    background: var(--accent-softer);
    box-shadow: inset 0 0 0 1px var(--accent-soft);
  }
  .row.sleeping:not(.selected) {
    opacity: 0.65;
  }

  .row-icon {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    flex: none;
    color: var(--text-2);
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex: none;
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 500;
  }
  .label mark {
    background: none;
    color: var(--accent);
    font-weight: 700;
  }

  .secondary {
    flex: none;
    max-width: 38%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 11.5px;
  }

  :global(.sleep-icon) {
    flex: none;
    color: var(--text-3);
  }
  :global(.check-icon) {
    flex: none;
    color: var(--accent);
  }

  .combo {
    display: flex;
    gap: 3px;
    flex: none;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 38px;
    padding: 0 14px;
    border-top: var(--border-w) solid var(--border);
    color: var(--text-3);
    font-size: 11.5px;
    flex: none;
  }
  .hint {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .modes {
    margin-left: auto;
    white-space: nowrap;
  }
</style>
