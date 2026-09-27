<script lang="ts">
  // Global hotkey recording works on the physical key (event.code), so it keeps producing the
  // right Electron accelerator no matter which keyboard layout is active.
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import { nd, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'
  import { acceleratorKeys, IN_APP_SHORTCUTS, keyLabel } from '../../lib/shortcuts'

  type HotkeyName = 'toggleWindow' | 'quickAsk'

  let recordingWhich = $state<HotkeyName | null>(null)
  let recordError = $state(false)

  function startRecording(which: HotkeyName) {
    recordingWhich = which
    recordError = false
    void nd.invoke('hotkey:recording', true)
  }

  function stopRecording() {
    if (recordingWhich) void nd.invoke('hotkey:recording', false)
    recordingWhich = null
    recordError = false
  }

  const F_KEY = /^F([1-9]|1\d|2[0-4])$/

  const CODE_TO_KEY: Record<string, string> = {
    Space: 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    Comma: ',',
    Period: '.',
    Slash: '/',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Quote: "'",
    Semicolon: ';',
    Tab: 'Tab',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Insert: 'Insert',
  }

  function codeToKey(code: string): string | null {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3)
    if (/^Digit\d$/.test(code)) return code.slice(5)
    if (F_KEY.test(code)) return code
    return CODE_TO_KEY[code] ?? null
  }

  function buildAccelerator(e: KeyboardEvent): string | null {
    const key = codeToKey(e.code)
    if (!key) return null
    const isMac = ui.platform === 'darwin'
    const parts: string[] = []
    if (isMac ? e.metaKey : e.ctrlKey) parts.push('CommandOrControl')
    if (isMac && e.ctrlKey) parts.push('Control')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    if (parts.length === 0 && !F_KEY.test(key)) return null
    parts.push(key)
    return parts.join('+')
  }

  async function onWindowKeydown(e: KeyboardEvent) {
    const which = recordingWhich
    if (!which || e.repeat) return
    e.preventDefault()
    e.stopPropagation()

    if (e.code === 'Escape') {
      stopRecording()
      return
    }
    if ((e.code === 'Backspace' || e.code === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      setSettings({ hotkeys: { ...ui.settings.hotkeys, [which]: '' } })
      stopRecording()
      return
    }

    const accel = buildAccelerator(e)
    if (!accel) return // bare modifier press, keep waiting

    const ok = await nd.invoke('hotkey:check', accel)
    if (recordingWhich !== which) return // cancelled while we were awaiting
    if (!ok) {
      recordError = true
      return
    }
    setSettings({ hotkeys: { ...ui.settings.hotkeys, [which]: accel } })
    stopRecording()
  }

  $effect(() => {
    return () => {
      if (recordingWhich) void nd.invoke('hotkey:recording', false)
    }
  })

  // A shortcut another app already owns can't be registered; say so instead of failing silently.
  let taken = $state<Record<HotkeyName, boolean>>({ toggleWindow: false, quickAsk: false })
  $effect(() => {
    if (recordingWhich) return
    for (const which of ['toggleWindow', 'quickAsk'] as const) {
      const accel = ui.settings.hotkeys[which]
      if (!accel) {
        taken[which] = false
        continue
      }
      void nd
        .invoke('hotkey:check', accel)
        .then((ok) => (taken[which] = !ok))
        .catch(() => {})
    }
  })
</script>

<svelte:window onkeydowncapture={onWindowKeydown} />

{#snippet hotkeyRow(which: HotkeyName, label: string)}
  <Row {label}>
    {#if recordingWhich === which}
      <span class="recording" class:danger={recordError}>{recordError ? t('shortcuts.invalid') : t('shortcuts.pressKeys')}</span>
      <button type="button" class="btn ghost" onclick={stopRecording}>{t('common.cancel')}</button>
    {:else}
      {#if ui.settings.hotkeys[which]}
        {#each acceleratorKeys(ui.settings.hotkeys[which], ui.platform) as k, i (i)}<span class="kbd">{k}</span>{/each}
        {#if taken[which]}<span class="taken">{t('shortcuts.taken')}</span>{/if}
      {:else}
        <span class="faint">{t('shortcuts.disabled')}</span>
      {/if}
      <button type="button" class="btn ghost" onclick={() => startRecording(which)}>{t('shortcuts.record')}</button>
    {/if}
  </Row>
{/snippet}

<Group heading={t('shortcuts.global')}>
  {@render hotkeyRow('toggleWindow', t('shortcuts.toggleWindow'))}
  {@render hotkeyRow('quickAsk', t('shortcuts.quickAsk'))}
</Group>

<Group heading={t('shortcuts.inApp')}>
  {#each IN_APP_SHORTCUTS as row (row.label)}
    <Row label={t(row.label)}>
      <div class="combos">
        {#each row.combos as combo, i (i)}
          {#if i > 0}<span class="faint">/</span>{/if}
          <span class="combo">
            {#each combo as key (key)}<span class="kbd">{keyLabel(key, ui.platform)}</span>{/each}
          </span>
        {/each}
      </div>
    </Row>
  {/each}
</Group>

<style>
  .recording {
    font-size: 12px;
    font-weight: 550;
    color: var(--accent);
  }
  .taken {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--danger);
    background: color-mix(in oklab, var(--danger) 12%, transparent);
  }
  .recording.danger {
    color: var(--danger);
  }
  .combos {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .combo {
    display: inline-flex;
    gap: 3px;
  }
</style>
