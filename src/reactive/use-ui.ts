import type { EndgeUI_Module } from '@endge/core'
import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@/reactive/use-subscribable-ref'

export const useUI = (): Ref<EndgeUI_Module> => useSubscribableRefAuto(Endge.ui)
