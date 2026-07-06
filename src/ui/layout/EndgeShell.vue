<script setup lang="ts">
import type { EndgeEnvId, EndgeProjectId } from '@endge/core'

import EndgeAppHelperMenu from '@/ui/layout/EndgeAppHelperMenu.vue'

interface Props {
  project: EndgeProjectId
  env: EndgeEnvId
}

defineProps<Props>()
</script>

<template>
  <slot />
  <EndgeAppHelperMenu />
</template>
