<script setup lang="ts">
import type { EndgeViewId } from '@endge/core'

import { useEndgeView } from '@/reactive/use-endge-view'

interface Props {
  identity: EndgeViewId
  space?: string
}

const props = withDefaults(defineProps<Props>(), {
  space: 'default',
})

const viewState = useEndgeView(props.identity, {
  space: props.space,
})
</script>

<template>
  <slot v-bind="viewState" />
</template>
