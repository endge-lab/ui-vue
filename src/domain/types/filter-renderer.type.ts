import type { FilterRuntimeHost } from '@endge/core'

export interface EndgeFilterRendererProps {
  runtime: FilterRuntimeHost
  output?: string
  readonly?: boolean
}
