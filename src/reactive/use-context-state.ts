import type { EndgeContextStateTransform } from '@endge/core'
import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import { getCurrentScope, onScopeDispose, ref, toRaw, watch } from 'vue'

// Связывает Vue ref с dynamic state текущего Endge context scope.
// Глубокие изменения записываются автоматически; смена context/user перечитывает значение.
export function createContextStateRef<T>(
  key: string,
  defaultFactory: () => T,
  transform?: EndgeContextStateTransform<T>,
): Ref<T> {
  const context = Endge.context
  const state = ref(context.getState(key, transform) ?? defaultFactory()) as Ref<T>
  let writing = false
  let applying = false

  const stopWatch = watch(
    state,
    (value) => {
      if (applying) {
        return
      }
      writing = true
      try {
        context.setState(key, toRaw(value) as T, transform)
      }
      finally {
        writing = false
      }
    },
    { deep: true, flush: 'sync' },
  )

  const reload = (): void => {
    if (writing) {
      return
    }
    applying = true
    try {
      state.value = context.getState(key, transform) ?? defaultFactory()
    }
    finally {
      applying = false
    }
  }

  const offState = context.subscribeState(key, reload)
  const offContext = context.subscribe(reload)
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopWatch()
      offState()
      offContext()
    })
  }

  return state
}
