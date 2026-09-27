<script lang="ts">
  import { PROFILE_COLORS, resolveLocale } from '@shared/settings'
  import { LOCALE_NAMES } from '@shared/i18n'
  import { THEME_IDS, THEMES, themeTokens } from '@shared/themes'
  import ThemePreview from '../ThemePreview.svelte'
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import Segmented from './Segmented.svelte'
  import Select from './Select.svelte'
  import Toggle from './Toggle.svelte'
  import ColorSwatches from './ColorSwatches.svelte'
  import { isDark, locale, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  const darkOnly = $derived(THEMES[ui.settings.theme].modes === 'dark')
  const usesMaterial = $derived.by(() => {
    const m = THEMES[ui.settings.theme].material
    return ui.materialSupported && (m.win !== 'none' || m.mac !== null)
  })
  const themeAccent = $derived(themeTokens(ui.settings.theme, isDark()).accent)
  const isCustomAccent = $derived(Boolean(ui.settings.accent) && !PROFILE_COLORS.includes(ui.settings.accent))
  const autoLocaleName = $derived(LOCALE_NAMES[resolveLocale('auto', navigator.language)])
</script>

<div class="gallery">
  {#each THEME_IDS as id (id)}
    {@const def = THEMES[id]}
    <button type="button" class="theme-card" class:selected={ui.settings.theme === id} onclick={() => setSettings({ theme: id })}>
      <ThemePreview {id} dark={isDark()} accent={ui.settings.accent} />
      <div class="theme-meta">
        <span class="theme-name">{def.name}</span>
        {#if def.modes === 'dark'}<span class="badge">{t('appearance.darkOnly')}</span>{/if}
      </div>
      <p class="theme-desc faint">{def.description[locale()]}</p>
    </button>
  {/each}
</div>
{#if usesMaterial}
  <p class="material-note faint">{t('appearance.materialNote')}</p>
{/if}

<Group>
  <Row label={t('appearance.colorMode')}>
    <Segmented
      options={[
        { value: 'system', label: t('appearance.system') },
        { value: 'light', label: t('appearance.light') },
        { value: 'dark', label: t('appearance.dark') },
      ] as const}
      value={ui.settings.colorMode}
      disabled={darkOnly}
      onchange={(v) => setSettings({ colorMode: v })}
    />
    {#if darkOnly}<span class="faint note">{t('appearance.darkOnly')}</span>{/if}
  </Row>
</Group>

<Group>
  <Row label={t('appearance.accent')}>
    <div class="accent-control">
      <button type="button" class="chip" class:selected={!ui.settings.accent} onclick={() => setSettings({ accent: '' })}>
        <span class="dot" style:background={themeAccent}></span>
        {t('appearance.accentTheme')}
      </button>
      <ColorSwatches colors={PROFILE_COLORS} value={ui.settings.accent} size={20} onchange={(c) => setSettings({ accent: c })} />
      <label class="chip custom" class:selected={isCustomAccent}>
        <input
          type="color"
          class="color-input"
          value={ui.settings.accent || themeAccent}
          oninput={(e) => setSettings({ accent: e.currentTarget.value })}
          aria-label={t('appearance.custom')}
        />
        {t('appearance.custom')}
      </label>
    </div>
  </Row>
</Group>

<Group>
  <Row label={t('appearance.density')}>
    <Segmented
      options={[
        { value: 'compact', label: t('appearance.compact') },
        { value: 'comfortable', label: t('appearance.comfortable') },
      ] as const}
      value={ui.settings.density}
      onchange={(v) => setSettings({ density: v })}
    />
  </Row>
  <Row label={t('appearance.layout')}>
    <Segmented
      options={[
        { value: 'top', label: t('appearance.layoutTop') },
        { value: 'vertical', label: t('appearance.layoutVertical') },
      ] as const}
      value={ui.settings.tabLayout}
      onchange={(v) => setSettings({ tabLayout: v })}
    />
  </Row>
  <Row label={t('appearance.floating')} hint={t('appearance.floatingHint')}>
    <Toggle checked={ui.settings.floatingContent} onchange={(v) => setSettings({ floatingContent: v })} />
  </Row>
  <Row label={t('appearance.reduceMotion')}>
    <Toggle checked={ui.settings.reduceMotion} onchange={(v) => setSettings({ reduceMotion: v })} />
  </Row>
  <Row label={t('appearance.language')}>
    <Select
      value={ui.settings.locale}
      options={[
        { value: 'auto', label: t('appearance.languageAuto', { name: autoLocaleName }) },
        { value: 'en', label: LOCALE_NAMES.en },
        { value: 'ru', label: LOCALE_NAMES.ru },
      ] as const}
      onchange={(v) => setSettings({ locale: v })}
    />
  </Row>
</Group>

<style>
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }
  .theme-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: var(--radius-lg);
    border: var(--border-w) solid var(--border);
    background: var(--surface);
    text-align: left;
    transition:
      box-shadow var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .theme-card:hover {
    border-color: color-mix(in oklab, var(--accent) 40%, var(--border));
  }
  .theme-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent) 45%, transparent);
  }
  .theme-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .theme-name {
    font-weight: 600;
    font-size: 12.5px;
  }
  .badge {
    font-size: 10px;
    font-weight: 650;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-2);
    white-space: nowrap;
  }
  .theme-desc {
    font-size: 11px;
    line-height: 1.4;
    margin: 0;
  }
  .material-note {
    margin: -6px 2px 0;
    font-size: 11.5px;
  }
  .note {
    font-size: 11.5px;
  }

  .accent-control {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: var(--border-w) solid var(--border);
    background: var(--surface);
    font-weight: 550;
    font-size: 12px;
    color: var(--text-2);
    cursor: pointer;
    transition:
      border-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }
  .chip:hover {
    color: var(--text);
  }
  .chip.selected {
    border-color: var(--accent);
    color: var(--text);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .chip .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex: none;
    border: var(--border-w) solid var(--border);
  }
  .color-input {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }
  .color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color-input::-webkit-color-swatch {
    border: var(--border-w) solid var(--border);
    border-radius: 50%;
  }
</style>
