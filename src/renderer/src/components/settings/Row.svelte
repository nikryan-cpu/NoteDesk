<script lang="ts">
  // One labelled settings row: label + optional hint on the left, control on the right.
  // Meant to live inside a <Group>, which draws the dividers between rows.
  import type { Snippet } from 'svelte'

  let { label, hint, children }: { label: string; hint?: string; children: Snippet } = $props()
</script>

<div class="row">
  <div class="text">
    <span class="label">{label}</span>
    {#if hint}<span class="hint faint">{hint}</span>{/if}
  </div>
  <div class="control">
    {@render children()}
  </div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 14px;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .label {
    font-weight: 550;
  }
  .hint {
    font-size: 11.5px;
    line-height: 1.4;
  }
  .control {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  :global([data-density='compact']) .row {
    padding: 8px 14px;
  }
</style>
