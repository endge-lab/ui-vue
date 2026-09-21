<script setup lang="ts">
import type {
  ComponentSFCRuntimeHost,
  FilterViewRuntimeHost,
  RuntimeHostInputSource,
} from '@endge/core'

import { computed, provide, ref } from 'vue'

import SFC_RuntimeRenderer from '@/ui/render/sfc/SFC_RuntimeRenderer.vue'
import { TanStackTableRuntimeContextKey } from './tanstack-table-runtime-context'

defineOptions({
  name: 'EndgeTanStackTableRuntimeRenderer',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  host: ComponentSFCRuntimeHost | null
  input: RuntimeHostInputSource
  filterRuntime?: FilterViewRuntimeHost | null
  showSearch?: boolean
  showFilters?: boolean
  filtersDefaultOpen?: boolean
}>(), {
  filterRuntime: null,
  showSearch: false,
  showFilters: false,
  filtersDefaultOpen: false,
})

const searchValue = ref('')
const filtersVisible = ref(props.filtersDefaultOpen)

provide(TanStackTableRuntimeContextKey, {
  showSearch: computed(() => props.showSearch),
  showFilters: computed(() => props.showFilters),
  filterRuntime: computed(() => props.filterRuntime),
  searchValue,
  filtersVisible,
})
</script>

<template>
  <SFC_RuntimeRenderer
    v-bind="$attrs"
    :host="host"
    :input="input"
  />
</template>
