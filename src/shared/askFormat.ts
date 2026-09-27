// Pure formatting helpers for the Ask tab's composer and answer cards. Kept free of app state
// and i18n calls so they stay easy to unit test; callers pass in already-translated strings
// where needed. Lives in shared (not src/renderer) so tests/unit can import it directly.
import { SERVICES, type ModelId } from './services'
import type { ModelCapabilities, ModelOptions } from './ask'

/** Model button label: the single model's name, or "Gemini +2" once comparing several. */
export function modelButtonLabel(models: ModelId[], morePart: (extra: number) => string): string {
  if (models.length === 0) return ''
  const first = SERVICES[models[0]].name
  if (models.length === 1) return first
  return `${first} ${morePart(models.length - 1)}`
}

/** "Opus · Thinking · Search" summary of the options an answer was produced with. */
export function formatOptionsLine(
  options: ModelOptions | undefined,
  caps: ModelCapabilities | undefined,
  labels: { thinking: string; search: string },
): string {
  if (!options) return ''
  const parts: string[] = []
  if (options.variant) {
    const variant = caps?.variants.find((v) => v.id === options.variant)
    parts.push(variant ? variant.label : options.variant)
  }
  if (options.thinking) parts.push(labels.thinking)
  if (options.search) parts.push(labels.search)
  return parts.join(' · ')
}
