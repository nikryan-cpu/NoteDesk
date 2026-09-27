// Per-service adapters: where things live on each chat service's page, and how to tell a
// live chat URL and a login page apart. Sites redesign their markup without notice - when a
// selector stops matching, this is the file to fix. Every list is ordered most-specific-first
// with a couple of generic fallbacks at the end, so a small markup tweak upstream doesn't need
// an update here.
import { app } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ModelId } from '@shared/services'
import { SERVICES, isChatUrl } from '@shared/services'
import type { ModelAdapter, PageConfig } from './types'

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Gemini (gemini.google.com) - signed in through the regular Google account
// ---------------------------------------------------------------------------------------------
const geminiPage: PageConfig = {
  composer: ['rich-textarea .ql-editor[contenteditable="true"]', 'div.ql-editor[contenteditable="true"]', '.ql-editor[contenteditable="true"]'],
  send: ['button.send-button', 'button[aria-label*="Send" i]', 'button[data-testid="send-button"]'],
  stop: ['button[aria-label*="Stop" i]', 'button[aria-label*="stop response" i]'],
  assistant: ['model-response', 'message-content'],
  answerBody: ['.markdown', 'message-content'],
  signedOut: ['a[href*="ServiceLogin"]', 'a[href*="accounts.google.com/v3/signin"]', 'a[href*="accounts.google.com/ServiceLogin"]'],
  signedIn: ['a[aria-label*="Google Account" i]', 'img.gb_P', '[data-ogsr-up]'],
  submitWith: 'enter',
}

function isGeminiLogin(raw: string): boolean {
  const url = parseUrl(raw)
  return !!url && url.hostname === 'accounts.google.com'
}

const gemini: ModelAdapter = {
  id: 'gemini',
  newChatUrl: SERVICES.gemini.home,
  loginUrl: SERVICES.gemini.loginUrl,
  isThreadUrl: (url) => isChatUrl(url, 'gemini'),
  isLoginUrl: isGeminiLogin,
  page: geminiPage,
}

// ---------------------------------------------------------------------------------------------
// Claude (claude.ai)
// ---------------------------------------------------------------------------------------------
const claudePage: PageConfig = {
  composer: ['div.ProseMirror[contenteditable="true"]', '[data-testid="chat-input"] [contenteditable="true"]', 'div[contenteditable="true"][translate="no"]'],
  send: ['button[aria-label="Send message"]', 'button[aria-label*="Send" i]', 'button[data-testid="send-button"]'],
  stop: ['button[aria-label="Stop response"]', 'button[aria-label*="Stop" i]'],
  assistant: ['[data-is-streaming]', 'div.font-claude-response', '.font-claude-message'],
  answerBody: ['div.font-claude-response', '.font-claude-message'],
  strip: ['[data-testid="action-bar"]', '[data-testid="message-actions"]'],
  signedOut: ['input[type="email"]', 'button[data-testid="login-with-google"]', 'button[data-testid="login-with-sso"]'],
  signedIn: ['[data-testid="user-menu-button"]'],
  submitWith: 'enter',
}

function isClaudeLogin(raw: string): boolean {
  const url = parseUrl(raw)
  return !!url && url.hostname === 'claude.ai' && url.pathname.startsWith('/login')
}

const claude: ModelAdapter = {
  id: 'claude',
  newChatUrl: SERVICES.claude.home,
  loginUrl: SERVICES.claude.loginUrl,
  isThreadUrl: (url) => isChatUrl(url, 'claude'),
  isLoginUrl: isClaudeLogin,
  page: claudePage,
}

// ---------------------------------------------------------------------------------------------
// ChatGPT (chatgpt.com)
// ---------------------------------------------------------------------------------------------
const chatgptPage: PageConfig = {
  composer: ['#prompt-textarea[contenteditable="true"]', '#prompt-textarea', 'div.ProseMirror[contenteditable="true"]'],
  send: ['[data-testid="send-button"]', '#composer-submit-button', 'button[aria-label*="Send" i]'],
  stop: ['[data-testid="stop-button"]', 'button[aria-label*="Stop" i]'],
  assistant: ['[data-message-author-role="assistant"]'],
  answerBody: ['.markdown'],
  strip: ['[data-testid="voice-play-turn-action-button"]', '[aria-label*="Copy" i]', '[aria-label*="Regenerate" i]'],
  signedOut: ['[data-testid="login-button"]', 'button[data-testid="welcome-login-button"]'],
  signedIn: ['[data-testid="accounts-profile-button"]', '[data-testid="profile-button"]'],
  submitWith: 'enter',
}

function isChatgptLogin(raw: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  if (url.hostname === 'chatgpt.com' && url.pathname.startsWith('/auth')) return true
  return url.hostname === 'auth.openai.com'
}

