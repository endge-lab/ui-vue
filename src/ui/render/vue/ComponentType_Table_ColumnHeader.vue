<script lang="ts" setup>
import type { RComponentTableColumn } from '@endge/core'

import { ref } from 'vue'

interface Props {
  entity: RComponentTableColumn
  hasFilters: boolean
  isPinned?: boolean
  hasActiveFilters: boolean

  //
  // Данные сортировки
  isSortable?: boolean
  sortEnabled?: boolean
  sortOrder?: 'asc' | 'desc'
  sortIndex?: number
  onSortClick?: (e?: MouseEvent) => void
}

const props = withDefaults(defineProps<Props>(), {
  isPinned: false,
})

const emit = defineEmits<{
  (e: 'contextmenu', event: MouseEvent, entity: any): void
}>()

const isHovering = ref(false)

// невидимый символ ‎ самый адекватный хак
// по исправлению бага с некликабельными заголовками колонок

//
// СОРТИРОВКИ
//
function handleHeaderClick(e: MouseEvent): void {
  if (!props.isSortable)
    return

  // чтобы не всплывало в RevoGrid (он всё равно сортировки не делает, но лучше изолировать)
  e.preventDefault()
  e.stopPropagation()

  props.onSortClick?.(e)
}
</script>

<template>
  <div
    style="display: flex !important; justify-content: space-around;" :class="{
      'cursor-pointer': props.isSortable,
    }" @click="handleHeaderClick"
  >
    <span
      :class="{ 'highlighted-column': props.entity?.optionalColor }"
      class="column-default"
    >
      {{ props.entity.title }} ‎
    </span>

    <span v-if="props.sortEnabled && props.sortOrder" style="color: #FF0000; position: absolute; left:0;  top: -3px; !important;">
      <i :class="`${props.sortOrder}`" />
      {{ props.sortIndex + 1 }}
    </span>

    <button
      v-if="props.hasFilters"
      :style="`position: absolute; right:0;  top: -3px; !important; opacity: ${props.hasActiveFilters ? 1 : 0};`"
      class="rv-filter"
    />
    <div
      v-if="props.isPinned"
      class="tabler-pinned-icon-inject"
    />
  </div>
</template>
