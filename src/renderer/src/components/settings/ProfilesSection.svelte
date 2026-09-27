<script lang="ts">
  import UserPlus from '@lucide/svelte/icons/user-plus'
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right'
  import LogOut from '@lucide/svelte/icons/log-out'
  import Trash from '@lucide/svelte/icons/trash'
  import { PROFILE_COLORS, type Profile } from '@shared/settings'
  import Group from './Group.svelte'
  import ColorSwatches from './ColorSwatches.svelte'
  import ConfirmButton from './ConfirmButton.svelte'
  import { closeOverlay, nd, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'
  import { newTab } from '../../lib/actions'

  function updateProfile(p: Profile, patch: Partial<Pick<Profile, 'name' | 'color'>>) {
    void nd.invoke('profiles:update', { ...p, ...patch })
  }

  function commitName(p: Profile, e: FocusEvent & { currentTarget: HTMLInputElement }) {
    const name = e.currentTarget.value.trim()
    if (name && name !== p.name) updateProfile(p, { name })
    else e.currentTarget.value = p.name
  }

  function openProfileTab(id: string) {
    newTab(ui.settings.defaultService, id)
    closeOverlay()
  }

  function addProfile() {
    const color = PROFILE_COLORS[ui.settings.profiles.length % PROFILE_COLORS.length]!
    void nd.invoke('profiles:create', t('profiles.newName'), color)
  }
</script>

<p class="hint muted">{t('profiles.hint')}</p>

<Group>
  {#each ui.settings.profiles as p (p.id)}
    <div class="profile">
      <div class="main">
        <span class="dot" style:background={p.color} aria-hidden="true"></span>
        <input class="input name" value={p.name} maxlength="40" onblur={(e) => commitName(p, e)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        <ColorSwatches colors={PROFILE_COLORS} value={p.color} size={16} onchange={(c) => updateProfile(p, { color: c })} />
        {#if p.id === ui.settings.defaultProfileId}
          <span class="badge">{t('profiles.default')}</span>
        {:else}
          <button type="button" class="btn ghost" onclick={() => setSettings({ defaultProfileId: p.id })}>{t('profiles.makeDefault')}</button>
        {/if}
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" onclick={() => openProfileTab(p.id)}>
          <ArrowUpRight size={14} />
          {t('profiles.newTab')}
        </button>
        <ConfirmButton
          label={t('profiles.clearData')}
          confirmText={t('profiles.clearDataConfirm', { name: p.name })}
          onconfirm={() => nd.invoke('profiles:clearData', p.id)}
        >
          {#snippet icon()}<LogOut size={14} />{/snippet}
        </ConfirmButton>
        <ConfirmButton
          label={t('profiles.delete')}
          confirmText={t('profiles.deleteConfirm', { name: p.name })}
          disabled={ui.settings.profiles.length <= 1}
          disabledTitle={t('profiles.cannotDeleteLast')}
          onconfirm={() => nd.invoke('profiles:delete', p.id)}
        >
          {#snippet icon()}<Trash size={14} />{/snippet}
        </ConfirmButton>
      </div>
    </div>
  {/each}
</Group>

<button type="button" class="btn" onclick={addProfile}>
  <UserPlus size={15} />
  {t('profiles.add')}
</button>

<style>
  .hint {
    font-size: 12px;
  }
  .profile {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
  }
  .main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex: none;
  }
  .name {
    width: 160px;
  }
  .badge {
    font-size: 11px;
    font-weight: 650;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    white-space: nowrap;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  :global([data-density='compact']) .profile {
    padding: 8px 14px;
    gap: 8px;
  }
</style>
