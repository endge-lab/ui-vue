import type { FilterViewRenderModel, FilterViewRuntimeHost } from '@endge/core'

export interface EndgeFilterRendererProps {
  runtime?: FilterViewRuntimeHost | null
  /** Модель наблюдаемого клиента позволяет использовать тот же renderer без локального Filter runtime. */
  model?: FilterViewRenderModel
  readonly?: boolean
}
