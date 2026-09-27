<script lang="ts">
  import { onMount } from 'svelte'
  import TitleBar from './components/TitleBar.svelte'
  import TopBar from './components/TopBar.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import ContentStage from './components/ContentStage.svelte'
  import FindBar from './components/FindBar.svelte'
  import Overlay from './components/Overlay.svelte'
  import CommandPalette from './components/CommandPalette.svelte'
  import { activeTab, closeOverlay, init, isDark, nd, openOverlay, openSettings, setSettings, ui } from './lib/state.svelte'
  import { applyTheme } from './lib/theme'
  import { computeInsets, titlebarHeight } from './lib/layout'

  onMount(() => {
    void init().then(() => {
      if (!ui.settings.onboarded && !ui.e2e) openOverlay('onboarding')
    })
  })

  const insets = $derived(ui.ready ? computeInsets(ui.settings, ui.findOpen) : null)

  $effect(() => {
    if (!ui.ready) return
    applyTheme(document.documentElement, ui.settings, isDark(), ui.platform, ui.materialSupported)
  })

  $effect(() => {
    if (insets) void nd.invoke('layout:set', $state.snapshot(insets))
  })

  $effect(() => {
    if (!ui.ready) return
    return nd.on('command', (cmd) => {
      switch (cmd) {
        case 'palette':
        case 'prompts':
        case 'downloads':
        case 'memory':
        case 'shortcuts':
        case 'onboarding':
          openOverlay(cmd)
          break
        case 'settings':
          if (ui.overlay === 'settings') closeOverlay()
          else openSettings()
          break
        case 'find':
          if (activeTab()?.kind === 'ask') break
          if (ui.overlay) closeOverlay()
          ui.findOpen = true
          break
        case 'toggle-sidebar':
          if (ui.settings.tabLayout === 'vertical') setSettings({ sidebarCollapsed: !ui.settings.sidebarCollapsed })
          break
      }
    })
  })

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && ui.overlay) {
      e.preventDefault()
      closeOverlay()
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if ui.ready && insets}
  {#if !ui.focusMode}
    {#if ui.settings.tabLayout === 'vertical'}
      <TopBar />
      <Sidebar />
    {:else}
      <TitleBar />
    {/if}
    {#if ui.findOpen && activeTab()?.kind !== 'ask'}
      <FindBar top={titlebarHeight(ui.settings)} left={insets.left} right={insets.right} />
    {/if}
  {/if}
  <ContentStage {insets} />

  {#if ui.overlay === 'palette' || ui.overlay === 'prompts'}
    <Overlay {insets}>
      <CommandPalette mode={ui.overlay === 'prompts' ? 'prompts' : 'all'} />
    </Overlay>
  {:else if ui.overlay === 'settings'}
    <Overlay {insets} align="center">
      {#await import('./components/Settings.svelte') then m}
        <m.default />
      {/await}
    </Overlay>
  {:else if ui.overlay === 'downloads'}
    <Overlay {insets} align="right">
      {#await import('./components/DownloadsPanel.svelte') then m}
        <m.default />
      {/await}
    </Overlay>
  {:else if ui.overlay === 'memory'}
    <Overlay {insets} align="right">
      {#await import('./components/MemoryPanel.svelte') then m}
        <m.default />
      {/await}
    </Overlay>
  {:else if ui.overlay === 'shortcuts'}
    <Overlay {insets} align="center">
      {#await import('./components/ShortcutsHelp.svelte') then m}
        <m.default />
      {/await}
    </Overlay>
  {:else if ui.overlay === 'onboarding'}
    <Overlay {insets} align="center">
      {#await import('./components/Onboarding.svelte') then m}
        <m.default />
      {/await}
    </Overlay>
  {/if}
{/if}
