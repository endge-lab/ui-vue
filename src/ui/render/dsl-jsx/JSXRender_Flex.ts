import type { VNode } from 'vue'
import type { JSXComponentProps } from '@endge/core'
import JSXRender_Layout from '@/ui/render/dsl-jsx/JSXRender_Layout'

/**
 * JSX-компонент `<Flex>` - упрощённая версия Layout.
 * Автоматически подставляет второе выравнивание и умеет задавать gap.
 *
 * ### Поддерживаемые атрибуты:
 * | Атрибут  | Описание                                       | Пример         |
 * |----------|-----------------------------------------------|----------------|
 * | `col`    | Включает вертикальное направление (column)    | `true`         |
 * | `row`    | Включает горизонтальное направление (row)     | `true` (по умолчанию) |
 * | `align`  | Выравнивание по основному направлению         | `"start"`      |
 * | `gap`    | Отступ между элементами (целое число, множитель 0.25rem) | `"2"`     |
 * | `class`  | Дополнительные CSS-классы                     | `"my-flex"`    |
 *
 * @example
 * ```jsx
 * <Flex col align="start" gap="2">
 *   <Text>Пример текста</Text>
 * </Flex>
 * ```
 */
const JSXRender_Flex = (
  h: (...args: any[]) => VNode,
  props: JSXComponentProps,
): VNode => {
  let direction: 'row' | 'column' = 'row'
  let align: string = 'start'
  let gap: string = '3' // по умолчанию
  let classAttr: string | undefined

  for (const attr of props.node.props) {
    if (attr.type !== 6 /* ATTRIBUTE */) continue

    const { name, value } = attr
    const val = value?.content || ''

    if (name === 'col') {
      direction = 'column'
    } else if (name === 'row') {
      direction = 'row'
    } else if (name === 'align') {
      align = val
    } else if (name === 'gap') {
      gap = val.trim()
    } else if (name === 'class') {
      classAttr = val
    }
  }

  const layoutProps = [
    { type: 6, name: 'direction', value: { content: direction } },
    {
      type: 6,
      name: 'align',
      // Для `row` align - это вертикальное выравнивание, для `column` - горизонтальное
      value: { content: direction === 'row' ? 'center' : align },
    },
    {
      type: 6,
      name: 'justify',
      // Для `row` justify - горизонтальное выравнивание, для `column` - вертикальное
      value: { content: direction === 'row' ? align : 'center' },
    },
    { type: 6, name: 'gap', value: { content: gap } },
  ]

  if (classAttr) {
    layoutProps.push({
      type: 6,
      name: 'class',
      value: { content: classAttr },
    })
  }

  // Создаём новый "виртуальный" узел Layout для передачи в JSXRender_Layout
  const layoutNode: JSXComponentProps['node'] = {
    ...props.node,
    name: 'Layout',
    props: layoutProps,
  }

  // Вызываем JSXRender_Layout, передавая корректные параметры (scope, handlers, etc.)
  return JSXRender_Layout(h, {
    ...props,
    node: layoutNode,
    // В этом случае children оставляем исходными
    children: props.children,
  })
}

export default JSXRender_Flex
