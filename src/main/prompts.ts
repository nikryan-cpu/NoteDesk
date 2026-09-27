// Prompt library. Snippets are inserted with webContents.insertText() into whatever field has
// focus in the active tab, so the feature does not depend on Google's DOM structure.
import type { PromptSnippet } from '@shared/ipc'
import type { I18nKey } from '@shared/i18n'
import { t } from './i18n'
import { readJson, writeJson } from './store'

let prompts: PromptSnippet[] | null = null

function defaults(): PromptSnippet[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    id: `default-${n}`,
    title: t(`prompts.d${n}.title` as I18nKey),
    text: t(`prompts.d${n}.text` as I18nKey),
  }))
}

export function listPrompts(): PromptSnippet[] {
  if (!prompts) {
    const raw = readJson<unknown>('prompts', null)
    prompts = Array.isArray(raw) ? (raw as PromptSnippet[]).filter((p) => p && typeof p.text === 'string') : defaults()
  }
  return prompts
}

function persist(): void {
  writeJson('prompts', () => prompts)
}

export function savePrompt(p: PromptSnippet): PromptSnippet[] {
  const list = listPrompts()
  const clean: PromptSnippet = {
    id: String(p.id || `p${Date.now().toString(36)}`).slice(0, 40),
    title: String(p.title ?? '').slice(0, 120).trim() || String(p.text ?? '').slice(0, 40),
    text: String(p.text ?? '').slice(0, 20000),
  }
  const i = list.findIndex((x) => x.id === clean.id)
  if (i >= 0) list[i] = clean
  else list.unshift(clean)
  persist()
  return list
}

export function deletePrompt(id: string): PromptSnippet[] {
  prompts = listPrompts().filter((p) => p.id !== id)
  persist()
  return prompts
}
