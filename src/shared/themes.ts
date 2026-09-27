// Theme presets. Colours live here (not in CSS) so the same source feeds the renderer's CSS
// variables, the settings gallery previews, and the main process (window background,
// native caption-button colours, Windows 11 Mica/Acrylic, macOS vibrancy).

export const THEME_IDS = [
  'minimal',
  'mica',
  'material',
  'glass',
  'aurora',
  'nord',
  'catppuccin',
  'amoled',
  'brutal',
  'paper',
] as const

export type ThemeId = (typeof THEME_IDS)[number]

export interface ThemeTokens {
  /** Window background (fallback colour when a native material is not available). */
  bg: string
  /** Optional CSS background-image painted over `bg` (gradients). */
  bgImage?: string
  surface: string
  surface2: string
  border: string
  text: string
  text2: string
  text3: string
  accent: string
  accentText: string
  tabActive: string
  tabActiveText: string
  tabHover: string
  scrim: string
  shadow: string
  contentShadow: string
  danger: string
  success: string
  warning: string
}

export type TabStyle = 'pill' | 'underline' | 'card' | 'brutal'
export type SurfaceStyle = 'flat' | 'glass' | 'brutal'

export interface ThemeDef {
  id: ThemeId
  name: string
  description: { en: string; ru: string }
  /** 'dark' = dark-only theme (light mode renders the dark palette too). */
  modes: 'both' | 'dark'
  /** Native window material. Windows 11 only for mica/acrylic; macOS uses vibrancy. */
  material: { win: 'none' | 'mica' | 'acrylic'; mac: 'sidebar' | 'under-window' | null }
  tabStyle: TabStyle
  surfaceStyle: SurfaceStyle
  radius: number
  radiusLg: number
  borderWidth: number
  blur: number
  font: string
  headingFont?: string
  light: ThemeTokens
  dark: ThemeTokens
}

const INTER = "'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
const SEGOE = "'Segoe UI Variable Text', 'Segoe UI', 'Inter Variable', system-ui, -apple-system, sans-serif"

const status = { danger: '#ef4444', success: '#22c55e', warning: '#f59e0b' }

