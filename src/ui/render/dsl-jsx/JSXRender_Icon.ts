import type { JSXComponentProps } from '@endge/core'
import type { VNode } from 'vue'

import { JSXRender_Base } from '@/ui/render/dsl-jsx/JSXRender_Base'

/**
 * Рендер-компонент для тега `<Icon>` в декларативном DSL.
 *
 * Позволяет отрисовать иконку, указав полный CSS-класс (например, `ti ti-star`).
 * Можно задать размер, отступы и дополнительные CSS-классы.
 *
 * ### Поддерживаемые атрибуты:
 * | Атрибут     | Описание                               | Пример значения         |
 * |-------------|-----------------------------------------|--------------------------|
 * | `name`      | Полный CSS-класс иконки                 | `ti ti-settings`         |
 * | `size`      | Размер иконки (font-size)               | `1rem`, `18px`           |
 * | `class`     | Дополнительные CSS-классы               | `mr-2 text-red-500`      |
 *
 *
 * @example JSX DSL
 * ```jsx
 * <Icon name="ti ti-star-filled" size="18px" class="mr-2 text-yellow-500" />
 * ```
 */
function fn(h: (...args: any[]) => VNode, props: JSXComponentProps): VNode {
  let iconClass = ''
  let size = '1rem'
  const extraClasses: string[] = []

  for (const attr of props.node.props) {
    if (attr.type !== 6 /* ATTRIBUTE */)
      continue
    const { name, value } = attr
    const val = value?.content || ''

    switch (name) {
      case 'name':
        iconClass = val
        break
      case 'size':
        size = val
        break
      case 'class':
        extraClasses.push(val)
        break
    }
  }

  const fullClass = [iconClass, ...extraClasses].filter(Boolean).join(' ')

  return h('i', {
    class: fullClass,
    style: {
      fontSize: size,
    },
    ...props.handlers,
  })
}

export default JSXRender_Base(fn)
