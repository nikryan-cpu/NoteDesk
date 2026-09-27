<script lang="ts">
  // Header strip for the Quick Ask window: a drag handle with the window's own controls,
  // since the frameless window has no titlebar of its own above the web content.
  import { onMount } from 'svelte'
  import Pin from '@lucide/svelte/icons/pin'
  import PinOff from '@lucide/svelte/icons/pin-off'
  import AppWindow from '@lucide/svelte/icons/app-window'
  import X from '@lucide/svelte/icons/x'
  import type { QuickState } from '@shared/ipc'
  import { translate } from '@shared/i18n'
  import { THEMES, themeTokens, type ThemeId, type ThemeTokens } from '@shared/themes'

  let state = $state<QuickState>({ pinned: false, locale: 'en', dark: false, theme: 'minimal' })

  const TOKEN_VAR: Record<keyof ThemeTokens, string> = {
    bg: '--bg',
    bgImage: '--bg-image',
    surface: '--surface',
    surface2: '--surface-2',
    border: '--border',
    text: '--text',
    text2: '--text-2',
    text3: '--text-3',
    accent: '--accent',
    accentText: '--accent-text',
    tabActive: '--tab-active',
    tabActiveText: '--tab-active-text',
    tabHover: '--tab-hover',
    scrim: '--scrim',
    shadow: '--shadow',
    contentShadow: '--content-shadow',
    danger: '--danger',
    success: '--success',
    warning: '--warning',
  }

  function applyQuickTheme(s: QuickState): void {
    const id = (s.theme in THEMES ? s.theme : 'minimal') as ThemeId
    const def = THEMES[id]
    const tokens = themeTokens(id, s.dark)
    const root = document.documentElement
    for (const key of Object.keys(TOKEN_VAR) as (keyof ThemeTokens)[]) {
      root.style.setProperty(TOKEN_VAR[key], tokens[key] ?? 'none')
    }
    root.style.setProperty('--radius', `${def.radius}px`)
    root.style.setProperty('--radius-lg', `${def.radiusLg}px`)
    root.style.setProperty('--border-w', `${def.borderWidth}px`)
    root.style.setProperty('--blur', `${def.blur}px`)
    root.style.setProperty('--font', def.font)
    root.style.setProperty('--font-heading', def.headingFont ?? def.font)
    root.style.colorScheme = s.dark ? 'dark' : 'light'
    root.dataset.theme = id
    root.dataset.surface = def.surfaceStyle
    root.dataset.tabStyle = def.tabStyle
    root.dataset.dark = String(s.dark)
  }

  $effect(() => {
    applyQuickTheme(state)
  })

  onMount(() => {
    void window.nd.invoke('quick:action', 'init').then((s) => (state = s))
    return window.nd.on('quick-theme', (s) => (state = s))
  })

  function act(action: 'pin' | 'openInMain' | 'close'): void {
    void window.nd.invoke('quick:action', action).then((s) => (state = s))
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      act('close')
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="quick-header drag" role="toolbar" aria-label={translate(state.locale, 'tray.quickAsk')}>
  <div class="brand">
    <svg class="mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="14" height="14" rx="4" fill="var(--accent)" />
      <rect x="4.6" y="1" width="1.3" height="14" fill="var(--accent-text)" opacity="0.55" />
      <line x1="7.6" y1="4.6" x2="12.4" y2="4.6" stroke="var(--accent-text)" stroke-width="1.3" stroke-linecap="round" />
      <line x1="7.6" y1="7.8" x2="12.4" y2="7.8" stroke="var(--accent-text)" stroke-width="1.3" stroke-linecap="round" />
      <line x1="7.6" y1="11" x2="10.6" y2="11" stroke="var(--accent-text)" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    <span class="label">{translate(state.locale, 'tray.quickAsk')}</span>
  </div>
  <div class="actions no-drag">
    <button
      class="icon-btn"
      class:active={state.pinned}
      title={translate(state.locale, 'quick.pin')}
      aria-pressed={state.pinned}
      onclick={() => act('pin')}
    >
      {#if state.pinned}<PinOff size={15} />{:else}<Pin size={15} />{/if}
    </button>
    <button class="icon-btn" title={translate(state.locale, 'quick.openInMain')} onclick={() => act('openInMain')}>
      <AppWindow size={15} />
    </button>
    <button class="icon-btn" title={translate(state.locale, 'quick.close')} onclick={() => act('close')}>
      <X size={15} />
    </button>
  </div>
</div>

<style>
  .quick-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 38px;
    width: 100%;
    padding: 0 6px 0 10px;
    gap: 8px;
    background: var(--surface);
    border-bottom: var(--border-w) solid var(--border);
    overflow: hidden;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    color: var(--text);
    font-weight: 600;
    font-size: 12.5px;
  }

  .mark {
    width: 16px;
    height: 16px;
    flex: none;
  }

  .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
