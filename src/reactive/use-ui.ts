import type { EndgeUI } from '@endge/core'
import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import { useSubscribableRefAuto } from '@endge/utils'

export const useUI = (): Ref<EndgeUI> => useSubscribableRefAuto(Endge.ui)
