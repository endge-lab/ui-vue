<script lang="ts" setup>
import type { RuntimeHost } from '@endge/core'

import ComponentType_TableV2 from '@/ui/render/vue/ComponentType_TableV2.vue'

defineProps<{
  /** Runtime компонента (обычно comRt из useEndge.view()) */
  runtime: RuntimeHost<'table'> | null | undefined
  /** Показывать статус-бар таблицы */
  enabledStatusBar?: boolean
}>()
</script>

<template>
  <ComponentType_TableV2
    v-if="runtime"
    :runtime="runtime"
    :enabled-status-bar="enabledStatusBar"
  />
</template>
