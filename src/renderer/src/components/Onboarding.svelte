<script lang="ts">
  import { onDestroy } from 'svelte'
  import ShieldCheck from '@lucide/svelte/icons/shield-check'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'
  import Monitor from '@lucide/svelte/icons/monitor'
  import { LOCALE_NAMES } from '@shared/i18n'
  import { resolveLocale } from '@shared/settings'
  import { THEME_IDS, THEMES } from '@shared/themes'
  import { closeOverlay, isDark, setSettings, ui } from '../lib/state.svelte'
  import { t, modKey } from '../lib/i18n'
  import ThemePreview from './ThemePreview.svelte'

  let step = $state(1)
  const isLast = $derived(step === 3)
  const systemLocale = $derived(resolveLocale('auto', navigator.language))

  function back(): void {
    if (step > 1) step--
  }

  function primary(): void {
    if (isLast) {
      setSettings({ onboarded: true })
      closeOverlay()
    } else {
      step++
    }
  }

  onDestroy(() => {
    if (!ui.settings.onboarded) setSettings({ onboarded: true })
  })
</script>

<div class="panel">
  <div class="body">
    {#key step}
      <div class="step-content">
        {#if step === 1}
          <div class="logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="72" height="72">
              <defs>
                <linearGradient id="ndLogoGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style="stop-color:var(--accent)" />
                  <stop offset="1" style="stop-color:color-mix(in oklab, var(--accent) 82%, black 18%)" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="62" height="62" rx="16" fill="url(#ndLogoGrad)" />
              <g stroke="var(--accent-text)" stroke-width="2.4" stroke-linecap="round" fill="none">
                <rect x="13" y="17" width="17" height="30" rx="3" />
                <rect x="34" y="17" width="17" height="30" rx="3" />
                <line x1="17.5" y1="25" x2="25.5" y2="25" />
                <line x1="17.5" y1="31" x2="24" y2="31" />
                <line x1="17.5" y1="37" x2="25.5" y2="37" />
                <line x1="38.5" y1="25" x2="46.5" y2="25" />
                <line x1="38.5" y1="31" x2="45" y2="31" />
              </g>
            </svg>
          </div>
          <h1>{t('onboarding.welcome')}</h1>
          <p class="subtitle">{t('onboarding.subtitle')}</p>

          <div class="field">
            <span class="field-label muted">{t('onboarding.language')}</span>
            <div class="segmented">
              <button class="seg-btn" class:active={ui.settings.locale === 'auto'} onclick={() => setSettings({ locale: 'auto' })}>
                {t('appearance.languageAuto', { name: LOCALE_NAMES[systemLocale] })}
              </button>
              <button class="seg-btn" class:active={ui.settings.locale === 'en'} onclick={() => setSettings({ locale: 'en' })}>
                {LOCALE_NAMES.en}
              </button>
              <button class="seg-btn" class:active={ui.settings.locale === 'ru'} onclick={() => setSettings({ locale: 'ru' })}>
                {LOCALE_NAMES.ru}
              </button>
            </div>
          </div>
        {:else if step === 2}
          <h1>{t('onboarding.pickTheme')}</h1>
          <p class="subtitle">{t('onboarding.pickThemeHint')}</p>

          <div class="theme-grid">
            {#each THEME_IDS as id (id)}
              <button class="theme-card" class:selected={ui.settings.theme === id} onclick={() => setSettings({ theme: id })}>
                <ThemePreview {id} dark={isDark()} />
                <span class="theme-name">{THEMES[id].name}</span>
              </button>
            {/each}
          </div>

          <div class="segmented mode-segmented">
            <button class="seg-btn" class:active={ui.settings.colorMode === 'light'} onclick={() => setSettings({ colorMode: 'light' })}>
              <Sun size={14} /> {t('appearance.light')}
            </button>
            <button class="seg-btn" class:active={ui.settings.colorMode === 'dark'} onclick={() => setSettings({ colorMode: 'dark' })}>
              <Moon size={14} /> {t('appearance.dark')}
            </button>
            <button class="seg-btn" class:active={ui.settings.colorMode === 'system'} onclick={() => setSettings({ colorMode: 'system' })}>
              <Monitor size={14} /> {t('appearance.system')}
            </button>
          </div>
        {:else}
          <div class="lock-badge" aria-hidden="true"><ShieldCheck size={26} /></div>
          <h1>{t('onboarding.signIn')}</h1>
          <p class="subtitle">{t('onboarding.signInHint')}</p>
          <p class="tip muted">{t('onboarding.tipPalette', { key: `${modKey(ui.platform)}+K` })}</p>
          <p class="disclaimer faint">{t('app.disclaimer')}</p>
        {/if}
      </div>
    {/key}
  </div>

  <div class="footer">
    <div class="footer-side">
      {#if step > 1}
        <button class="btn ghost" onclick={back}>{t('onboarding.back')}</button>
      {/if}
    </div>
    <div class="dots" aria-hidden="true">
      {#each [1, 2, 3] as s (s)}
        <span class="dot" class:active={s === step}></span>
      {/each}
    </div>
    <div class="footer-side end">
      <button class="btn primary" onclick={primary}>{isLast ? t('onboarding.start') : t('onboarding.next')}</button>
    </div>
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: 560px;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 64px);
    animation: nd-pop-in 200ms var(--ease);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 36px 36px 8px;
  }
  .step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    animation: nd-step-in 240ms var(--ease);
  }
  @keyframes nd-step-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .logo {
    margin-bottom: 18px;
    filter: drop-shadow(0 6px 16px color-mix(in oklab, var(--accent) 35%, transparent));
  }
  h1 {
    font-size: 21px;
    margin-bottom: 8px;
  }
  .subtitle {
    margin: 0 0 22px;
    max-width: 380px;
    color: var(--text-2);
    line-height: 1.5;
  }

  .field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .field-label {
    font-size: 12px;
  }

  .segmented {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .seg-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    padding: 0 14px;
    border-radius: calc(var(--radius) - 2px);
    color: var(--text-2);
    font-weight: 550;
    font-size: 12.5px;
    white-space: nowrap;
    transition:
      background var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }
  .seg-btn:hover {
    color: var(--text);
  }
  .seg-btn.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    width: 100%;
    margin-bottom: 18px;
  }
  .theme-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border-radius: var(--radius-lg);
    transition: background var(--dur) var(--ease);
  }
  .theme-card:hover {
    background: var(--tab-hover);
  }
  .theme-card.selected {
    box-shadow: var(--ring);
  }
  .theme-name {
    font-size: 11px;
    font-weight: 550;
    color: var(--text-2);
  }
  .theme-card.selected .theme-name {
    color: var(--text);
  }

  .lock-badge {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    margin-bottom: 16px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .tip {
    margin: 0 0 14px;
    font-size: 12.5px;
  }
  .disclaimer {
    margin: 0;
    max-width: 400px;
    font-size: 11px;
    line-height: 1.5;
  }

  .footer {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    flex: none;
    padding: 18px 24px 24px;
  }
  .footer-side {
    display: flex;
  }
  .footer-side.end {
    justify-content: flex-end;
  }
  .dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    opacity: 0.5;
    transition:
      opacity var(--dur) var(--ease),
      background var(--dur) var(--ease),
      transform var(--dur) var(--ease);
  }
  .dot.active {
    background: var(--accent);
    opacity: 1;
    transform: scale(1.3);
  }
</style>
