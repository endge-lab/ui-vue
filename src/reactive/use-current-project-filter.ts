import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/**
 * Текущий проект (приложение) для виджета домена.
 * Синхронизируется с Endge.app, сохраняется в ядро (localStorage). null = «Все».
 */
export function useCurrentProjectFilter() {
  const app = Endge.app
  const current = ref<string | null>(app.getCurrentProject())

  const off = app.subscribe(() => {
    current.value = app.getCurrentProject()
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (identity: string | null) => app.setCurrentProject(identity),
  }
}
