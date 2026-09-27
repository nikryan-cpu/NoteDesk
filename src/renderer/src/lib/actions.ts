// Shell-side helpers for common actions (used by title bar, sidebar and palette).
import type { MenuItemSpec } from '@shared/ipc'
import type { ServiceId } from '@shared/services'
import { t } from './i18n'
import { nd, ui } from './state.svelte'

export function newTab(service?: ServiceId, profileId?: string): void {
  void nd.invoke('tabs:create', { service, profileId })
}

/** Native dropdown for the "+" button: service × account. */
export async function newTabMenu(): Promise<void> {
  const profiles = ui.settings.profiles
  const items: MenuItemSpec[] = [
    { id: 'notebook', label: t('tabs.newNotebook') },
    { id: 'gemini', label: t('tabs.newGemini') },
  ]
  if (profiles.length > 1) {
    for (const p of profiles) {
      items.push({ type: 'separator' })
      items.push({ id: `notebook:${p.id}`, label: `${t('service.notebook.short')} · ${p.name}` })
      items.push({ id: `gemini:${p.id}`, label: `${t('service.gemini.short')} · ${p.name}` })
    }
  }
  items.push({ type: 'separator' }, { id: 'reopen', label: t('tabs.reopen') })
  const picked = await nd.invoke('menu:popup', items)
  if (!picked) return
  if (picked === 'reopen') return void nd.invoke('tabs:reopen')
  const [service, profileId] = picked.split(':') as [ServiceId, string | undefined]
  newTab(service, profileId)
}

export function profileColor(profileId: string): string | null {
  const profiles = ui.settings.profiles
  if (profiles.length < 2) return null
  return profiles.find((p) => p.id === profileId)?.color ?? null
}

export function profileName(profileId: string): string {
  return ui.settings.profiles.find((p) => p.id === profileId)?.name ?? ''
}
