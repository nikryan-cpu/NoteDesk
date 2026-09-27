<script lang="ts">
  // Renders one answer's Markdown, intercepts link clicks (sent to the OS browser instead of
  // navigating this window) and wires up the copy button each code block got in markdown.ts.
  import { renderMarkdown } from './markdown'
  import { nd, t } from './state.svelte'

  let { markdown, streaming = false }: { markdown: string; streaming?: boolean } = $props()

  let container: HTMLDivElement | undefined = $state()
  const html = $derived(renderMarkdown(markdown, t('ask.copy')))

  function onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    const link = target.closest('a')
    if (link && container?.contains(link)) {
      e.preventDefault()
      const href = link.getAttribute('href') ?? ''
      if (/^(https?:|mailto:)/i.test(href)) void nd.invoke('app:openExternal', href)
      return
    }
    const btn = target.closest('.copy-code-btn') as HTMLButtonElement | null
    if (btn && container?.contains(btn)) {
      const idx = btn.getAttribute('data-copy-target')
      const code = container?.querySelector(`pre[data-copy-source="${idx}"] code`)
      const text = code?.textContent ?? ''
      void navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent
        btn.textContent = t('ask.copied')
        btn.classList.add('copied')
        setTimeout(() => {
          btn.textContent = original
          btn.classList.remove('copied')
        }, 1200)
      })
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="markdown-body" class:streaming bind:this={container} onclick={onClick}>
  {@html html}
</div>

<style>
  .markdown-body {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text);
    word-break: break-word;
  }
  .markdown-body :global(p) {
    margin: 0 0 10px;
  }
  .markdown-body :global(p:last-child) {
    margin-bottom: 0;
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3),
  .markdown-body :global(h4),
  .markdown-body :global(h5),
  .markdown-body :global(h6) {
    font-family: var(--font-heading);
    margin: 16px 0 8px;
    line-height: 1.3;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .markdown-body :global(h1:first-child),
  .markdown-body :global(h2:first-child),
  .markdown-body :global(h3:first-child) {
    margin-top: 0;
  }
  .markdown-body :global(h1) {
    font-size: 1.35em;
  }
  .markdown-body :global(h2) {
    font-size: 1.2em;
  }
  .markdown-body :global(h3) {
    font-size: 1.08em;
  }
  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    margin: 0 0 10px;
    padding-left: 1.4em;
  }
  .markdown-body :global(li) {
    margin: 3px 0;
  }
  .markdown-body :global(li > p) {
    margin: 0;
  }
  .markdown-body :global(a) {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .markdown-body :global(strong) {
    font-weight: 700;
  }
  .markdown-body :global(blockquote) {
    margin: 0 0 10px;
    padding: 1px 12px;
    border-left: 3px solid var(--border);
    color: var(--text-2);
  }
  .markdown-body :global(blockquote > *:last-child) {
    margin-bottom: 0;
  }
  .markdown-body :global(hr) {
    border: none;
    border-top: var(--border-w) solid var(--border);
    margin: 14px 0;
  }
  .markdown-body :global(img) {
    max-width: 100%;
    border-radius: var(--radius);
    display: block;
    margin: 6px 0;
  }
  .markdown-body :global(code) {
    font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
    font-size: 0.9em;
    background: var(--surface-2);
    padding: 1px 5px;
    border-radius: 4px;
  }
  .markdown-body :global(pre) {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
    background: transparent;
  }
  .markdown-body :global(pre code) {
    background: none;
    padding: 0;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .markdown-body :global(.code-block) {
    margin: 8px 0 12px;
    border-radius: var(--radius);
    border: var(--border-w) solid var(--border);
    background: var(--surface-2);
    overflow: hidden;
  }
  .markdown-body :global(.code-block-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 10px;
    font-size: 11px;
    color: var(--text-3);
    border-bottom: var(--border-w) solid var(--border);
  }
  .markdown-body :global(.code-lang) {
    text-transform: lowercase;
  }
  .markdown-body :global(.copy-code-btn) {
    color: var(--text-2);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 5px;
    cursor: pointer;
    transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .markdown-body :global(.copy-code-btn:hover) {
    background: var(--tab-hover);
    color: var(--text);
  }
  .markdown-body :global(.copy-code-btn.copied) {
    color: var(--success);
  }
  .markdown-body :global(table) {
    border-collapse: collapse;
    margin: 8px 0 12px;
    font-size: 13px;
    display: block;
    overflow-x: auto;
  }
  .markdown-body :global(th),
  .markdown-body :global(td) {
    border: var(--border-w) solid var(--border);
    padding: 5px 9px;
    text-align: left;
  }
  .markdown-body :global(th) {
    background: var(--surface-2);
    font-weight: 650;
  }

  .markdown-body.streaming > :global(*:last-child)::after {
    content: '';
    display: inline-block;
    width: 2px;
    height: 1em;
    margin-left: 1px;
    vertical-align: -0.15em;
    background: var(--accent);
    animation: nd-ask-caret 1s steps(1) infinite;
  }
  @keyframes nd-ask-caret {
    0%,
    49% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }
</style>
