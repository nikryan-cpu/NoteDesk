import { describe, expect, it } from 'vitest'
import { findDeepLinkArg, parseDeepLink } from '@shared/deeplink'

describe('parseDeepLink', () => {
  it('parses an open link to an allowed Google url', () => {
    const raw = 'notedesk://open?url=https%3A%2F%2Fnotebook.google%2Fnotebook%2Fabc'
    expect(parseDeepLink(raw)).toEqual({ type: 'open', url: 'https://notebook.google/notebook/abc' })
  })

  it('rejects a target that is not a Google host', () => {
    const raw = 'notedesk://open?url=https%3A%2F%2Fevil.com'
    expect(parseDeepLink(raw)).toBeNull()
  })

  it('rejects an http target', () => {
    const raw = 'notedesk://open?url=http%3A%2F%2Fnotebook.google%2Fnotebook%2Fabc'
    expect(parseDeepLink(raw)).toBeNull()
  })

  it('rejects a javascript: target', () => {
    const raw = 'notedesk://open?url=javascript%3Aalert(1)'
    expect(parseDeepLink(raw)).toBeNull()
  })

  it('parses new/gemini', () => {
    expect(parseDeepLink('notedesk://new/gemini')).toEqual({ type: 'new', service: 'gemini' })
  })

  it('parses new with no service to notebook', () => {
    expect(parseDeepLink('notedesk://new')).toEqual({ type: 'new', service: 'notebook' })
  })

  it('parses quick', () => {
    expect(parseDeepLink('notedesk://quick')).toEqual({ type: 'quick' })
  })

  it('returns null for an unknown route', () => {
    expect(parseDeepLink('notedesk://somethingelse')).toBeNull()
  })

  it('returns null for other protocols', () => {
    expect(parseDeepLink('https://notebook.google/notebook/abc')).toBeNull()
  })

  it('returns null for garbage input', () => {
    expect(parseDeepLink('not a url at all')).toBeNull()
  })

  it('matches the route case-insensitively', () => {
    const raw = 'notedesk://OPEN?url=https%3A%2F%2Fnotebook.google%2Fnotebook%2Fabc'
    expect(parseDeepLink(raw)).toEqual({ type: 'open', url: 'https://notebook.google/notebook/abc' })
    expect(parseDeepLink('notedesk://QUICK')).toEqual({ type: 'quick' })
  })
})

describe('findDeepLinkArg', () => {
  it('picks the notedesk: argument out of argv', () => {
    const argv = ['/path/to/NoteDesk.exe', '--flag', 'notedesk://open?url=https%3A%2F%2Fnotebook.google%2Fnotebook%2Fabc']
    expect(findDeepLinkArg(argv)).toBe(argv[2])
  })

  it('matches case-insensitively', () => {
    const argv = ['app.exe', 'NOTEDESK://quick']
    expect(findDeepLinkArg(argv)).toBe('NOTEDESK://quick')
  })

  it('returns null when there is no deep link argument', () => {
    expect(findDeepLinkArg(['app.exe', '--flag', 'value'])).toBeNull()
  })
})
