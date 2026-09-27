// Main-world patch for navigator.userAgentData, executed through
// contextBridge.executeInMainWorld from the content preload. It is serialised, so it must stay
// self-contained (no references to anything outside the function body).
import type { UaDataPatch } from './compat'

/**
 * Runs in the page's main world (serialised by contextBridge.executeInMainWorld), before page
 * scripts, so navigator.userAgentData agrees with the UA string and Sec-CH-UA headers.
 * Must be self-contained: no closures over module scope.
 */
export function mainWorldPatch(p: UaDataPatch): void {
  try {
    const masked = new WeakMap<object, string>()
    const nativeToString = Function.prototype.toString
    const toStringProxy = new Proxy(nativeToString, {
      apply(target, thisArg, args) {
        const fake = masked.get(thisArg as object)
        return fake ?? Reflect.apply(target, thisArg, args)
      },
    })
    masked.set(toStringProxy, 'function toString() { [native code] }')
    Object.defineProperty(Function.prototype, 'toString', { value: toStringProxy, configurable: true, writable: true })
    const mask = <T extends object>(fn: T, name: string): T => {
      masked.set(fn, `function ${name}() { [native code] }`)
      return fn
    }

    const navProto = Object.getPrototypeOf(navigator) as object
    if (p.remove) {
      if ('userAgentData' in navProto) delete (navProto as Record<string, unknown>).userAgentData
      return
    }
    // Electron exposes an empty `window.chrome`; desktop Chrome has app/csi/loadTimes on it.
    const w = window as unknown as { chrome?: Record<string, unknown> }
    if (w.chrome && !('app' in w.chrome)) {
      const start = performance.timeOrigin
      w.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: mask(function getDetails() {
          return null
        }, 'getDetails'),
        getIsInstalled: mask(function getIsInstalled() {
          return false
        }, 'getIsInstalled'),
        runningState: mask(function runningState() {
          return 'cannot_run'
        }, 'runningState'),
      }
      w.chrome.csi = mask(function csi() {
        return { startE: start, onloadT: start + 300, pageT: performance.now(), tran: 15 }
      }, 'csi')
      w.chrome.loadTimes = mask(function loadTimes() {
        const t = start / 1000
        return {
          requestTime: t,
          startLoadTime: t,
          commitLoadTime: t + 0.1,
          finishDocumentLoadTime: t + 0.3,
          finishLoadTime: t + 0.4,
          firstPaintTime: t + 0.2,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'h2',
        }
      }, 'loadTimes')
    }

    const uad = (navigator as Navigator & { userAgentData?: object }).userAgentData
    if (!uad) return
    const proto = Object.getPrototypeOf(uad) as Record<string, unknown>
    const clone = (list: { brand: string; version: string }[]) => list.map((b) => ({ brand: b.brand, version: b.version }))

    Object.defineProperty(proto, 'brands', {
      get: mask(function () {
        return clone(p.brands)
      }, 'get brands'),
      configurable: true,
      enumerable: true,
    })

    const origHev = proto.getHighEntropyValues as (this: unknown, hints: string[]) => Promise<Record<string, unknown>>
    Object.defineProperty(proto, 'getHighEntropyValues', {
      value: mask(function getHighEntropyValues(this: unknown, hints: string[]) {
        return origHev.call(this, hints).then((v) => {
          const out: Record<string, unknown> = { ...v, brands: clone(p.brands), platform: p.platform }
          const want = (h: string) => Array.isArray(hints) && hints.includes(h)
          if (want('fullVersionList')) out.fullVersionList = clone(p.fullVersionList)
          if (want('uaFullVersion')) out.uaFullVersion = p.fullVersion
          if (want('platformVersion') && !v.platformVersion) out.platformVersion = p.platformVersion
          if (want('architecture') && !v.architecture) out.architecture = p.architecture
          if (want('bitness') && !v.bitness) out.bitness = p.bitness
          return out
        })
      }, 'getHighEntropyValues'),
      configurable: true,
      writable: true,
      enumerable: true,
    })

    const origToJSON = proto.toJSON as ((this: unknown) => Record<string, unknown>) | undefined
    if (origToJSON) {
      Object.defineProperty(proto, 'toJSON', {
        value: mask(function toJSON(this: unknown) {
          const o = origToJSON.call(this)
          o.brands = clone(p.brands)
          return o
        }, 'toJSON'),
        configurable: true,
        writable: true,
        enumerable: true,
      })
    }
  } catch {
    /* never break the page */
  }
}
