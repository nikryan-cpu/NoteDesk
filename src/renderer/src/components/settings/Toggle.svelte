<script lang="ts">
  // Accessible on/off switch used throughout Settings rows.
  let {
    checked,
    disabled = false,
    label,
    onchange,
  }: { checked: boolean; disabled?: boolean; label?: string; onchange: (v: boolean) => void } = $props()
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  class="toggle"
  class:on={checked}
  {disabled}
  onclick={() => onchange(!checked)}
>
  <span class="thumb"></span>
</button>

<style>
  .toggle {
    position: relative;
    width: 36px;
    height: 21px;
    border-radius: 999px;
    background: var(--surface-2);
    border: var(--border-w) solid var(--border);
    flex: none;
    transition:
      background var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .toggle.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .toggle:disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  .thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    transition: transform var(--dur) var(--ease);
  }
  .toggle.on .thumb {
    transform: translateX(15px);
  }
</style>
