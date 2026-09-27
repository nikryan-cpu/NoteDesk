<script lang="ts">
  import { onMount } from 'svelte'
  import Plus from '@lucide/svelte/icons/plus'
  import Save from '@lucide/svelte/icons/save'
  import SquarePen from '@lucide/svelte/icons/square-pen'
  import Trash from '@lucide/svelte/icons/trash'
  import type { PromptSnippet } from '@shared/ipc'
  import Group from './Group.svelte'
  import { nd } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  let prompts = $state<PromptSnippet[]>([])
  let editingId = $state<string | null>(null)
  let draftTitle = $state('')
  let draftText = $state('')

  onMount(() => {
    void nd.invoke('prompts:list').then((list) => (prompts = list))
  })

  function startNew() {
    editingId = ''
    draftTitle = ''
    draftText = ''
  }

  function startEdit(p: PromptSnippet) {
    editingId = p.id
    draftTitle = p.title
    draftText = p.text
  }

  function cancelEdit() {
    editingId = null
  }

  async function save() {
    if (editingId === null) return
    prompts = await nd.invoke('prompts:save', { id: editingId, title: draftTitle.trim(), text: draftText })
    editingId = null
  }

  async function remove(id: string) {
    prompts = await nd.invoke('prompts:delete', id)
    if (editingId === id) editingId = null
  }

  function firstLine(text: string): string {
    return text.split('\n')[0]?.slice(0, 140) ?? ''
  }
</script>

{#snippet editor(existing: PromptSnippet | null)}
  <div class="editor">
    <input class="input" placeholder={t('prompts.titleField')} bind:value={draftTitle} maxlength="120" />
    <textarea class="input" rows="4" placeholder={t('prompts.textField')} bind:value={draftText}></textarea>
    <div class="editor-actions">
      <button type="button" class="btn primary" disabled={!draftText.trim()} onclick={save}>
        <Save size={14} />
        {t('common.save')}
      </button>
      <button type="button" class="btn ghost" onclick={cancelEdit}>{t('common.cancel')}</button>
      {#if existing}
        <button type="button" class="btn danger" onclick={() => remove(existing.id)}>
          <Trash size={14} />
          {t('common.delete')}
        </button>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet view(p: PromptSnippet)}
  <div class="row">
    <div class="text">
      <span class="title">{p.title}</span>
      <span class="preview faint">{firstLine(p.text)}</span>
    </div>
    <button type="button" class="icon-btn" title={t('common.edit')} onclick={() => startEdit(p)}>
      <SquarePen size={15} />
    </button>
  </div>
{/snippet}

<p class="hint muted">{t('prompts.hint')}</p>

{#if prompts.length === 0 && editingId !== ''}
  <p class="faint">{t('prompts.empty')}</p>
{:else}
  <Group>
    {#if editingId === ''}
      {@render editor(null)}
    {/if}
    {#each prompts as p (p.id)}
      {#if editingId === p.id}
        {@render editor(p)}
      {:else}
        {@render view(p)}
      {/if}
    {/each}
  </Group>
{/if}

<button type="button" class="btn" disabled={editingId !== null} onclick={startNew}>
  <Plus size={15} />
  {t('prompts.add')}
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .text .title {
    font-weight: 550;
  }
  .text .preview {
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
  }
  .editor-actions {
    display: flex;
    gap: 8px;
  }
</style>
