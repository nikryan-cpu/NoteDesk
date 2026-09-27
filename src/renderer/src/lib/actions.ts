// Shell-side helpers for common actions (used by title bar, sidebar and palette).
import type { MenuItemSpec } from '@shared/ipc'
import { SERVICE_IDS, SERVICES, type ServiceId } from '@shared/services'
import { t } from './i18n'
import { nd, ui } from './state.svelte'

export function newTab(service?: ServiceId, profileId?: string): void {
  void nd.invoke('tabs:create', { service, profileId })
}

/** Notebook, Gemini and whichever chat services are enabled, in SERVICE_IDS order. */
export function availableServices(): ServiceId[] {
  const enabled = new Set<ServiceId>(['notebook', 'gemini', ...ui.settings.enabledModels])
  return SERVICE_IDS.filter((id) => enabled.has(id))
}

/** Display name of a service: the translated name for Google's own, the product name otherwise. */
export function serviceName(id: ServiceId | null): string {
  if (id === 'gemini') return t('service.gemini')
  if (id && id !== 'notebook') return SERVICES[id].name
  return t('service.notebook')
}

function shortName(id: ServiceId): string {
  if (id === 'notebook') return t('service.notebook.short')
  if (id === 'gemini') return t('service.gemini.short')
  return SERVICES[id].name
}

function newTabLabel(id: ServiceId): string {
  if (id === 'notebook') return t('tabs.newNotebook')
  if (id === 'gemini') return t('tabs.newGemini')
  return t('tabs.newService', { name: SERVICES[id].name })
}

/** Native dropdown for the "+" button: service × account. */
export async function newTabMenu(): Promise<void> {
  const profiles = ui.settings.profiles
  const services = availableServices()
  const items: MenuItemSpec[] = services.map((id) => ({ id, label: newTabLabel(id) }))
  if (profiles.length > 1) {
    for (const p of profiles) {
      items.push({ type: 'separator' })
      for (const id of services) {
        items.push({ id: `${id}:${p.id}`, label: `${shortName(id)} · ${p.name}` })
      }
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