const chatgpt: ModelAdapter = {
  id: 'chatgpt',
  newChatUrl: SERVICES.chatgpt.home,
  loginUrl: SERVICES.chatgpt.loginUrl,
  isThreadUrl: (url) => isChatUrl(url, 'chatgpt'),
  isLoginUrl: isChatgptLogin,
  page: chatgptPage,
}

// ---------------------------------------------------------------------------------------------
// DeepSeek (chat.deepseek.com) - the send button toggles to a stop icon while generating;
// selectors for both are the least certain in this file, submitWith 'enter' is the safe bet.
// ---------------------------------------------------------------------------------------------
const deepseekPage: PageConfig = {
  composer: ['textarea#chat-input', 'textarea[placeholder]'],
  send: ['div[role="button"][aria-disabled="false"]:has(svg)', 'button[aria-label*="Send" i]'],
  stop: ['div[role="button"][aria-disabled="false"] svg[class*="stop" i]', 'button[aria-label*="Stop" i]'],
  assistant: ['.ds-markdown', 'div[class*="ds-markdown"]'],
  answerBody: ['.ds-markdown'],
  signedOut: ['input[type="password"]', 'a[href*="sign_in"]'],
  signedIn: ['div[class*="avatar" i]', '[class*="user-avatar" i]'],
  submitWith: 'enter',
}

function isDeepseekLogin(raw: string): boolean {
  const url = parseUrl(raw)
  return !!url && url.hostname === 'chat.deepseek.com' && url.pathname.startsWith('/sign_in')
}

const deepseek: ModelAdapter = {
  id: 'deepseek',
  newChatUrl: SERVICES.deepseek.home,
  loginUrl: SERVICES.deepseek.loginUrl,
  isThreadUrl: (url) => isChatUrl(url, 'deepseek'),
  isLoginUrl: isDeepseekLogin,
  page: deepseekPage,
}

// ---------------------------------------------------------------------------------------------
// Qwen (chat.qwen.ai)
// ---------------------------------------------------------------------------------------------
const qwenPage: PageConfig = {
  composer: ['textarea#chat-input', 'textarea'],
  send: ['button#send-message-button', 'button.send-button', 'button[aria-label*="send" i]'],
  stop: ['button.stop-button', 'button[aria-label*="stop" i]'],
  assistant: ['.response-message-content', '#response-content-container', '.chat-response-message'],
  answerBody: ['.markdown-content-container', '.markdown-prose'],
  signedOut: ['a[href*="/auth"]', 'button[class*="login" i]'],
  signedIn: ['[class*="avatar" i]', '[class*="user-menu" i]'],
  submitWith: 'enter',
}

function isQwenLogin(raw: string): boolean {
  const url = parseUrl(raw)
  return !!url && url.hostname === 'chat.qwen.ai' && url.pathname.startsWith('/auth')
}

const qwen: ModelAdapter = {
  id: 'qwen',
  newChatUrl: SERVICES.qwen.home,
  loginUrl: SERVICES.qwen.loginUrl,
  isThreadUrl: (url) => isChatUrl(url, 'qwen'),
  isLoginUrl: isQwenLogin,
  page: qwenPage,
}

export const ADAPTERS: Record<ModelId, ModelAdapter> = {
  gemini,
  claude,
  chatgpt,
  deepseek,
  qwen,
}

// ---------------------------------------------------------------------------------------------
// Fake adapter, used under NOTEDESK_E2E instead of the real sites - points at the bundled
// fixture so tests and local debugging never touch the network.
// ---------------------------------------------------------------------------------------------
const fakePage: PageConfig = {
  composer: ['#prompt'],
  send: ['button.send'],
  stop: ['button.stop'],
  assistant: ['.msg.assistant'],
  answerBody: ['.body'],
  signedOut: ['#login-form'],
  signedIn: ['#account'],
  submitWith: 'enter',
}

function fixtureUrl(id: ModelId): string {
  const path = join(app.getAppPath(), 'tests/fixtures/fake-chat.html')
  return `${pathToFileURL(path).href}?model=${id}`
}

function fakeAdapter(id: ModelId): ModelAdapter {
  const base = fixtureUrl(id)
  return {
    id,
    newChatUrl: base,
    loginUrl: `${base}#/login`,
    isThreadUrl: (url) => url.indexOf('#/c/') !== -1,
    isLoginUrl: (url) => url.indexOf('#/login') !== -1,
    page: fakePage,
  }
}

/** ADAPTERS[id], or a fake adapter pointing at the local fixture under NOTEDESK_E2E. */
export function adapterFor(id: ModelId): ModelAdapter {
  if (process.env['NOTEDESK_E2E']) return fakeAdapter(id)
  return ADAPTERS[id]
}
