// IPC surface for the Ask window. Registered through the same `handle` the shell's channels use,
// so every ask:* call gets the same sender trust check.
import { sanitizeModelOptions } from '@shared/ask'
import type { InvokeChannel, InvokeMap } from '@shared/ipc'
import { isModelId, type ModelId } from '@shared/services'
import type { AskEngine } from './engine'

type Handle = <K extends InvokeChannel>(
  channel: K,
  fn: (...args: Parameters<InvokeMap[K]>) => ReturnType<InvokeMap[K]> | Promise<ReturnType<InvokeMap[K]>>,
) => void

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')

function requireModel(v: unknown): ModelId {
  if (!isModelId(v)) throw new Error('unknown model')
  return v
}

function cleanModels(v: unknown): ModelId[] {
  return Array.isArray(v) ? v.filter(isModelId) : []
}

export function registerAskIpc(engine: AskEngine, handle: Handle): void {
  handle('ask:init', () => engine.init())
  handle('ask:list', () => engine.list())
  handle('ask:get', (conversationId) => engine.get(str(conversationId, 100)))

  handle('ask:send', (req) => {
    const prompt = str(req?.prompt, 20000).trim()
    if (!prompt) throw new Error('empty prompt')
    const models = cleanModels(req?.models)
    if (models.length === 0) throw new Error('no models selected')
    const conversationId = typeof req?.conversationId === 'string' ? req.conversationId.slice(0, 100) : null
    return engine.send({ conversationId, prompt, models })
  })

  handle('ask:stop', (conversationId) => engine.stop(str(conversationId, 100)))
  handle('ask:retry', (conversationId, turnId, model) => engine.retry(str(conversationId, 100), str(turnId, 100), requireModel(model)))
  handle('ask:setModels', (conversationId, models) => engine.setModels(str(conversationId, 100), cleanModels(models)))
  handle('ask:rename', (conversationId, title) => engine.rename(str(conversationId, 100), str(title, 200)))
  handle('ask:pin', (conversationId, pinned) => engine.pin(str(conversationId, 100), Boolean(pinned)))
  handle('ask:delete', (conversationId) => engine.delete(str(conversationId, 100)))
  handle('ask:openThread', (conversationId, model) => engine.openThread(str(conversationId, 100), requireModel(model)))
  handle('ask:models', () => engine.models())
  handle('ask:checkModels', (models) => engine.checkModels(Array.isArray(models) ? cleanModels(models) : undefined))
  handle('ask:login', (model) => engine.login(requireModel(model)))
  handle('ask:showPage', (model) => engine.showPage(requireModel(model)))

  handle('ask:setOptions', (conversationId, model, options) => {
    const id = typeof conversationId === 'string' ? conversationId.slice(0, 100) : null
    engine.setOptions(id, requireModel(model), sanitizeModelOptions(options))
  })
  handle('ask:diagnose', (model) => engine.diagnose(requireModel(model)))
}
