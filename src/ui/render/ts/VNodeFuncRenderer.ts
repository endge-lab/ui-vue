import { h } from 'vue'
import type { VNode } from 'vue'
import type { RComponent } from '@endge/core'

/**
 * Позволяет рендерить функциональные ts компоненты внутри vue компонентов
 */
export default (props: {
  component: (h: any, props: object) => VNode
  model: RComponent
  comData: any
}): VNode => {
  return props.component(h, {
    model: props.model,
    comData: props['com-data'],
  })
}
