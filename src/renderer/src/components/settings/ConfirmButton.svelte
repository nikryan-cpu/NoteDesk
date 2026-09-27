<script lang="ts">
  // Destructive action button that arms into an inline "are you sure" strip instead of a
  // native confirm() dialog, matching the rest of the shell's chrome.
  import type { Snippet } from 'svelte'
  import { t } from '../../lib/i18n'

  let {
    label,
    confirmText,
    onconfirm,
    disabled = false,
    disabledTitle,
    icon,
  }: {
    label: string
    confirmText: string
    onconfirm: () => void
    disabled?: boolean
    disabledTitle?: string
    icon?: Snippet
  } = $props()

  let armed = $state(false)
</script>

{#if armed}
  <span class="confirm">
    <span class="confirm-text">{confirmText}</span>
    <button
      type="button"
      class="btn danger"
      onclick={() => {
        armed = false
        onconfirm()
      }}
    >
      {t('common.ok')}
    </button>
    <button type="button" class="btn ghost" onclick={() => (armed = false)}>{t('common.cancel')}</button>
  </span>
{:else}
  <button type="button" class="btn danger" {disabled} title={disabled ? disabledTitle : undefined} onclick={() => (armed = true)}>
    {#if icon}{@render icon()}{/if}
    {label}
  </button>
{/if}

<style>
  .confirm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .confirm-text {
    font-size: 12px;
    color: var(--danger);
    max-width: 280px;
  }
</style>
