import type { VNode } from 'vue'
import type { JSXComponentProps } from '@endge/core'
import { JSXRender_Base } from '@/ui/render/dsl-jsx/JSXRender_Base'

/**
 * Рендер-компонент для тега `<Box>` в декларативном DSL.
 *
 * Представляет собой обёртку (контейнер) на базе `div`, к которой можно
 * применить стили, отступы, фоны и классы.
 *
 * @param h - Функция `createElement` из Vue
 * @param props.node - AST-узел текущего тега
 * @param props.children - Вложенные элементы
 * @param props.context - Контекст исполнения (не используется)
 * @param props.vars - Карта переменных (не используется)
 *
 * @example JSX DSL
 * ```jsx
 * <Box bg="blue">
 *   <Text>Контент</Text>
 * </Box>
 * ```
 */
const fn = (h: (...args: any[]) => VNode, props: JSXComponentProps): VNode => {
  const styles: Record<string, string> = {}
  const classes: string[] = []

  // Обработка атрибутов
  for (const attr of props.node.props) {
    if (attr.type !== 6) continue
    const { name, value } = attr
    const val = value?.content || ''

    switch (name) {
      case 'bg': // Поддержка фона
        styles['background-color'] = val
        break
      // Можно добавить другие атрибуты, такие как цвет текста, границы и т.д.
    }
  }

  return h(
    'div',
    {
      style: styles,
      class: classes.join(' '),
      ...props.handlers,
    },
    props.children,
  )
}

export default JSXRender_Base(fn)
