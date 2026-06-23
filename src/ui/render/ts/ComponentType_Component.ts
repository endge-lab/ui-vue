import type { RComponent, RuntimeScope } from '@endge/core'
import type { VNode } from 'vue'
import { renderEndgeComponent } from '@endge/core'

export default (
  h: any,
  props: {
    model: RComponent
    comData: Record<string, any>
    context?: Record<string, any>
    scope?: RuntimeScope
  },
): VNode => {
  return renderEndgeComponent({
    h,
    model: props.model,
    comData: props.comData,
    scope: props.scope,
    host: 'table-cell',
    context: props.context,
  })
}
