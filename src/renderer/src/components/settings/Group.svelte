<script lang="ts">
  // Bordered card grouping a handful of related rows, with a divider between each one.
  import type { Snippet } from 'svelte'

  let { heading, children }: { heading?: string; children: Snippet } = $props()
</script>

<section class="group">
  {#if heading}<h3 class="heading muted">{heading}</h3>{/if}
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .heading {
    font-size: 12px;
    font-weight: 650;
    margin: 0 2px;
  }
  .body {
    display: flex;
    flex-direction: column;
    border: var(--border-w) solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .body > :global(* + *) {
    border-top: var(--border-w) solid var(--border);
  }
</style>
