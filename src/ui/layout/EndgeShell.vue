<script setup lang="ts">
import type { EndgeEnvId, EndgeProjectId } from '@endge/core'

import EndgeContextMenuRoot from '@/ui/overlay/EndgeContextMenuRoot.vue'

interface Props {
  project: EndgeProjectId
  env: EndgeEnvId
}

defineProps<Props>()
</script>

<template>
  <slot />
  <EndgeContextMenuRoot />
</template>
