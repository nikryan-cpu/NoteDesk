// In-app keyboard shortcuts, dispatched from `before-input-event` of every web contents so
// they work no matter which view has focus. Matching uses physical key codes, so shortcuts
// keep working on non-Latin layouts (Ctrl+K is still Ctrl+K on a Russian keyboard).
import { globalShortcut, type Input } from 'electron'
import type { ShellCommand } from '@shared/ipc'
import type { ServiceId } from '@shared/services'

export interface ShortcutActions {
  newTab(service?: ServiceId): void
  closeTab(): void
  reopenTab(): void
  cycleTab(dir: 1 | -1): void
  selectTab(n: number): void
  reload(hard: boolean): void
  back(): void
  forward(): void
  zoom(dir: 1 | -1 | 0): void
  command(cmd: ShellCommand): void
  toggleFocusMode(): void
  devtools(): void
}

let actions: ShortcutActions | null = null
let recording = false

export function setShortcutActions(a: ShortcutActions): void {
  actions = a
}

const isMac = process.platform === 'darwin'

export function handleShortcut(input: Input, _source: 'shell' | 'content'): boolean {
  if (!actions || recording || input.type !== 'keyDown') return false
  const a = actions
  const mod = isMac ? input.meta : input.control
  const { shift, alt, code } = input

  if (mod && !alt) {
    if (/^Digit[1-9]$/.test(code) && !shift) {
      a.selectTab(Number(code.slice(5)))
      return true
    }
    switch (code) {
      case 'KeyK':
        a.command('palette')
        return true
      case 'KeyP':
        if (shift) return false
        a.command('prompts')
        return true
      case 'KeyT':
        if (shift) a.reopenTab()
        else a.newTab()
        return true
      case 'KeyG':
        if (!shift) return false
        a.newTab('gemini')
        return true
      case 'KeyW':
      case 'F4':
        a.closeTab()
        return true
      case 'KeyF':
        if (shift) return false
        a.command('find')
        return true
      case 'KeyR':
        a.reload(shift)
        return true
      case 'Equal':
      case 'NumpadAdd':
        a.zoom(1)
        return true
      case 'Minus':
      case 'NumpadSubtract':
        a.zoom(-1)
        return true
      case 'Digit0':
      case 'Numpad0':
        a.zoom(0)
        return true
      case 'Comma':
        a.command('settings')
        return true
      case 'KeyJ':
        a.command('downloads')
        return true
      case 'KeyB':
        a.command('toggle-sidebar')
        return true
      case 'KeyM':
        if (!shift) return false
        a.command('memory')
        return true
      case 'Slash':
        a.command('shortcuts')
        return true
      case 'PageDown':
        a.cycleTab(1)
        return true
      case 'PageUp':
        a.cycleTab(-1)
        return true
      case 'KeyI':
        if (!shift) return false
        a.devtools()
        return true
      case 'BracketLeft':
        if (!isMac) return false
        a.back()
        return true
      case 'BracketRight':
        if (!isMac) return false
        a.forward()
        return true
    }
  }

  if (input.control && code === 'Tab') {
    a.cycleTab(shift ? -1 : 1)
    return true
  }
  if (alt && !mod && !shift) {
    if (code === 'ArrowLeft') {
      a.back()
      return true
    }
    if (code === 'ArrowRight') {
      a.forward()
      return true
    }
  }
  if (!mod && !alt) {
    switch (code) {
      case 'F5':
        a.reload(input.control || shift)
        return true
      case 'F11':
        a.toggleFocusMode()
        return true
      case 'F3':
        a.command('find')
        return true
      case 'F1':
        a.command('shortcuts')
        return true
      case 'F12':
        a.devtools()
        return true
    }
  }
  return false
}

// ------------------------------------------------------------------ global hotkeys

const registered = new Map<string, { accelerator: string; fn: () => void }>()

/** Registers or replaces a global hotkey. Returns false if the OS refused it. */
export function setGlobalHotkey(name: string, accelerator: string, fn: () => void): boolean {
  const prev = registered.get(name)
  if (prev) {
    if (!recording) globalShortcut.unregister(prev.accelerator)
    registered.delete(name)
  }
  if (!accelerator) return true
  if (recording) {
    registered.set(name, { accelerator, fn })
    return true
  }
  try {
    const ok = globalShortcut.register(accelerator, fn)
    if (ok) registered.set(name, { accelerator, fn })
    return ok
  } catch {
    return false
  }
}

/**
 * While a new hotkey is being recorded, every shortcut is released so the key combination
 * reaches the settings page instead of triggering an action.
 */
export function setHotkeyRecording(on: boolean): void {
  if (on === recording) return
  recording = on
  for (const { accelerator, fn } of registered.values()) {
    if (on) globalShortcut.unregister(accelerator)
    else {
      try {
        globalShortcut.register(accelerator, fn)
      } catch {
        /* taken meanwhile */
      }
    }
  }
}

export function isHotkeyAvailable(accelerator: string): boolean {
  if (!accelerator) return true
  if ([...registered.values()].some((r) => r.accelerator === accelerator)) return true
  try {
    if (globalShortcut.isRegistered(accelerator)) return false
    const ok = globalShortcut.register(accelerator, () => {})
    if (ok) globalShortcut.unregister(accelerator)
    return ok
  } catch {
    return false
  }
}
