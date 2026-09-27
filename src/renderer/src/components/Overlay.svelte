<script lang="ts">
  // Full-window layer for palette/settings/panels. The live web view can't be blurred from
  // here, so main hands us a screenshot of it which we blur into a frosted backdrop.
  import type { Snippet } from 'svelte'
  import type { LayoutInsets } from '@shared/ipc'
  import { closeOverlay, ui } from '../lib/state.svelte'

  let {
    insets,
    align = 'top',
    children,
  }: { insets: LayoutInsets; align?: 'top' | 'center' | 'right'; children: Snippet } = $props()
</script>

<div class="overlay" role="presentation">
  {#if ui.snapshot}
    <img
      class="shot"
      src={ui.snapshot}
      alt=""
      style:top="{insets.top}px"
      style:left="{insets.left}px"
      style:right="{insets.right}px"
      style:bottom="{insets.bottom}px"
      style:border-radius="{insets.radius}px"
      draggable="false"
    />
  {/if}
  <button class="scrim" aria-label="close" tabindex="-1" onclick={closeOverlay}></button>
  <div class="holder {align}">
    {@render children()}
  </div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    -webkit-app-region: no-drag;
  }
  .shot {
    position: absolute;
    width: calc(100% - 0px);
    object-fit: fill;
    filter: blur(18px) saturate(1.2);
    transform: scale(1.02);
    opacity: 0.9;
    animation: nd-fade-in 180ms var(--ease);
    pointer-events: none;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    animation: nd-fade-in 180ms var(--ease);
    cursor: default;
  }
  .holder {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
    padding: 24px;
  }
  .holder > :global(*) {
    pointer-events: auto;
  }
  .holder.top {
    align-items: flex-start;
    padding-top: 11vh;
  }
  .holder.center {
    align-items: center;
  }
  .holder.right {
    justify-content: flex-end;
    align-items: stretch;
    padding: 12px;
  }
</style>
