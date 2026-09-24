import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

// Текущая локаль (Endge.context.currentLocale).
// Список доступных локалей задается Endge.workspace. Синхронизируется с localStorage через Endge.context.
export function useCurrentLocale() {
  const context = Endge.context
  const current = ref<string>(context.currentLocale)

  const off = context.subscribe(() => {
    current.value = context.currentLocale
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (locale: string | null) => Endge.commands.execute({ type: 'context:set-locale', payload: { locale } }),
  }
}
