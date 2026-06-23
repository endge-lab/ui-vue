<script setup lang="ts">
import { Endge } from '@endge/core'
import ComponentRenderer from '@/ui/render/vue/ComponentRenderer.vue'
import { ref } from 'vue'
import type { RComponent } from '@endge/core'
import { generateMockInputData } from '@endge/core'
import { ComponentType } from '@endge/core'

interface Props {
  previewModel: RComponent
}

const props = withDefaults(defineProps<Props>(), {})

// Ключ хранилища с данными компонента
const storeKey = ref<string | null>('preview-data')

onMounted(() => {
  console.debug('(ComponentPreview):', props.previewModel)

  let mockData = generateMockInputData(props.previewModel.inputFields, 5)
  console.debug('(ComponentPreview): Mock data generated:', mockData)

  // ToDo
  if (props.previewModel?.type === ComponentType.Table) {
    mockData = mockData['$']
  }

  Endge.store.updateState('preview-data', mockData)
})
</script>

<template>
  <ComponentRenderer :model="props.previewModel" :store-key="storeKey" />
</template>