export const THEMES: Record<ThemeId, ThemeDef> = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: { en: 'Quiet neutrals, floating content card. Arc/Linear vibes.', ru: 'Спокойные нейтральные тона и «парящая» карточка контента. В духе Arc и Linear.' },
    modes: 'both',
    material: { win: 'none', mac: null },
    tabStyle: 'pill',
    surfaceStyle: 'flat',
    radius: 8,
    radiusLg: 12,
    borderWidth: 1,
    blur: 0,
    font: INTER,
    light: {
      bg: '#eeeef1',
      surface: '#ffffff',
      surface2: '#e6e6ea',
      border: 'rgba(24,24,27,0.09)',
      text: '#18181b',
      text2: '#52525b',
      text3: '#a1a1aa',
      accent: '#6366f1',
      accentText: '#ffffff',
      tabActive: '#ffffff',
      tabActiveText: '#18181b',
      tabHover: 'rgba(24,24,27,0.05)',
      scrim: 'rgba(24,24,27,0.25)',
      shadow: '0 1px 2px rgba(0,0,0,0.05), 0 10px 30px rgba(0,0,0,0.10)',
      contentShadow: '0 0 0 1px rgba(24,24,27,0.07), 0 2px 10px rgba(0,0,0,0.05)',
      ...status,
    },
    dark: {
      bg: '#0e0e10',
      surface: '#18181b',
      surface2: '#232327',
      border: 'rgba(255,255,255,0.08)',
      text: '#f4f4f5',
      text2: '#a1a1aa',
      text3: '#5b5b63',
      accent: '#818cf8',
      accentText: '#0b0b12',
      tabActive: '#232327',
      tabActiveText: '#fafafa',
      tabHover: 'rgba(255,255,255,0.05)',
      scrim: 'rgba(0,0,0,0.5)',
      shadow: '0 10px 40px rgba(0,0,0,0.55)',
      contentShadow: '0 0 0 1px rgba(255,255,255,0.06)',
      ...status,
    },
  },

  mica: {
    id: 'mica',
    name: 'Mica',
    description: { en: 'Windows 11 Fluent with the real Mica window material.', ru: 'Windows 11 Fluent с настоящим материалом окна Mica.' },
    modes: 'both',
    material: { win: 'mica', mac: 'sidebar' },
    tabStyle: 'card',
    surfaceStyle: 'flat',
    radius: 6,
    radiusLg: 8,
    borderWidth: 1,
    blur: 0,
    font: SEGOE,
    light: {
      bg: '#f3f3f3',
      surface: 'rgba(255,255,255,0.78)',
      surface2: 'rgba(0,0,0,0.045)',
      border: 'rgba(0,0,0,0.075)',
      text: '#1b1b1b',
      text2: '#5d5d5d',
      text3: '#9a9a9a',
      accent: '#0067c0',
      accentText: '#ffffff',
      tabActive: 'rgba(255,255,255,0.9)',
      tabActiveText: '#1b1b1b',
      tabHover: 'rgba(0,0,0,0.04)',
      scrim: 'rgba(0,0,0,0.3)',
      shadow: '0 8px 16px rgba(0,0,0,0.14)',
      contentShadow: '0 0 0 1px rgba(0,0,0,0.06)',
      ...status,
    },
    dark: {
      bg: '#202020',
      surface: 'rgba(44,44,44,0.82)',
      surface2: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.08)',
      text: '#ffffff',
      text2: '#c5c5c5',
      text3: '#7a7a7a',
      accent: '#4cc2ff',
      accentText: '#00131f',
      tabActive: 'rgba(255,255,255,0.08)',
      tabActiveText: '#ffffff',
      tabHover: 'rgba(255,255,255,0.05)',
      scrim: 'rgba(0,0,0,0.5)',
      shadow: '0 8px 16px rgba(0,0,0,0.4)',
      contentShadow: '0 0 0 1px rgba(255,255,255,0.06)',
      ...status,
    },
  },

  material: {
    id: 'material',
    name: 'Material You',
    description: { en: 'Material 3 Expressive: tonal surfaces and big friendly shapes.', ru: 'Material 3 Expressive: тональные поверхности и крупные мягкие формы.' },
    modes: 'both',
    material: { win: 'none', mac: null },
    tabStyle: 'pill',
    surfaceStyle: 'flat',
    radius: 14,
    radiusLg: 28,
    borderWidth: 1,
    blur: 0,
    font: INTER,
    light: {
      bg: '#f7f2fa',
      surface: '#fef7ff',
      surface2: '#ece6f0',
      border: '#cac4d0',
      text: '#1d1b20',
      text2: '#49454f',
      text3: '#79747e',
      accent: '#6750a4',
      accentText: '#ffffff',
      tabActive: '#e8def8',
      tabActiveText: '#1d192b',
      tabHover: 'rgba(103,80,164,0.08)',
      scrim: 'rgba(29,27,32,0.32)',
      shadow: '0 2px 6px rgba(0,0,0,0.12), 0 8px 24px rgba(103,80,164,0.12)',
      contentShadow: '0 1px 3px rgba(0,0,0,0.08)',
      ...status,
    },
    dark: {
      bg: '#141218',
      surface: '#211f26',
      surface2: '#2b2930',
      border: '#49454f',
      text: '#e6e0e9',
      text2: '#cac4d0',
      text3: '#938f99',
      accent: '#d0bcff',
      accentText: '#381e72',
      tabActive: '#4a4458',
      tabActiveText: '#e8def8',
      tabHover: 'rgba(208,188,255,0.08)',
      scrim: 'rgba(0,0,0,0.5)',
      shadow: '0 8px 28px rgba(0,0,0,0.5)',
      contentShadow: '0 1px 3px rgba(0,0,0,0.4)',
      ...status,
    },
  },

  glass: {
    id: 'glass',
    name: 'Liquid Glass',
    description: { en: 'Translucent glass panels over a blurred desktop.', ru: 'Полупрозрачные стеклянные панели поверх размытого рабочего стола.' },
    modes: 'both',
    material: { win: 'acrylic', mac: 'under-window' },
    tabStyle: 'pill',
    surfaceStyle: 'glass',
    radius: 14,
    radiusLg: 22,
    borderWidth: 1,
    blur: 28,
    font: INTER,
    light: {
      bg: '#dfe7f3',
      bgImage:
        'radial-gradient(1200px 600px at 10% -10%, rgba(125,170,255,0.45), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(255,160,210,0.35), transparent 60%)',
      surface: 'rgba(255,255,255,0.55)',
      surface2: 'rgba(255,255,255,0.32)',
      border: 'rgba(255,255,255,0.65)',
      text: '#0b1220',
      text2: '#3b4556',
      text3: '#7d8799',
      accent: '#0a84ff',
      accentText: '#ffffff',
      tabActive: 'rgba(255,255,255,0.78)',
      tabActiveText: '#0b1220',
      tabHover: 'rgba(255,255,255,0.38)',
      scrim: 'rgba(20,30,50,0.18)',
      shadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 12px 40px rgba(30,50,90,0.18)',
      contentShadow: '0 0 0 1px rgba(255,255,255,0.6), 0 12px 40px rgba(30,50,90,0.16)',
      ...status,
    },
    dark: {
      bg: '#0b0f17',
      bgImage:
        'radial-gradient(1200px 600px at 0% -20%, rgba(60,110,255,0.35), transparent 60%), radial-gradient(900px 500px at 110% 0%, rgba(200,80,255,0.25), transparent 60%)',
      surface: 'rgba(28,32,44,0.52)',
      surface2: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.12)',
      text: '#f2f5fa',
      text2: '#aab3c5',
      text3: '#667085',
      accent: '#0a84ff',
      accentText: '#ffffff',
      tabActive: 'rgba(255,255,255,0.12)',
      tabActiveText: '#ffffff',
      tabHover: 'rgba(255,255,255,0.06)',
      scrim: 'rgba(0,0,0,0.35)',
      shadow: '0 1px 0 rgba(255,255,255,0.1) inset, 0 16px 48px rgba(0,0,0,0.5)',
      contentShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 16px 48px rgba(0,0,0,0.45)',
      ...status,
    },
  },

  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: { en: 'Soft northern-lights gradient behind frosted panels.', ru: 'Мягкий градиент северного сияния за матовыми панелями.' },
    modes: 'both',
    material: { win: 'none', mac: null },
    tabStyle: 'pill',
    surfaceStyle: 'glass',
    radius: 12,
    radiusLg: 18,
    borderWidth: 1,
    blur: 20,
    font: INTER,
    light: {
      bg: '#f3f1ff',
      bgImage:
        'radial-gradient(800px 420px at 0% 0%, rgba(167,139,250,0.55), transparent 65%), radial-gradient(700px 420px at 100% 0%, rgba(45,212,191,0.45), transparent 65%), radial-gradient(900px 500px at 50% 120%, rgba(244,114,182,0.35), transparent 65%)',
      surface: 'rgba(255,255,255,0.62)',
      surface2: 'rgba(255,255,255,0.4)',
      border: 'rgba(255,255,255,0.7)',
      text: '#1e1b3a',
      text2: '#4c4870',
      text3: '#8e89b3',
      accent: '#8b5cf6',
      accentText: '#ffffff',
      tabActive: 'rgba(255,255,255,0.82)',
      tabActiveText: '#1e1b3a',
      tabHover: 'rgba(255,255,255,0.45)',
      scrim: 'rgba(30,27,58,0.22)',
      shadow: '0 12px 40px rgba(76,29,149,0.18)',
      contentShadow: '0 0 0 1px rgba(255,255,255,0.7), 0 12px 40px rgba(76,29,149,0.15)',
      ...status,
    },
    dark: {
      bg: '#080818',
      bgImage:
        'radial-gradient(800px 420px at 0% 0%, rgba(124,58,237,0.45), transparent 65%), radial-gradient(700px 420px at 100% 0%, rgba(13,148,136,0.4), transparent 65%), radial-gradient(900px 500px at 50% 120%, rgba(219,39,119,0.28), transparent 65%)',
      surface: 'rgba(20,18,44,0.55)',
      surface2: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.1)',
      text: '#ede9fe',
      text2: '#b4acd8',
      text3: '#6b6590',
      accent: '#c4b5fd',
      accentText: '#1e1147',
      tabActive: 'rgba(255,255,255,0.12)',
      tabActiveText: '#ffffff',
      tabHover: 'rgba(255,255,255,0.06)',
      scrim: 'rgba(0,0,0,0.4)',
      shadow: '0 16px 48px rgba(0,0,0,0.55)',
      contentShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 16px 48px rgba(0,0,0,0.5)',
      ...status,
    },
  },

  nord: {
    id: 'nord',
    name: 'Nord',
    description: { en: 'Arctic, north-bluish calm palette.', ru: 'Арктическая, спокойная северо-голубая палитра.' },
    modes: 'both',
    material: { win: 'none', mac: null },
    tabStyle: 'underline',
    surfaceStyle: 'flat',
    radius: 6,
    radiusLg: 10,
    borderWidth: 1,
    blur: 0,
    font: INTER,
    light: {
      bg: '#e5e9f0',
      surface: '#eceff4',
      surface2: '#d8dee9',
      border: '#cdd3de',
      text: '#2e3440',
      text2: '#4c566a',
      text3: '#8691a6',
      accent: '#5e81ac',
      accentText: '#eceff4',
      tabActive: '#eceff4',
      tabActiveText: '#2e3440',
      tabHover: 'rgba(46,52,64,0.06)',
      scrim: 'rgba(46,52,64,0.3)',
      shadow: '0 10px 30px rgba(46,52,64,0.15)',
      contentShadow: '0 0 0 1px #cdd3de',
      danger: '#bf616a',
      success: '#a3be8c',
      warning: '#d08770',
    },
    dark: {
      bg: '#242933',
      surface: '#2e3440',
      surface2: '#3b4252',
      border: '#434c5e',
      text: '#eceff4',
      text2: '#d8dee9',
      text3: '#7b88a1',
      accent: '#88c0d0',
      accentText: '#2e3440',
      tabActive: '#3b4252',
      tabActiveText: '#eceff4',
      tabHover: 'rgba(236,239,244,0.05)',
      scrim: 'rgba(0,0,0,0.45)',
      shadow: '0 10px 30px rgba(0,0,0,0.4)',
      contentShadow: '0 0 0 1px #3b4252',
      danger: '#bf616a',
      success: '#a3be8c',
      warning: '#ebcb8b',
    },
  },

  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin',
    description: { en: 'Soothing pastels: Latte by day, Mocha by night.', ru: 'Успокаивающая пастель: Latte днём, Mocha ночью.' },
    modes: 'both',
    material: { win: 'none', mac: null },
    tabStyle: 'pill',
    surfaceStyle: 'flat',
    radius: 10,
    radiusLg: 16,
    borderWidth: 1,
    blur: 0,
    font: INTER,
    light: {
      bg: '#dce0e8',
      surface: '#eff1f5',
      surface2: '#e6e9ef',
      border: '#ccd0da',
      text: '#4c4f69',
      text2: '#6c6f85',
      text3: '#9ca0b0',
      accent: '#8839ef',
      accentText: '#eff1f5',
      tabActive: '#eff1f5',
      tabActiveText: '#4c4f69',
      tabHover: 'rgba(76,79,105,0.06)',
      scrim: 'rgba(76,79,105,0.3)',
      shadow: '0 10px 30px rgba(76,79,105,0.18)',
      contentShadow: '0 0 0 1px #ccd0da',
      danger: '#d20f39',
      success: '#40a02b',
      warning: '#df8e1d',
    },
    dark: {
      bg: '#11111b',
      surface: '#1e1e2e',
      surface2: '#313244',
      border: '#45475a',
      text: '#cdd6f4',
      text2: '#a6adc8',
      text3: '#6c7086',
      accent: '#cba6f7',
      accentText: '#11111b',
      tabActive: '#313244',
      tabActiveText: '#cdd6f4',
      tabHover: 'rgba(205,214,244,0.05)',
      scrim: 'rgba(0,0,0,0.5)',
      shadow: '0 10px 30px rgba(0,0,0,0.5)',
      contentShadow: '0 0 0 1px #313244',
      danger: '#f38ba8',
      success: '#a6e3a1',
      warning: '#f9e2af',
    },
  },

  amoled: {
    id: 'amoled',
    name: 'AMOLED',
    description: { en: 'True black. Easy on OLED screens and batteries.', ru: 'Настоящий чёрный. Бережёт OLED-экраны и батарею.' },
    modes: 'dark',
    material: { win: 'none', mac: null },
    tabStyle: 'underline',
    surfaceStyle: 'flat',
    radius: 6,
    radiusLg: 10,
    borderWidth: 1,
    blur: 0,
    font: INTER,
    light: {} as ThemeTokens, // filled below: dark-only theme
    dark: {
      bg: '#000000',
      surface: '#0a0a0a',
      surface2: '#161616',
      border: '#1f1f1f',
      text: '#f5f5f5',
      text2: '#a3a3a3',
      text3: '#525252',
      accent: '#22d3ee',
      accentText: '#001316',
      tabActive: '#111111',
      tabActiveText: '#ffffff',
      tabHover: 'rgba(255,255,255,0.05)',
      scrim: 'rgba(0,0,0,0.7)',
      shadow: '0 0 0 1px #1f1f1f, 0 20px 50px rgba(0,0,0,0.9)',
      contentShadow: '0 0 0 1px #1a1a1a',
      ...status,
    },
  },

  brutal: {
    id: 'brutal',
    name: 'Neo-Brutal',
    description: { en: 'Thick outlines, hard shadows, loud colour.', ru: 'Толстые обводки, жёсткие тени и громкие цвета.' },
    modes: 'both',
    material: { win: 'none', mac: null },
    tabStyle: 'brutal',
    surfaceStyle: 'brutal',
    radius: 6,
    radiusLg: 10,
    borderWidth: 2,
    blur: 0,
    font: INTER,
    light: {
      bg: '#fff4d6',
      surface: '#ffffff',
      surface2: '#ffe999',
      border: '#111111',
      text: '#111111',
      text2: '#2b2b2b',
      text3: '#6b6b6b',
      accent: '#ff5c8a',
      accentText: '#111111',
      tabActive: '#ffd23f',
      tabActiveText: '#111111',
      tabHover: '#fff0b3',
      scrim: 'rgba(17,17,17,0.35)',
      shadow: '4px 4px 0 #111111',
      contentShadow: '4px 4px 0 #111111, 0 0 0 2px #111111',
      danger: '#ff3b3b',
      success: '#00c26e',
      warning: '#ff9f1c',
    },
    dark: {
      bg: '#141414',
      surface: '#1f1f1f',
      surface2: '#2b2b2b',
      border: '#f5f5f5',
      text: '#fafafa',
      text2: '#e5e5e5',
      text3: '#a3a3a3',
      accent: '#ffd23f',
      accentText: '#111111',
      tabActive: '#ff5c8a',
      tabActiveText: '#111111',
      tabHover: '#2b2b2b',
      scrim: 'rgba(0,0,0,0.55)',
      shadow: '4px 4px 0 #f5f5f5',
      contentShadow: '4px 4px 0 #ffd23f, 0 0 0 2px #f5f5f5',
      danger: '#ff5c5c',
      success: '#3ddc97',
      warning: '#ffb347',
    },
  },

  paper: {
    id: 'paper',
    name: 'Paper',
    description: { en: 'Warm sepia and serif headings, like a good notebook.', ru: 'Тёплая сепия и заголовки с засечками, как в хорошем блокноте.' },
    modes: 'both',
    material: { win: 'none', mac: null },
    tabStyle: 'card',
    surfaceStyle: 'flat',
    radius: 6,
    radiusLg: 10,
    borderWidth: 1,
    blur: 0,
    font: INTER,
    headingFont: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
    light: {
      bg: '#ece3cf',
      surface: '#f8f2e6',
      surface2: '#e6dcc6',
      border: '#d6c8ab',
      text: '#3b3226',
      text2: '#6b5d4a',
      text3: '#a09078',
      accent: '#b0582d',
      accentText: '#fff8ee',
      tabActive: '#f8f2e6',
      tabActiveText: '#3b3226',
      tabHover: 'rgba(59,50,38,0.06)',
      scrim: 'rgba(59,50,38,0.3)',
      shadow: '0 10px 30px rgba(59,50,38,0.18)',
      contentShadow: '0 0 0 1px #d6c8ab, 0 2px 10px rgba(59,50,38,0.08)',
      danger: '#b3261e',
      success: '#4d7c0f',
      warning: '#b45309',
    },
    dark: {
      bg: '#1b1814',
      surface: '#26221c',
      surface2: '#312c24',
      border: '#433b30',
      text: '#e8dcc6',
      text2: '#b8a98f',
      text3: '#7d705c',
      accent: '#e08a5a',
      accentText: '#1f1b16',
      tabActive: '#312c24',
      tabActiveText: '#f3e9d6',
      tabHover: 'rgba(232,220,198,0.05)',
      scrim: 'rgba(0,0,0,0.5)',
      shadow: '0 10px 30px rgba(0,0,0,0.5)',
      contentShadow: '0 0 0 1px #433b30',
      danger: '#f87171',
      success: '#a3e635',
      warning: '#fbbf24',
    },
  },
}

THEMES.amoled.light = THEMES.amoled.dark

/** Picks the palette for a colour mode, honouring dark-only themes. */
export function themeTokens(id: ThemeId, dark: boolean): ThemeTokens {
  const t = THEMES[id] ?? THEMES.minimal
  return dark || t.modes === 'dark' ? t.dark : t.light
}

export function isEffectivelyDark(id: ThemeId, dark: boolean): boolean {
  return dark || (THEMES[id] ?? THEMES.minimal).modes === 'dark'
}

/** Solid colour for places that cannot be translucent (window background, caption buttons). */
export function solidColor(color: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback
}

/** Parses #rrggbb into [r,g,b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG relative luminance, used to pick readable text on a custom accent colour. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#111111' : '#ffffff'
}
