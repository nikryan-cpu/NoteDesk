<script lang="ts" generics="T extends string | number">
  // Thin wrapper around a native <select>, matching values back to their original (typed) option.
  let {
    value,
    options,
    onchange,
    disabled = false,
  }: {
    value: T
    options: readonly { value: T; label: string }[]
    onchange: (v: T) => void
    disabled?: boolean
  } = $props()

  function onSelect(e: Event & { currentTarget: HTMLSelectElement }) {
    const raw = e.currentTarget.value
    const match = options.find((o) => String(o.value) === raw)
    if (match) onchange(match.value)
  }
</script>

<select class="input" {disabled} value={String(value)} onchange={onSelect}>
  {#each options as opt (String(opt.value))}
    <option value={String(opt.value)}>{opt.label}</option>
  {/each}
</select>
