<script lang="ts" generics="T extends string">
  // Small segmented radio group (e.g. system/light/dark, compact/comfortable).
  let {
    options,
    value,
    onchange,
    disabled = false,
  }: {
    options: readonly { value: T; label: string }[]
    value: T
    onchange: (v: T) => void
    disabled?: boolean
  } = $props()
</script>

<div class="segmented" role="radiogroup" class:disabled>
  {#each options as opt (opt.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === opt.value}
      class="seg"
      class:active={value === opt.value}
      {disabled}
      onclick={() => onchange(opt.value)}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    padding: 2px;
    border-radius: var(--radius);
    background: var(--surface-2);
    border: var(--border-w) solid transparent;
    gap: 2px;
  }
  .segmented.disabled {
    opacity: 0.5;
  }
  .seg {
    height: 26px;
    padding: 0 12px;
    border-radius: calc(var(--radius) - 2px);
    color: var(--text-2);
    font-weight: 550;
    white-space: nowrap;
    transition:
      background var(--dur) var(--ease),
      color var(--dur) var(--ease),
      box-shadow var(--dur) var(--ease);
  }
  .seg:hover:not(:disabled):not(.active) {
    color: var(--text);
  }
  .seg.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
  :global([data-surface='brutal']) .seg.active {
    box-shadow: none;
    border: var(--border-w) solid var(--border);
  }
  :global([data-density='compact']) .seg {
    height: 24px;
    padding: 0 10px;
  }
</style>
