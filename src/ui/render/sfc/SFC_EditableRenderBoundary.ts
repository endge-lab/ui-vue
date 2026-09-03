import type { ComponentSFCRuntimeHost } from '@endge/core'
import type { PropType } from 'vue'
import { defineComponent, onBeforeUnmount, shallowRef, watch } from 'vue'

import { isSFCVueEditableResourceUpdate } from '@/services/render/sfc/SFCVueEditableResource'

/**
 * Isolates one editable consumer from the root SFC render version.
 * A session transition invalidates only this boundary instead of the whole Table.
 */
export const SFC_EditableRenderBoundary = defineComponent({
  name: 'EndgeSFCEditableRenderBoundary',
  props: {
    host: {
      type: Object as PropType<ComponentSFCRuntimeHost>,
      required: true,
    },
    sessionKey: {
      type: String,
      required: true,
    },
  },
  setup(props, { slots }) {
    const version = shallowRef(0)
    let subscribedHost: ComponentSFCRuntimeHost | null = null
    let active = false

    const resourceDirtyHandler = (update: unknown): void => {
      if (!isSFCVueEditableResourceUpdate(update)) {
        return
      }
      const nextActive = Boolean(props.host.getEditSession(props.sessionKey))
      if (update.key !== props.sessionKey && nextActive === active) {
        return
      }
      active = nextActive
      version.value++
    }

    const stopHostWatch = watch(
      () => props.host,
      (host) => {
        subscribedHost?.off('resource:dirty', resourceDirtyHandler)
        subscribedHost = host
        active = Boolean(host.getEditSession(props.sessionKey))
        subscribedHost.on('resource:dirty', resourceDirtyHandler)
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      stopHostWatch()
      subscribedHost?.off('resource:dirty', resourceDirtyHandler)
      subscribedHost = null
    })

    return () => {
      void version.value
      return slots.default?.() ?? null
    }
  },
})
