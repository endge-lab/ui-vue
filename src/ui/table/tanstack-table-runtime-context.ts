import type { FilterViewRuntimeHost } from '@endge/core'
import type { InjectionKey, Ref } from 'vue'

export interface TanStackTableRuntimeContext {
  showSearch: Readonly<Ref<boolean>>
  showFilters: Readonly<Ref<boolean>>
  filterRuntime: Readonly<Ref<FilterViewRuntimeHost | null>>
  searchValue: Ref<string>
  filtersVisible: Ref<boolean>
}

export const TanStackTableRuntimeContextKey: InjectionKey<TanStackTableRuntimeContext>
  = Symbol('EndgeTanStackTableRuntimeContext')
