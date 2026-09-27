<script lang="ts">
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import type { ProxyTestResult } from '@shared/ipc'
  import Group from './Group.svelte'
  import Row from './Row.svelte'
  import Segmented from './Segmented.svelte'
  import Select from './Select.svelte'
  import Toggle from './Toggle.svelte'
  import { nd, setSettings, ui } from '../../lib/state.svelte'
  import { t } from '../../lib/i18n'

  let password = $state('')
  let testing = $state(false)
  let result = $state<ProxyTestResult | null>(null)

  const proxy = $derived(ui.settings.proxy)

  function commitPassword() {
    if (!password) return
    setSettings({ proxy: { password } })
    password = ''
  }

  async function test() {
    testing = true
    result = null
    try {
      result = await nd.invoke('proxy:test')
    } finally {
      testing = false
    }
  }
</script>

<p class="hint muted">{t('network.hint')}</p>

<Group>
  <Row label={t('network.proxy')}>
    <Segmented
      options={[
        { value: 'system', label: t('network.modeSystem') },
        { value: 'direct', label: t('network.modeDirect') },
        { value: 'custom', label: t('network.modeCustom') },
      ] as const}
      value={proxy.mode}
      onchange={(v) => setSettings({ proxy: { mode: v } })}
    />
  </Row>
</Group>

{#if proxy.mode === 'custom'}
  <Group>
    <Row label={t('network.scheme')}>
      <Select
        value={proxy.scheme}
        options={[
          { value: 'http', label: 'HTTP' },
          { value: 'socks5', label: 'SOCKS5' },
        ] as const}
        onchange={(v) => setSettings({ proxy: { scheme: v } })}
      />
    </Row>
    <Row label={t('network.host')}>
      <input
        class="input"
        value={proxy.host}
        onblur={(e) => setSettings({ proxy: { host: e.currentTarget.value.trim() } })}
        onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </Row>
    <Row label={t('network.port')}>
      <input
        class="input port"
        type="number"
        min="1"
        max="65535"
        value={proxy.port}
        onblur={(e) => setSettings({ proxy: { port: Number(e.currentTarget.value) || proxy.port } })}
        onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </Row>
    <Row label={t('network.username')}>
      <input
        class="input"
        value={proxy.username}
        onblur={(e) => setSettings({ proxy: { username: e.currentTarget.value } })}
        onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </Row>
    <Row label={t('network.password')}>
      <input
        class="input"
        type="password"
        autocomplete="new-password"
        bind:value={password}
        placeholder={proxy.hasPassword ? t('network.passwordSaved') : ''}
        onblur={commitPassword}
        onkeydown={(e) => e.key === 'Enter' && commitPassword()}
      />
    </Row>
    <Row label={t('network.googleOnly')} hint={t('network.googleOnlyHint')}>
      <Toggle checked={proxy.googleOnly} onchange={(v) => setSettings({ proxy: { googleOnly: v } })} />
    </Row>
  </Group>

  {#if proxy.scheme === 'socks5'}
    <p class="note warning"><TriangleAlert size={14} /> {t('network.socksNote')}</p>
  {/if}
{/if}

<div class="test-row">
  <button type="button" class="btn" disabled={testing} onclick={test}>{testing ? t('network.testing') : t('network.test')}</button>
  {#if result}
    {#if result.ok}
      <span class="result ok">{t('network.testOk', { ms: result.ms ?? 0 })}</span>
    {:else}
      <span class="result fail">{t('network.testFail', { error: result.error || String(result.status ?? '') })}</span>
    {/if}
  {/if}
</div>

<style>
  .hint {
    font-size: 12px;
  }
  .port {
    width: 100px;
  }
  .note.warning {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: -6px 2px 0;
    font-size: 11.5px;
    color: var(--warning);
  }
  .test-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .result {
    font-size: 12px;
  }
  .result.ok {
    color: var(--success);
  }
  .result.fail {
    color: var(--danger);
  }
</style>
