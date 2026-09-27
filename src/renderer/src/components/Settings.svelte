<script lang="ts">
  import X from '@lucide/svelte/icons/x'
  import Palette from '@lucide/svelte/icons/palette'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import Users from '@lucide/svelte/icons/users'
  import Gauge from '@lucide/svelte/icons/gauge'
  import Keyboard from '@lucide/svelte/icons/keyboard'
  import MessageSquare from '@lucide/svelte/icons/message-square'
  import Wifi from '@lucide/svelte/icons/wifi'
  import Download from '@lucide/svelte/icons/download'
  import Wrench from '@lucide/svelte/icons/wrench'
  import Info from '@lucide/svelte/icons/info'
  import AppearanceSection from './settings/AppearanceSection.svelte'
  import GeneralSection from './settings/GeneralSection.svelte'
  import ProfilesSection from './settings/ProfilesSection.svelte'
  import PerformanceSection from './settings/PerformanceSection.svelte'
  import ShortcutsSection from './settings/ShortcutsSection.svelte'
  import PromptsSection from './settings/PromptsSection.svelte'
  import NetworkSection from './settings/NetworkSection.svelte'
  import DownloadsSection from './settings/DownloadsSection.svelte'
  import AdvancedSection from './settings/AdvancedSection.svelte'
  import AboutSection from './settings/AboutSection.svelte'
  import type { I18nKey } from '@shared/i18n'
  import { closeOverlay, ui } from '../lib/state.svelte'
  import { t } from '../lib/i18n'

  const SECTIONS: { id: string; icon: typeof Palette; label: I18nKey }[] = [
    { id: 'appearance', icon: Palette, label: 'settings.appearance' },
    { id: 'general', icon: SlidersHorizontal, label: 'settings.general' },
    { id: 'profiles', icon: Users, label: 'settings.profiles' },
    { id: 'performance', icon: Gauge, label: 'settings.performance' },
    { id: 'shortcuts', icon: Keyboard, label: 'settings.shortcuts' },
    { id: 'prompts', icon: MessageSquare, label: 'settings.prompts' },
    { id: 'network', icon: Wifi, label: 'settings.network' },
    { id: 'downloads', icon: Download, label: 'settings.downloads' },
    { id: 'advanced', icon: Wrench, label: 'settings.advanced' },
    { id: 'about', icon: Info, label: 'settings.about' },
  ]

  const current = $derived(SECTIONS.find((s) => s.id === ui.settingsSection) ?? SECTIONS[0]!)
</script>

<div class="panel settings">
  <nav class="nav">
    <div class="nav-title">{t('settings.title')}</div>
    {#each SECTIONS as s (s.id)}
      <button type="button" class="nav-item" class:active={ui.settingsSection === s.id} onclick={() => (ui.settingsSection = s.id)}>
        <s.icon size={16} />
        <span>{t(s.label)}</span>
      </button>
    {/each}
  </nav>

  <div class="content">
    <div class="content-head">
      <h2>{t(current.label)}</h2>
      <button type="button" class="icon-btn" title={t('common.close')} aria-label={t('common.close')} onclick={closeOverlay}>
        <X size={18} />
      </button>
    </div>
    <div class="scroll">
      {#if ui.settingsSection === 'appearance'}
        <AppearanceSection />
      {:else if ui.settingsSection === 'general'}
        <GeneralSection />
      {:else if ui.settingsSection === 'profiles'}
        <ProfilesSection />
      {:else if ui.settingsSection === 'performance'}
        <PerformanceSection />
      {:else if ui.settingsSection === 'shortcuts'}
        <ShortcutsSection />
      {:else if ui.settingsSection === 'prompts'}
        <PromptsSection />
      {:else if ui.settingsSection === 'network'}
        <NetworkSection />
      {:else if ui.settingsSection === 'downloads'}
        <DownloadsSection />
      {:else if ui.settingsSection === 'advanced'}
        <AdvancedSection />
      {:else if ui.settingsSection === 'about'}
        <AboutSection />
      {/if}
    </div>
  </div>
</div>

<style>
  .settings {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    width: min(900px, 100%);
    height: min(640px, 100%);
    overflow: hidden;
    animation: nd-pop-in 180ms var(--ease);
    container-type: inline-size;
  }
  .nav {
    width: 200px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px 10px;
    border-right: var(--border-w) solid var(--border);
    overflow-y: auto;
  }
  .nav-title {
    padding: 4px 10px 12px;
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-heading);
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    padding: 0 10px;
    border-radius: var(--radius);
    color: var(--text-2);
    font-weight: 550;
    text-align: left;
    flex: none;
    transition:
      background var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }
  .nav-item :global(svg) {
    flex: none;
  }
  .nav-item span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nav-item:hover {
    background: var(--tab-hover);
    color: var(--text);
  }
  .nav-item.active {
    background: var(--accent-soft);
    color: var(--text);
  }
  .nav-item.active :global(svg) {
    color: var(--accent);
  }

  .content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .content-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px 10px;
    flex: none;
  }
  .content-head h2 {
    font-size: 18px;
    font-family: var(--font-heading);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  @container (max-width: 760px) {
    .nav {
      width: 64px;
    }
    .nav-title {
      display: none;
    }
    .nav-item {
      justify-content: center;
      padding: 0;
    }
    .nav-item span {
      display: none;
    }
  }

  :global([data-density='compact']) .content-head {
    padding: 12px 16px 8px;
  }
  :global([data-density='compact']) .scroll {
    padding: 4px 16px 16px;
    gap: 16px;
  }
  :global([data-density='compact']) .nav {
    padding: 12px 8px;
  }
</style>
