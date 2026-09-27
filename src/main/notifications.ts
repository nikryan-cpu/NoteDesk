// "Studio output is ready" notifications. The content preload watches the page and reports
// when a generation it saw start has finished; main decides whether the user needs a ping.
import { ipcMain, Notification } from 'electron'
import { t } from './i18n'
import { getSettings } from './settings'
import type { MainWindow } from './window'

export function initGenerationNotifications(mw: MainWindow): void {
  let last = 0
  ipcMain.on('content:generation-done', (event) => {
    if (!getSettings().notifyGenerationDone || !Notification.isSupported()) return
    const tab = mw.tabs.byWebContents(event.sender)
    if (!tab) return
    const visible = mw.win.isFocused() && mw.tabs.active()?.id === tab.id
    if (visible || Date.now() - last < 5000) return
    last = Date.now()
    const n = new Notification({
      title: t('notifications.generationDoneTitle', { tab: tab.title || 'Gemini Notebook' }),
      body: t('notifications.generationDoneBody'),
    })
    n.on('click', () => {
      mw.show()
      mw.tabs.activate(tab.id)
    })
    n.show()
  })
}
