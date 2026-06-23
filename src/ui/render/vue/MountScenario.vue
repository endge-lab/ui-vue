<script setup lang="ts">
import type { RScenario } from '@endge/core'
import { Endge } from '@endge/core'
import ComponentRenderer from '@/ui/render/vue/ComponentRenderer.vue'
import { ref } from 'vue'
import { RuntimeEventType } from '@endge/core'
import type { RComponent } from '@endge/core'

interface Props {
  scenario: RScenario
  runImmediately?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  runImmediately: true,
})

// Компонент, который будет смонтирован
const component = ref<RComponent | null>(null)

// Ключ хранилища с данными компонента
const storeKey = ref<string | null>(null)

onMounted(async () => {
  console.log('VARS', Endge.domain.getSetting('general').vars)
  if (props.runImmediately) {
    await runScript()
  }
})

// Подготовка среды исполнения и запуск скрипта
async function runScript(): Promise<void> {
  const scenario = props.scenario
  const { scope, run } = scenario.runner()

  scope.on(RuntimeEventType.Mounted, () => {
    console.debug(
      `(MountScenario.vue mounted): Компонент "${scope.ui.componentMountedId}" смонтирован (Данные: ${scope.ui.componentMountedStoreId})`,
    )

    const rComponent = Endge.domain.getComponent(
      scope.ui.componentMountedId || '<>',
    )
    if (!rComponent) {
      console.error(
        `(MountScenario.vue mounted): Компонент "${scope.ui.componentMountedId}" не найден`,
      )
      return
    }
    component.value = rComponent!
    storeKey.value = scope.ui.componentMountedStoreId || null
  })

  await run()
}

defineExpose({
  runScript,
})
</script>

<template>
  <ComponentRenderer
    v-if="component"
    :model="component"
    :store-key="storeKey"
  />
</template>
