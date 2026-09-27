<script lang="ts">
  import { tick } from 'svelte'
  import ArrowDown from '@lucide/svelte/icons/arrow-down'
  import { ask, t } from './state.svelte'
  import TurnView from './TurnView.svelte'
  import Composer from './Composer.svelte'

  let scrollEl: HTMLDivElement | undefined = $state()
  let userScrolledUp = $state(false)
  let showJump = $state(false)
  let lastId: string | null = null

  // A cheap signature that changes whenever any answer's text or status grows, so the effect
  // below re-checks the scroll position while an answer streams in.
  const signature = $derived.by(() => {
    const conv = ask.current
    if (!conv) return 0
    let n = conv.turns.length
    for (const turn of conv.turns) {
      for (const a of turn.answers) n += a.markdown.length + a.status.length
    }
    return n
  })

  $effect(() => {
    const id = ask.current?.id ?? null
    void signature
    if (id !== lastId) {
      lastId = id
      userScrolledUp = false
      showJump = false
    }
    if (!scrollEl || userScrolledUp) return
    void tick().then(scrollToBottom)
  })

  function scrollToBottom(): void {
    if (!scrollEl) return
    scrollEl.scrollTop = scrollEl.scrollHeight
    showJump = false
  }

  function onScroll(): void {
    if (!scrollEl) return
    const gap = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
    userScrolledUp = gap > 48
    showJump = userScrolledUp
  }
</script>

<div class="pane">
  {#if !ask.current}
    <div class="welcome">
      <div class="welcome-inner">
        <h2>{t('ask.welcomeTitle')}</h2>
        <p class="muted">{t('ask.welcomeHint')}</p>
        <Composer />
      </div>
    </div>
  {:else}
    {@const conv = ask.current}
    <div class="turns" bind:this={scrollEl} onscroll={onScroll}>
      {#each conv.turns as turn (turn.id)}
        <TurnView {turn} />
      {/each}
    </div>
    <div class="composer-dock">
      {#if showJump}
        <button type="button" class="jump-btn" title={t('ask.jumpToLatest')} onclick={scrollToBottom}>
          <ArrowDown size={15} />
        </button>
      {/if}
      <Composer />
    </div>
  {/if}
</div>

<style>
  .pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .welcome {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    overflow: auto;
  }
  .welcome-inner {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(560px, 100%);
    text-align: center;
  }
  .welcome-inner h2 {
    font-size: 19px;
  }
  .welcome-inner :global(.composer) {
    text-align: left;
  }
  .turns {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .composer-dock {
    position: relative;
    padding: 10px 14px 14px;
    flex: none;
  }
  .jump-btn {
    position: absolute;
    top: -38px;
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface);
    border: var(--border-w) solid var(--border);
    color: var(--text-2);
    box-shadow: var(--shadow);
    transition: color var(--dur) var(--ease);
  }
  .jump-btn:hover {
    color: var(--text);
  }
</style>
