import type { VNode } from 'vue'

export function withBlink(h: (...args: any[]) => VNode, child: VNode): VNode {
  return h(
    'div',
    {
      class: 'cell-blink',
    },
    [child],
  )
}
