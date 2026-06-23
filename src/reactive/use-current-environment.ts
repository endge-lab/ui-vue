import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/**
 * Текущая среда исполнения (Endge.app.environment).
 * Синхронизируется с localStorage через Endge.app.
 */
export function useCurrentEnvironment() {
  const app = Endge.app
  const current = ref<string | null>(app.getCurrentEnvironment())

  const off = app.subscribe(() => {
    current.value = app.getCurrentEnvironment()
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (identity: string | null) => app.setCurrentEnvironment(identity),
  }
}
