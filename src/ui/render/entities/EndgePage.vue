<script setup lang="ts">
import type { RPage, RuntimeHost } from '@endge/core'

import { Endge } from '@endge/core'
import { computed, onBeforeMount, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Identity страницы в домене (RPage). */
    identity: string
    /** Параметры страницы (route params, query). */
    params?: Record<string, unknown>
  }>(),
  { params: () => ({}) },
)

const page = computed<RPage | null>(() =>
  Endge.domain.getPage(props.identity) ?? null,
)

const pageRuntime = ref<RuntimeHost | null>(null)
onBeforeMount(() => {
  if (!page.value) { return }

  const host = Endge.runtime.execute(page.value, {})
  if (host)
    pageRuntime.value = host
})

onUnmounted(() => {
  if (pageRuntime.value?.id) {
    Endge.runtime.destroyRuntime(pageRuntime.value.id)
    pageRuntime.value = null
  }
})
</script>

<template>
  <div class="endge-page">
    <slot :page="page" :runtime="pageRuntime" />
  </div>
</template>

<style scoped>
.endge-page {
  display: contents;
}
</style>
