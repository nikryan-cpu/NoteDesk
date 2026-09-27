<script lang="ts">
  // Miniature NoteDesk window painted from a theme's tokens, so the gallery shows the real
  // palette, tab style and corner radii instead of a static screenshot.
  import { THEMES, readableOn, themeTokens, type ThemeId } from '@shared/themes'

  let { id, dark, accent = '' }: { id: ThemeId; dark: boolean; accent?: string } = $props()

  const def = $derived(THEMES[id])
  const tk = $derived(themeTokens(id, dark))
  const acc = $derived(accent || tk.accent)
  const accText = $derived(accent ? readableOn(accent) : tk.accentText)
  const r = $derived(Math.max(2, Math.round(def.radius / 2.5)))
  const rLg = $derived(Math.max(3, Math.round(def.radiusLg / 2.5)))
  const bw = $derived(def.borderWidth > 1 ? 1.5 : 1)
</script>

<div
  class="mini"
  data-tab={def.tabStyle}
  style:background-color={tk.bg}
  style:background-image={tk.bgImage ?? 'none'}
  style:--r="{r}px"
  style:--r-lg="{rLg}px"
  style:--bw="{bw}px"
  style:--surface={tk.surface}
  style:--border={tk.border}
  style:--text={tk.text}
  style:--text-2={tk.text2}
  style:--text-3={tk.text3}
  style:--accent={acc}
  style:--accent-text={accText}
  style:--tab-active={tk.tabActive}
  style:--tab-hover={tk.tabHover}
  style:--content-shadow={tk.contentShadow}
  style:font-family={def.headingFont ?? def.font}
  aria-hidden="true"
>
  <div class="bar">
    <span class="tab active"><i class="fav"></i><i class="label"></i></span>
    <span class="tab"><i class="fav"></i><i class="label short"></i></span>
    <span class="dots"><i></i><i></i></span>
  </div>
  <div class="card" class:glass={def.surfaceStyle === 'glass'}>
    <div class="heading">Aa</div>
    <i class="line" style:width="78%"></i>
    <i class="line faint" style:width="92%"></i>
    <i class="line faint" style:width="64%"></i>
    <div class="row">
      <span class="chip"></span>
      <span class="btn">↵</span>
    </div>
  </div>
</div>

<style>
  .mini {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    aspect-ratio: 16 / 10;
    padding: 0 6px 6px;
    border-radius: 8px;
    overflow: hidden;
    background-size: cover;
    isolation: isolate;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 22%;
    min-height: 16px;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 62%;
    width: 30%;
    padding: 0 4px;
    border-radius: var(--r);
  }
  .tab .fav {
    width: 5px;
    height: 5px;
    border-radius: 2px;
    background: var(--text-3);
    flex: none;
  }
  .tab .label {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--text-3);
  }
  .tab .label.short {
    flex: 0 1 55%;
  }
  .tab.active {
    background: var(--tab-active);
  }
  .tab.active .fav {
    background: var(--accent);
  }
  .tab.active .label {
    background: var(--text-2);
  }
  .dots {
    margin-left: auto;
    display: flex;
    gap: 3px;
  }
  .dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--text-3);
    opacity: 0.6;
  }

  [data-tab='underline'] .tab.active {
    background: transparent;
    border-radius: 0;
    box-shadow: inset 0 -1.5px 0 var(--accent);
  }
  [data-tab='card'] .tab {
    align-self: flex-end;
    height: 70%;
    border-radius: var(--r-lg) var(--r-lg) 0 0;
  }
  [data-tab='card'] .tab.active {
    background: var(--surface);
  }
  [data-tab='card'] .card {
    border-top-left-radius: 0;
  }
  [data-tab='brutal'] .tab.active {
    border: var(--bw) solid var(--border);
    box-shadow: 1.5px 1.5px 0 var(--border);
  }

  .card {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px 8px;
    border-radius: var(--r-lg);
    background: var(--surface);
    box-shadow: var(--content-shadow);
    min-height: 0;
  }
  .card.glass {
    backdrop-filter: blur(6px);
  }
  [data-tab='brutal'] .card {
    border: var(--bw) solid var(--border);
    box-shadow: 2px 2px 0 var(--border);
  }
  .heading {
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    color: var(--text);
    margin-bottom: 1px;
  }
  .line {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: var(--text-2);
    opacity: 0.8;
  }
  .line.faint {
    background: var(--text-3);
    opacity: 0.7;
  }
  .row {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .chip {
    width: 34%;
    height: 8px;
    border-radius: 999px;
    background: var(--tab-hover);
    border: 1px solid var(--border);
  }
  .btn {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: var(--r);
    background: var(--accent);
    color: var(--accent-text);
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
  }
</style>
