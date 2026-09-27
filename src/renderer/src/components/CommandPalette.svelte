<script lang="ts">
  let { mode = 'all' }: { mode?: 'all' | 'prompts' } = $props()
</script>

<div class="panel" data-mode={mode}></div>
