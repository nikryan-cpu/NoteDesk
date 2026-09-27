import { app, BaseWindow, nativeTheme, Notification } from 'electron'
import { resolve } from 'node:path'
import { findDeepLinkArg, parseDeepLink, PROTOCOL } from '@shared/deeplink'
import type { ShellCommand } from '@shared/ipc'
import type { ServiceId } from '@shared/services'
import { AskEngine } from './ask/engine'
import { emit } from './bus'
import { initCompat } from './compat'
import { loadHistory } from './history'
import { t } from './i18n'
import { registerIpc } from './ipc'
import { initGenerationNotifications } from './notifications'
import { applyProxyEverywhere, initProxyAuth } from './proxy'
import { QuickWindow } from './quick'
import { allSessions, applySpellcheck } from './sessions'
import { getSettings, loadSettings, onSettingsChange, publicSettings, updateSettings } from './settings'
import { setGlobalHotkey, setShortcutActions } from './shortcuts'
import { flushAll } from './store'
import { createTray, rebuildTrayMenu } from './tray'
import { initUpdater } from './updater'
import { isDarkNow, MainWindow } from './window'

if (process.env['NOTEDESK_USER_DATA']) app.setPath('userData', process.env['NOTEDESK_USER_DATA'])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  const settings = loadSettings()
  if (!settings.hardwareAcceleration) app.disableHardwareAcceleration()
  initCompat(settings.compatPreset)
  app.setAppUserModelId('io.github.nikryan-cpu.notedesk')
  app.setName('NoteDesk')

  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }

  let mw: MainWindow | null = null
  let quick: QuickWindow | null = null
  let ask: AskEngine | null = null
  let pendingLink: string | null = findDeepLinkArg(process.argv)

  const startHidden =
    process.argv.includes('--hidden') || (settings.startMinimized && app.getLoginItemSettings().wasOpenedAtLogin)

  const handleLink = (raw: string | null) => {
    if (!raw || !mw) return
    const link = parseDeepLink(raw)
    if (!link) return
    if (link.type === 'quick') return quick?.show()
    mw.show()
    if (link.type === 'open') mw.tabs.create({ url: link.url })
    else mw.tabs.create({ service: link.service })
  }

  app.on('second-instance', (_e, argv) => {
    const link = findDeepLinkArg(argv)
    if (link) handleLink(link)
    else mw?.show()
  })
  app.on('open-url', (e, url) => {
    e.preventDefault()
    if (mw) handleLink(url)
    else pendingLink = url
  })

  app.whenReady().then(() => {
    loadHistory()
    initProxyAuth()

    mw = new MainWindow({
      startHidden,
      onFirstHideToTray: () => {
        if (!Notification.isSupported()) return
        const hotkey = getSettings().hotkeys.toggleWindow.replace('CommandOrControl', process.platform === 'darwin' ? 'Cmd' : 'Ctrl')
        new Notification({ title: t('tray.hiddenTitle'), body: t('tray.hiddenBody', { hotkey }), silent: true }).show()
      },
    })
    const main = mw
    quick = new QuickWindow(isDarkNow, (url) => {
      main.show()
      if (url) main.tabs.create({ url })
    })
    const q = quick
    ask = new AskEngine(
      (url) => {
        main.show()
        main.tabs.create({ url })
      },
      () => q.uiWebContents(),
    )
    const engine = ask

    const command = (cmd: ShellCommand) => {
      if (!main.isShown()) main.show()
      emit('command', cmd)
    }
    const activeId = () => main.tabs.active()?.id

    setShortcutActions({
      newTab: (service?: ServiceId) => main.tabs.create({ service }),
      closeTab: () => {
        const id = activeId()
        if (id) main.tabs.close(id)
      },
      reopenTab: () => main.tabs.reopenClosed(),
      cycleTab: (dir) => main.tabs.cycle(dir),
      selectTab: (n) => main.tabs.selectIndex(n),
      reload: (hard) => {
        const wc = main.tabs.activeWebContents()
        const id = activeId()
        if (hard && wc) wc.reloadIgnoringCache()
        else if (id) main.tabs.reload(id)
      },
      back: () => {
        const id = activeId()
        if (id) main.tabs.navigate(id, 'back')
      },
      forward: () => {
        const id = activeId()
        if (id) main.tabs.navigate(id, 'forward')
      },
      zoom: (dir) => {
        const id = activeId()
        if (id) main.tabs.zoom(id, dir)
      },
      command,
      toggleFocusMode: () => main.toggleFocusMode(),
      devtools: () => {
        if (app.isPackaged) return
        const wc = main.isOverlayOpen() ? main.shell.webContents : (main.tabs.activeWebContents() ?? main.shell.webContents)
        wc.openDevTools({ mode: 'detach' })
      },
    })

    registerIpc(main, q, engine)
    initGenerationNotifications(main)

    createTray({
      toggle: () => main.toggle(),
      isVisible: () => main.win.isVisible(),
      newTab: (service) => {
        main.show()
        main.tabs.create({ service })
      },
      quickAsk: () => q.show(),
      sleepAll: () => void main.tabs.sleepAll(),
      settings: () => command('settings'),
      quit: () => {
        main.quitting = true
        app.quit()
      },
    })
    main.win.on('show', rebuildTrayMenu)
    main.win.on('hide', rebuildTrayMenu)
    // The main window is never recreated, so once it really closes the app is done
    // (a hidden Quick Ask window would otherwise keep the process alive).
    main.win.on('closed', () => {
      main.quitting = true
      q.destroy()
      engine.dispose()
      app.quit()
    })

    const registerHotkeys = () => {
      const s = getSettings()
      setGlobalHotkey('toggle', s.hotkeys.toggleWindow, () => main.toggle())
      setGlobalHotkey('quick', s.hotkeys.quickAsk, () => q.toggle())
    }
    registerHotkeys()

    main.tabs.restore()
    if (pendingLink) {
      handleLink(pendingLink)
      pendingLink = null
    }

    app.setLoginItemSettings({ openAtLogin: getSettings().launchAtLogin, args: ['--hidden'] })

    onSettingsChange((next, prev) => {
      emit('settings', publicSettings())
      if (next.theme !== prev.theme || next.colorMode !== prev.colorMode) {
        main.applyTheme()
        q.restyle()
      }
      if (next.spellcheck !== prev.spellcheck || next.spellcheckLanguages.join() !== prev.spellcheckLanguages.join()) applySpellcheck()
      if (JSON.stringify(next.proxy) !== JSON.stringify(prev.proxy)) void applyProxyEverywhere(allSessions())
      if (next.hotkeys.toggleWindow !== prev.hotkeys.toggleWindow || next.hotkeys.quickAsk !== prev.hotkeys.quickAsk) registerHotkeys()
      if (next.launchAtLogin !== prev.launchAtLogin) app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ['--hidden'] })
      if (next.locale !== prev.locale) rebuildTrayMenu()
      if (next.restoreSession !== prev.restoreSession) main.tabs.save()
    })

    nativeTheme.on('updated', () => {
      emit('system-theme', { dark: nativeTheme.shouldUseDarkColors })
      if (getSettings().colorMode === 'system') {
        main.applyTheme()
        q.restyle()
      }
    })

    if (getSettings().lastSeenVersion !== app.getVersion()) {
      updateSettings({ lastSeenVersion: app.getVersion() })
    }
    initUpdater()

    app.on('activate', () => main.show())
  })

  app.on('before-quit', () => {
    if (mw) mw.quitting = true
    mw?.tabs.save()
    flushAll()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && BaseWindow.getAllWindows().length === 0) app.quit()
  })
}
