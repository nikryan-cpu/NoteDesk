import { describe, expect, it } from 'vitest'
import { hexToRgb, luminance, readableOn, solidColor, THEME_IDS, THEMES, type ThemeTokens } from '@shared/themes'

const TOKEN_KEYS: (keyof ThemeTokens)[] = [
  'bg',
  'surface',
  'surface2',
  'border',
  'text',
  'text2',
  'text3',
  'accent',
  'accentText',
  'tabActive',
  'tabActiveText',
  'tabHover',
  'scrim',
  'shadow',
  'contentShadow',
  'danger',
  'success',
  'warning',
]

describe('THEMES', () => {
  it('has an entry for every THEME_IDS id, with all ThemeTokens keys for light and dark', () => {
    for (const id of THEME_IDS) {
      const def = THEMES[id]
      expect(def, id).toBeDefined()
      for (const key of TOKEN_KEYS) {
        expect(def.light[key], `${id}.light.${key}`).toBeTruthy()
        expect(def.dark[key], `${id}.dark.${key}`).toBeTruthy()
      }
    }
  })

  it('uses the same palette for light and dark on dark-only themes', () => {
    for (const id of THEME_IDS) {
      const def = THEMES[id]
      if (def.modes === 'dark') expect(def.light).toEqual(def.dark)
    }
  })
})

describe('hexToRgb', () => {
  it('parses #rrggbb', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
    expect(hexToRgb('#ff0000')).toEqual([255, 0, 0])
  })
})

describe('luminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 5)
    expect(luminance('#000000')).toBeCloseTo(0, 5)
  })
})

describe('readableOn', () => {
  it('picks dark text on a light background', () => {
    expect(readableOn('#ffffff')).toBe('#111111')
  })

  it('picks light text on a dark background', () => {
    expect(readableOn('#000000')).toBe('#ffffff')
  })
})

describe('solidColor', () => {
  it('returns the color when it is a valid hex', () => {
    expect(solidColor('#abcdef', '#000000')).toBe('#abcdef')
  })

  it('returns the fallback for a non-hex color', () => {
    expect(solidColor('rgba(0,0,0,0.5)', '#000000')).toBe('#000000')
    expect(solidColor('red', '#000000')).toBe('#000000')
  })
})
