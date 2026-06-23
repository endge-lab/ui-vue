import type { VNode } from 'vue'
import { EndgeJsxAttr } from '@endge/core'

/**
 * Добавляет к существующему class строку или массив.
 */
function mergeClass(
  existing: string | string[] | undefined,
  add: string,
): string | string[] {
  if (existing == null || existing === '') return add
  if (Array.isArray(existing)) return [...existing, add]
  return `${existing} ${add}`.trim()
}

/**
 * Рекурсивно патчит дерево vnode: добавляет классы endge-tag-root / endge-tag
 * и атрибут endge-tag-identity для всех тегов-элементов.
 */
export function patchTagMetadata(
  children: (VNode | string | null)[],
  isTopLevel: boolean,
  nextId: () => string,
): void {
  for (const child of children) {
    if (child == null || typeof child !== 'object' || typeof (child as VNode).type !== 'string')
      continue

    const vnode = child as VNode
    const tagClass = isTopLevel ? EndgeJsxAttr.TagRoot : EndgeJsxAttr.Tag
    const identity = nextId()

    const props = vnode.props ?? {}
    vnode.props = {
      ...props,
      class: mergeClass(props.class, tagClass),
      [EndgeJsxAttr.TagIdentity]: identity,
    }

    const inner = vnode.children
    if (Array.isArray(inner))
      patchTagMetadata(inner as (VNode | string | null)[], false, nextId)
  }
}
