// notedesk:// links: notedesk://open?url=<google url>, notedesk://new/gemini, notedesk://ask
// (notedesk://quick is the old route, kept working as an alias for existing shortcuts/links).
import { isAllowedInApp, SERVICE_IDS, type ServiceId } from './services'

export type DeepLink = { type: 'open'; url: string } | { type: 'new'; service: ServiceId } | { type: 'ask' }

export const PROTOCOL = 'notedesk'

/** The Ask tab's pseudo-URL: the notedesk://ask deep link, and what a saved session/closed-tab
 *  entry uses to remember "this tab was the Ask tab" without a real address. */
export const ASK_URL = `${PROTOCOL}://ask`

export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== `${PROTOCOL}:`) return null
  // notedesk://open?url=… parses with host "open"; tolerate notedesk:open?url=… too.
  const route = (url.host || url.pathname.replace(/^\/+/, '').split('/')[0] || '').toLowerCase()
  const rest = (url.host ? url.pathname : url.pathname.replace(/^\/*[^/]+/, '')).replace(/^\/+/, '').toLowerCase()
  if (route === 'open') {
    const target = url.searchParams.get('url') ?? ''
    return isAllowedInApp(target) && target.startsWith('https://') ? { type: 'open', url: target } : null
  }
  if (route === 'new') {
    const service = (SERVICE_IDS as readonly string[]).includes(rest) ? (rest as ServiceId) : 'notebook'
    return { type: 'new', service }
  }
  if (route === 'ask' || route === 'quick') return { type: 'ask' }
  return null
}

export function findDeepLinkArg(argv: string[]): string | null {
  return argv.find((a) => a.toLowerCase().startsWith(`${PROTOCOL}:`)) ?? null
}
