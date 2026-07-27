<script setup lang="ts">
import type { ProjectRuntimeSession } from '@endge/core'

import { Endge } from '@endge/core'
import { onBeforeUnmount, ref } from 'vue'
import EndgeContextMenuRoot from '@/ui/overlay/EndgeContextMenuRoot.vue'

const status = ref<'initializing' | 'ready' | 'error'>('initializing')
const error = ref<unknown>(null)

let disposed = false
let session: ProjectRuntimeSession | null = null

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
  const mountedSession = session
  session = null
  void mountedSession?.unmount()
})
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
  </template>
</template>
