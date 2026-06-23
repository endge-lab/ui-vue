<script lang="ts" setup>
import { defineProps, reactive, watch, onBeforeUnmount } from 'vue'
import type { RComponent } from '@endge/core'
import type { RenderComponentInfo } from '@endge/core'
import { RenderComponentType } from '@endge/core'
import { resolveEndgeComponentRenderInfo } from '@endge/core'
import VNodeFuncRenderer from '@/ui/render/ts/VNodeFuncRenderer'

const props = defineProps<{
  model: RComponent
  storeKey: string | null
}>()

let unsubscribe: (() => void) | null = null
const renderer = reactive<RenderComponentInfo>({
  component: 'div',
  type: RenderComponentType.Component,
})

// ComponentRenderer - это обёртка для точки монтирования, поэтому она создается один раз.
// Watch не несет нагрузки на производительность.
// Все внутренние компоненты будут созданы по другому принципу.
// Общий обработчик на изменение props
watch(
  props,
  (newProps) => {
    // 1. Отписка от предыдущего стора
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }

    // 2. Обновляем renderer
    const comp = resolveEndgeComponentRenderInfo({
      model: newProps.model,
      host: 'view',
    })
    if (!comp) {
      console.error(
        `(wrapper): не найден renderer для "${newProps.model.identity ?? newProps.model.id}"`,
      )
      return
    }
    renderer.component = comp.component
    renderer.type = comp.type
  },
  { immediate: true, deep: false },
)

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<template>
  <!-- Динамически выбираем рендер-компонент на основе типа из componentModel -->
  <component
    :is="renderer.component"
    v-if="renderer.type === RenderComponentType.Component"
    :model="props.model"
    :base-path="storeKey"
  />
  <!-- Для функциональный компонентом пробросим через обертку -->
  <VNodeFuncRenderer
    v-else
    :component="renderer.component"
    :model="props.model"
  ></VNodeFuncRenderer>
</template>
