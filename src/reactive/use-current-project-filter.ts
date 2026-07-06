import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/**
 * Текущий проект (приложение) для виджета домена.
 * Синхронизируется с Endge.context, сохраняется в ядро (localStorage). null = «Все».
 */
export function useCurrentProjectFilter() {
  const context = Endge.context
  const current = ref<string | null>(context.getCurrentProject())

  const off = context.subscribe(() => {
    current.value = context.getCurrentProject()
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (identity: string | null) => context.setCurrentProject(identity),
  }
}
