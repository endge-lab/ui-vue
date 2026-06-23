import type { VNode } from 'vue'
import { JSXRender_Base } from '@/ui/render/dsl-jsx/JSXRender_Base'
import type { JSXComponentProps } from '@endge/core'

/**
 * JSX-компонент `<Layout>` - флекс-контейнер для декларативного размещения элементов.
 *
 * Используется в DSL-описаниях для группировки других компонентов.
 *
 * ### Поддерживаемые атрибуты:
 *
 * | Атрибут     | Тип       | Описание                                                      | Пример                |
 * |-------------|------------|---------------------------------------------------------------|------------------------|
 * | `direction` | `string`   | Направление флекса: `row` (по умолчанию) или `column`        | `"column"`            |
 * | `gap`       | `string`   | Отступ между элементами (в px или CSS-единицах)              | `"12"`, `"1rem"`      |
 * | `align`     | `string`   | Выравнивание по поперечной оси (align-items)                 | `"start"`, `"center"` |
 * | `justify`   | `string`   | Выравнивание по основной оси                                 | `"start"`, `"end"`, `"center"`, `"space-between"` |
 * | `wrap`      | `boolean`  | Разрешить перенос строк: `true` или `false` (по умолчанию)   | `"true"`              |
 * | `class`     | `string`   | Дополнительные CSS-классы для контейнера                     | `"my-layout"`         |
 *
 * @example
 * ```jsx
 * <Layout direction="row" gap="16" align="center" justify="space-between" class="my-layout">
 *   <Button>Назад</Button>
 *   <Button>Далее</Button>
 * </Layout>
 * ```
 */
const fn = (h: (...args: any[]) => VNode, props: JSXComponentProps): VNode => {
  const styles: Record<string, string> = {
    display: 'flex',
    'flex-direction': 'row',
    'flex-wrap': 'nowrap',
  }

  const classes: string[] = []

  for (const attr of props.node.props) {
    if (attr.type !== 6 /* ATTRIBUTE */) continue

    const { name, value } = attr
    const val = value?.content || ''

    switch (name) {
      case 'direction':
        styles['flex-direction'] = val === 'column' ? 'column' : 'row'
        break

      case 'gap': {
        const gapNum = parseFloat(val)
        // Интерпретируем gap как множитель 0.25rem
        styles['gap'] = !isNaN(gapNum) ? `${gapNum * 0.25}rem` : '0'
        break
      }

      case 'wrap':
        styles['flex-wrap'] = val === 'true' ? 'wrap' : 'nowrap'
        break

      case 'align':
        // align-items: start | center | end
        if (['start', 'center', 'end'].includes(val)) {
          styles['align-items'] = val
        }
        break

      case 'justify':
        // justify-content: start | center | end | space-between
        if (['start', 'center', 'end', 'space-between'].includes(val)) {
          styles['justify-content'] = val
        }
        break

      case 'class':
        classes.push(val)
        break
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
