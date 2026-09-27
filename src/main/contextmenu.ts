// Right-click menu for web content. Electron shows nothing by default.
import { app, clipboard, Menu, shell, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { isAllowedInApp, isSafeExternal, serviceForUrl } from '@shared/services'
import { t } from './i18n'
import { listPrompts } from './prompts'

interface Options {
  openInNewTab?: (url: string) => void
}

export function attachContentContextMenu(wc: WebContents, opts: Options): void {
  wc.on('context-menu', (_e, params) => {
    const items: MenuItemConstructorOptions[] = []
    const sep = () => {
      if (items.length && items[items.length - 1]!.type !== 'separator') items.push({ type: 'separator' })
    }

    if (params.misspelledWord) {
      const suggestions = params.dictionarySuggestions.slice(0, 5)
      if (suggestions.length === 0) items.push({ label: t('ctx.noSuggestions'), enabled: false })
      for (const s of suggestions) items.push({ label: s, click: () => wc.replaceMisspelling(s) })
      items.push({
        label: t('ctx.addToDictionary'),
        click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      })
      sep()
    }

    if (params.linkURL) {
      const url = params.linkURL
      if (opts.openInNewTab && serviceForUrl(url) && isAllowedInApp(url)) {
        items.push({ label: t('ctx.openLinkTab'), click: () => opts.openInNewTab!(url) })
      }
      if (isSafeExternal(url)) items.push({ label: t('ctx.openLinkBrowser'), click: () => void shell.openExternal(url) })
      items.push({ label: t('ctx.copyLink'), click: () => clipboard.writeText(url) })
      sep()
    }

    if (params.mediaType === 'image' && params.srcURL) {
      items.push({ label: t('ctx.copyImage'), click: () => wc.copyImageAt(params.x, params.y) })
      items.push({ label: t('ctx.saveImage'), click: () => wc.downloadURL(params.srcURL) })
      sep()
    }

    if (params.isEditable) {
      const f = params.editFlags
      items.push(
        { label: t('ctx.undo'), role: 'undo', enabled: f.canUndo },
        { label: t('ctx.redo'), role: 'redo', enabled: f.canRedo },
        { type: 'separator' },
        { label: t('ctx.cut'), role: 'cut', enabled: f.canCut },
        { label: t('ctx.copy'), role: 'copy', enabled: f.canCopy },
        { label: t('ctx.paste'), role: 'paste', enabled: f.canPaste },
        { label: t('ctx.pastePlain'), role: 'pasteAndMatchStyle', enabled: f.canPaste },
        { label: t('ctx.selectAll'), role: 'selectAll', enabled: f.canSelectAll },
      )
      const prompts = listPrompts()
      if (prompts.length) {
        sep()
        items.push({
          label: t('ctx.insertPrompt'),
          submenu: prompts.slice(0, 20).map((p) => ({ label: p.title, click: () => wc.insertText(p.text) })),
        })
      }
    } else if (params.selectionText.trim()) {
      items.push({ label: t('ctx.copy'), role: 'copy' })
    }

    if (!params.isEditable && !params.linkURL && !params.selectionText.trim() && params.mediaType === 'none') {
      const h = wc.navigationHistory
      items.push(
        { label: t('nav.back'), enabled: h.canGoBack(), click: () => h.goBack() },
        { label: t('nav.forward'), enabled: h.canGoForward(), click: () => h.goForward() },
        { label: t('nav.reload'), click: () => wc.reload() },
      )
    }

    if (!app.isPackaged) {
      sep()
      items.push({ label: t('ctx.inspect'), click: () => wc.inspectElement(params.x, params.y) })
    }

    while (items.length && items[items.length - 1]!.type === 'separator') items.pop()
    if (items.length) Menu.buildFromTemplate(items).popup({ frame: params.frame ?? undefined })
  })
}
