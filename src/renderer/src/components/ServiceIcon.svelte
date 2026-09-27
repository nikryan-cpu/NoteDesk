<script lang="ts" module>
  import type { ServiceId } from '@shared/services'

  /** Tint and letter for services drawn as a monogram (no third-party logos). */
  export const MONOGRAMS: Partial<Record<ServiceId, { letter: string; color: string }>> = {
    claude: { letter: 'C', color: '#c8734f' },
    chatgpt: { letter: 'G', color: '#1f9d7a' },
    deepseek: { letter: 'D', color: '#4d6bfe' },
    qwen: { letter: 'Q', color: '#7162e8' },
  }
</script>

<script lang="ts">
  import BookOpen from '@lucide/svelte/icons/book-open'
  import Sparkles from '@lucide/svelte/icons/sparkles'
  import Globe from '@lucide/svelte/icons/globe'

  let { service, size = 16 }: { service: ServiceId | null; size?: number } = $props()
  const mono = $derived(service ? MONOGRAMS[service] : undefined)
</script>

{#if service === 'notebook'}
  <BookOpen size={size - 2} strokeWidth={2} />
{:else if service === 'gemini'}
  <Sparkles size={size - 2} strokeWidth={2} />
{:else if mono}
  <span
    class="mono"
    style:width="{size}px"
    style:height="{size}px"
    style:font-size="{Math.round(size * 0.62)}px"
    style:background={mono.color}
    aria-hidden="true">{mono.letter}</span
  >
{:else}
  <Globe size={size - 2} strokeWidth={2} />
{/if}

<style>
  .mono {
    display: inline-grid;
    place-items: center;
    flex: none;
    border-radius: 28%;
    color: #fff;
    font-weight: 750;
    line-height: 1;
    letter-spacing: -0.02em;
  }
</style>
