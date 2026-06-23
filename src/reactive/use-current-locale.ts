import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/**
 * Текущая локаль (Endge.app.currentLocale).
 * Мок: en | ru. Синхронизируется с localStorage через Endge.app.
 */
export function useCurrentLocale() {
  const app = Endge.app
  const current = ref<string>(app.currentLocale)

  const off = app.subscribe(() => {
    current.value = app.currentLocale
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (locale: string | null) => app.setCurrentLocale(locale),
  }
}
