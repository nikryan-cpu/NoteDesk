// Best-effort detector for "a Studio item finished generating". Google's markup changes often,
// so it relies on generic signals only: a progress indicator whose surrounding text mentions
// generating, which has been visible for a while and then disappears.

const BUSY = '[role="progressbar"], [aria-busy="true"], mat-progress-spinner, mat-spinner, .mat-mdc-progress-spinner'
const WORDS = /generat|creating|preparing|создан|генерир|подготов|готовим/i
const MIN_BUSY_MS = 20_000

function generatingCount(): number {
  let n = 0
  for (const el of document.querySelectorAll(BUSY)) {
    const box = el.closest('[role="listitem"], li, mat-card, [class*="artifact"], [class*="studio"]') ?? el.parentElement
    const text = (box?.textContent ?? '').slice(0, 400)
    if (WORDS.test(text) || WORDS.test(el.getAttribute('aria-label') ?? '')) n++
  }
  return n
}

export function watchGenerations(onDone: () => void): void {
  let busySince: number | null = null
  let lastCount = 0
  let scheduled = false

  const check = () => {
    scheduled = false
    const n = generatingCount()
    if (n > 0 && busySince === null) busySince = Date.now()
    if (n < lastCount && busySince !== null && Date.now() - busySince >= MIN_BUSY_MS) onDone()
    if (n === 0) busySince = null
    lastCount = n
  }

  const schedule = () => {
    if (scheduled) return
    scheduled = true
    setTimeout(check, 1500)
  }

  const start = () => {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'role'] })
    // Mutations alone can miss a spinner that simply stops; poll slowly while something runs.
    setInterval(() => {
      if (lastCount > 0) check()
    }, 5000)
  }

  if (document.body) start()
  else window.addEventListener('DOMContentLoaded', start, { once: true })
}
