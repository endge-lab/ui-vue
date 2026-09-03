import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/** Тонкий Vue-adapter для временной зоны, которой владеет EndgeContext_Module. */
export function useCurrentTimezone() {
  const context = Endge.context
  const current = ref<string>(context.currentTimezone)

  const off = context.subscribe(() => {
    current.value = context.currentTimezone
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (timezone: string | null) => context.setCurrentTimezone(timezone),
  }
}
