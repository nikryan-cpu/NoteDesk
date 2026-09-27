// In-app shortcuts as shown in the cheat sheet and in Settings. The actual handling lives in
// src/main/shortcuts.ts (matched by physical key, so they work on any keyboard layout).
import type { I18nKey } from '@shared/i18n'
import type { OsPlatform } from '@shared/ipc'

export interface ShortcutRow {
  label: I18nKey
  /** Alternative key combinations; each one is a list of keys. 'Mod' = Ctrl or ⌘. */
  combos: string[][]
}

export const IN_APP_SHORTCUTS: ShortcutRow[] = [
  { label: 'shortcuts.palette', combos: [['Mod', 'K']] },
  { label: 'shortcuts.prompts', combos: [['Mod', 'P']] },
  { label: 'shortcuts.newTab', combos: [['Mod', 'T']] },
  { label: 'shortcuts.newGemini', combos: [['Mod', 'Shift', 'G']] },
  { label: 'shortcuts.closeTab', combos: [['Mod', 'W']] },
  { label: 'shortcuts.reopenTab', combos: [['Mod', 'Shift', 'T']] },
  { label: 'shortcuts.nextTab', combos: [['Ctrl', 'Tab'], ['Ctrl', 'Shift', 'Tab']] },
  { label: 'shortcuts.selectTab', combos: [['Mod', '1…9']] },
  { label: 'shortcuts.find', combos: [['Mod', 'F'], ['F3']] },
  { label: 'shortcuts.zoom', combos: [['Mod', '+'], ['Mod', '−'], ['Mod', '0']] },
  { label: 'shortcuts.reload', combos: [['Mod', 'R'], ['F5']] },
  { label: 'shortcuts.backForward', combos: [['Alt', '←'], ['Alt', '→']] },
  { label: 'shortcuts.focusMode', combos: [['F11']] },
  { label: 'shortcuts.sidebar', combos: [['Mod', 'B']] },
  { label: 'shortcuts.settings', combos: [['Mod', ',']] },
  { label: 'shortcuts.downloads', combos: [['Mod', 'J']] },
  { label: 'shortcuts.memory', combos: [['Mod', 'Shift', 'M']] },
  { label: 'shortcuts.help', combos: [['Mod', '/'], ['F1']] },
]

const MAC_KEYS: Record<string, string> = { Mod: '⌘', Ctrl: '⌃', Shift: '⇧', Alt: '⌥', CommandOrControl: '⌘', Command: '⌘', Control: '⌃', Option: '⌥' }
const PC_KEYS: Record<string, string> = { Mod: 'Ctrl', CommandOrControl: 'Ctrl', Control: 'Ctrl', Command: 'Win', Super: 'Win', Meta: 'Win' }

/** Display name of one key on the current platform. */
export function keyLabel(key: string, platform: OsPlatform): string {
  return (platform === 'darwin' ? MAC_KEYS[key] : PC_KEYS[key]) ?? key
}

/** Splits an Electron accelerator ("CommandOrControl+Shift+Space") into display keys. */
export function acceleratorKeys(accelerator: string, platform: OsPlatform): string[] {
  if (!accelerator) return []
  return accelerator.split('+').map((k) => keyLabel(k, platform))
}
