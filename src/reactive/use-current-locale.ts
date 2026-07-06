import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/**
 * Текущая локаль (Endge.context.currentLocale).
 * Мок: en | ru. Синхронизируется с localStorage через Endge.context.
 */
export function useCurrentLocale() {
  const context = Endge.context
  const current = ref<string>(context.currentLocale)

  const off = context.subscribe(() => {
    current.value = context.currentLocale
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (locale: string | null) => context.setCurrentLocale(locale),
  }
}
