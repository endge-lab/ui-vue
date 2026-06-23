import type { VNode } from 'vue'
import type { RComponentBase } from '@endge/core'
import type { ComponentType_Props } from '@endge/core'
import { EndgeJsxAttr, Prefix } from '@endge/core'
import { Endge } from '@endge/core'
import { randomString } from '@endge/utils'
import type { RuntimeContext } from '@endge/core'
import type { RuntimeScope } from '@endge/core'

/**
 * Базовый layout-обёртка для всех компонентов.
 * Выполняет ctxScript и возвращает обёрнутый `div.component-wrapper`.
 *
 * @param renderFn Основная функция рендера компонента
 * @returns Функция рендера с обёрткой и запуском скрипта
 */
export default function ComponentType_Base<T extends RComponentBase>(
  renderFn: (
    h: (...args: any[]) => VNode,

    // scope будет пустым только для самого верхнего уровня
    props: Omit<ComponentType_Props<T>, 'scope'> & { scope?: RuntimeScope },
  ) => VNode,
) {
  return (
    h: (...args: any[]) => VNode,
    props: ComponentType_Props<T>,
  ): VNode => {
    const { model, scope: parentScope } = props

    //
    // Создаем среду исполнения
    const scopeId = `component-scope-${randomString(5)}`
    const scope = Endge.script.getScope(scopeId, parentScope)

    // Запускаем скрипт в среде исполнения, если он есть
    if (model.setupScript?.length) {
      //
      // Создаем контейнер для скрипта
      const ctx: Partial<RuntimeContext> = {
        ...props.comData,
        Data: {
          ...props.comData,
        },
      }

      // Запускаем скрипт в контейнере и с контекстом текущей строки данных.
      // Здесь нужно явно передать props.model.exportedNames, чтобы они были далее доступны в контексте.
      // Все следующие вызовы скриптов в этом не нуждаются.
      Endge.script.runSync(
        model.setupScript,
        scope,
        ctx,
        props.model.exportedNames,
      )
    }

    // Получаем содержимое и оборачиваем его
    const vnode = renderFn(h, {
      ...props,
      scope,
    })
    return h(
      'div',
      {
        class: Prefix.ComponentWrapper,
        [EndgeJsxAttr.ComponentIdentity]: model.identity ?? model.id,
        [EndgeJsxAttr.ComponentId]: model.id,
      },
      [vnode],
    )
  }
}
