<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy'
  import type { AskTurn } from '@shared/ask'
  import { t } from './state.svelte'
  import AnswerCard from './AnswerCard.svelte'

  let { turn }: { turn: AskTurn } = $props()

  let copied = $state(false)
  function copyPrompt(): void {
    void navigator.clipboard.writeText(turn.prompt).then(() => {
      copied = true
      setTimeout(() => (copied = false), 1200)
    })
  }
</script>

<div class="turn">
  <div class="prompt-row">
    <div class="prompt-bubble">
      <span class="prompt-text">{turn.prompt}</span>
      <button type="button" class="copy-btn icon-btn" title={copied ? t('ask.copied') : t('ask.copy')} onclick={copyPrompt}>
        <Copy size={13} />
      </button>
    </div>
  </div>
  <div class="answers" class:grid={turn.answers.length > 1}>
    {#each turn.answers as answer (answer.model)}
      <AnswerCard {answer} turnId={turn.id} />
    {/each}
  </div>
</div>

<style>
  .turn {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
  }
  .prompt-row {
    display: flex;
    justify-content: flex-end;
  }
  .prompt-bubble {
    position: relative;
    max-width: 82%;
    background: var(--accent-soft);
    color: var(--text);
    padding: 9px 34px 9px 13px;
    border-radius: var(--radius-lg);
    font-size: 13.5px;
    line-height: 1.5;
  }
  .prompt-text {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .copy-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    opacity: 0;
    transition: opacity var(--dur) var(--ease);
  }
  .prompt-bubble:hover .copy-btn,
  .copy-btn:focus-visible {
    opacity: 1;
  }
  .answers {
    display: flex;
    flex-direction: column;
  }
  .answers.grid {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(280px, 1fr);
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
</style>
