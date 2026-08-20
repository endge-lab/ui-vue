<script setup lang="ts">
import type { ProjectRuntimeSession } from '@endge/core'

import { DEFAULT_ENDGE_TOOLTIP_CONFIGURATION, Endge } from '@endge/core'
import { subscribeKeyboardState } from '@endge/utils'
import { onBeforeUnmount, provide, ref } from 'vue'
import EndgeContextMenuRoot from '@/ui/overlay/EndgeContextMenuRoot.vue'
import EndgeTooltipRoot from '@/ui/overlay/tooltip/EndgeTooltipRoot.vue'
import {
  EndgeVueTooltipManager,
  EndgeVueTooltipManagerKey,
} from '@/ui/overlay/tooltip/endge-tooltip-manager'

const props = withDefaults(defineProps<{
  tooltipAdapterId?: string
}>(), {
  tooltipAdapterId: 'vue-native',
})

const status = ref<'initializing' | 'ready' | 'error'>('initializing')
const error = ref<unknown>(null)

let disposed = false
let session: ProjectRuntimeSession | null = null
const unsubscribeKeyboard = typeof document === 'undefined'
  ? null
  : subscribeKeyboardState(document, state => Endge.context.setKeyboardState(state))
const tooltipManager = new EndgeVueTooltipManager(
  props.tooltipAdapterId,
  resolveTooltipConfiguration(),
)
provide(EndgeVueTooltipManagerKey, tooltipManager)

async function initialize(): Promise<void> {
  try {
    const mountedSession = await Endge.runtime.project.mount(Endge.context.getCurrentProject())
    if (disposed) {
      await mountedSession.unmount()
      return
    }

    session = mountedSession
    status.value = 'ready'
  }
  catch (reason) {
    if (disposed)
      return

    error.value = reason
    status.value = 'error'
  }
}

void initialize()

onBeforeUnmount(() => {
  disposed = true
  unsubscribeKeyboard?.()
  tooltipManager.dispose()
  const mountedSession = session
  session = null
  void mountedSession?.unmount()
})

function resolveTooltipConfiguration() {
  try {
    return Endge.configuration.current.tooltips
  }
  catch {
    return { ...DEFAULT_ENDGE_TOOLTIP_CONFIGURATION }
  }
}
</script>

<template>
  <slot
    v-if="status === 'initializing'"
    name="spinner"
  />
  <slot
    v-else-if="status === 'error'"
    name="error"
    :error="error"
  />
  <template v-else>
    <slot />
    <EndgeContextMenuRoot />
    <EndgeTooltipRoot :manager="tooltipManager" />
  </template>
</template>
