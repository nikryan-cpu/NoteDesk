<script lang="ts">
  // Row of round colour presets (accent colour, profile colour).
  let {
    colors,
    value,
    onchange,
    size = 22,
  }: { colors: readonly string[]; value: string; onchange: (hex: string) => void; size?: number } = $props()
</script>

<div class="swatches">
  {#each colors as c (c)}
    <button
      type="button"
      class="swatch"
      class:selected={value.toLowerCase() === c.toLowerCase()}
      style:background={c}
      style:width="{size}px"
      style:height="{size}px"
      aria-label={c}
      aria-pressed={value.toLowerCase() === c.toLowerCase()}
      onclick={() => onchange(c)}
    ></button>
  {/each}
</div>

<style>
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    border-radius: 999px;
    border: var(--border-w) solid var(--border);
    flex: none;
    transition:
      transform var(--dur) var(--ease),
      box-shadow var(--dur) var(--ease);
  }
  .swatch:hover {
    transform: scale(1.08);
  }
  .swatch.selected {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--accent);
  }
</style>
