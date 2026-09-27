<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy'
  import RotateCw from '@lucide/svelte/icons/rotate-cw'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import LogIn from '@lucide/svelte/icons/log-in'
  import type { AskAnswer } from '@shared/ask'
  import { SERVICES } from '@shared/services'
  import ServiceIcon from '../components/ServiceIcon.svelte'
  import MarkdownView from './MarkdownView.svelte'
  import { t, retryAnswer, openThread, loginModel, showPageModel } from './state.svelte'

  let { answer, turnId }: { answer: AskAnswer; turnId: string } = $props()

  const def = $derived(SERVICES[answer.model])
  const waiting = $derived(answer.status === 'queued' || answer.status === 'sending')
  const streaming = $derived(answer.status === 'streaming')
  const finished = $derived(answer.status === 'done' || answer.status === 'stopped')

  let copied = $state(false)
  function copyAnswer(): void {
    void navigator.clipboard.writeText(answer.markdown).then(() => {
      copied = true
      setTimeout(() => (copied = false), 1200)
    })
  }
</script>

<div class="answer-card panel">
  <div class="answer-header">
    <ServiceIcon service={answer.model} size={16} />
    <span class="model-name">{def.name}</span>
    <span class="status-chip" data-status={answer.status}>{t(`ask.status.${answer.status}`)}</span>
  </div>

  <div class="answer-body">
    {#if waiting}
      <div class="skeleton">
        <div class="sk-line" style:width="88%"></div>
        <div class="sk-line" style:width="62%"></div>
        <div class="sk-line" style:width="72%"></div>
      </div>
    {:else if answer.status === 'signed-out'}
      <p class="hint muted">{t('ask.signedOutBody', { name: def.name })}</p>
      <button type="button" class="btn" onclick={() => loginModel(answer.model)}>
        <LogIn size={14} />
        <span>{t('ask.signIn', { name: def.name })}</span>
      </button>
    {:else if answer.status === 'needs-action'}
      <p class="hint muted">{t('ask.needsActionBody', { name: def.name })}</p>
      <button type="button" class="btn" onclick={() => showPageModel(answer.model)}>
        <ExternalLink size={14} />
        <span>{t('ask.openPage')}</span>
      </button>
    {:else if answer.status === 'error'}
      <p class="hint error-text">{answer.error || t('ask.status.error')}</p>
      <button type="button" class="btn" onclick={() => retryAnswer(turnId, answer.model)}>
        <RotateCw size={14} />
        <span>{t('ask.retry')}</span>
      </button>
    {:else}
      <MarkdownView markdown={answer.markdown} {streaming} />
    {/if}
  </div>

  {#if finished}
    <div class="answer-footer">
      <button type="button" class="btn ghost sm" onclick={copyAnswer}>
        <Copy size={13} />
        <span>{copied ? t('ask.copied') : t('ask.copy')}</span>
      </button>
      <button type="button" class="btn ghost sm" onclick={() => retryAnswer(turnId, answer.model)}>
        <RotateCw size={13} />
        <span>{t('ask.retry')}</span>
      </button>
      <button type="button" class="btn ghost sm" onclick={() => openThread(answer.model)}>
        <ExternalLink size={13} />
        <span>{t('ask.openInTab')}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .answer-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
  .answer-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-bottom: var(--border-w) solid var(--border);
    flex: none;
  }
  .model-name {
    font-weight: 620;
    font-size: 12.5px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-chip {
    font-size: 10.5px;
    font-weight: 650;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-2);
    flex: none;
    white-space: nowrap;
  }
  .status-chip[data-status='streaming'],
  .status-chip[data-status='sending'],
  .status-chip[data-status='queued'] {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .status-chip[data-status='error'] {
    background: color-mix(in oklab, var(--danger) 16%, transparent);
    color: var(--danger);
  }
  .status-chip[data-status='signed-out'],
  .status-chip[data-status='needs-action'] {
    background: color-mix(in oklab, var(--warning) 18%, transparent);
    color: var(--warning);
  }
  .status-chip[data-status='done'] {
    background: color-mix(in oklab, var(--success) 16%, transparent);
    color: var(--success);
  }

  .answer-body {
    padding: 12px;
    flex: 1;
    min-width: 0;
  }
  .hint {
    margin: 0 0 10px;
    font-size: 13px;
  }
  .error-text {
    color: var(--danger);
    margin: 0 0 10px;
    font-size: 13px;
    white-space: pre-wrap;
  }

  .answer-footer {
    display: flex;
    gap: 4px;
    padding: 7px 9px;
    border-top: var(--border-w) solid var(--border);
    flex: none;
  }
  .btn.sm {
    height: 26px;
    padding: 0 9px;
    font-size: 12px;
  }

  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .sk-line {
    height: 11px;
    border-radius: 5px;
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--tab-hover) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: nd-ask-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes nd-ask-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
