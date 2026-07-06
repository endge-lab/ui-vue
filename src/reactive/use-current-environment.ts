import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/**
 * Текущая среда исполнения (Endge.context.environment).
 * Синхронизируется с localStorage через Endge.context.
 */
export function useCurrentEnvironment() {
  const context = Endge.context
  const current = ref<string | null>(context.getCurrentEnvironment())

  const off = context.subscribe(() => {
    current.value = context.getCurrentEnvironment()
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (identity: string | null) => context.setCurrentEnvironment(identity),
  }
}
