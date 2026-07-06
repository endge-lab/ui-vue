import type { VNode } from 'vue'
import type { JSXComponentProps } from '@endge/core'
import { Endge } from '@endge/core'
import ComponentType_DSL from '@/ui/render/ts/ComponentType_DSL'
import { randomString } from '@endge/utils'

const fn = (
  h: (...args: any[]) => VNode,
  props: JSXComponentProps,
): VNode | null => {
  const idAttr = props.node.props.find((p) => p.name === 'id')
  const id = idAttr?.value?.content
  if (!id) {
    console.warn('[Component]: id attribute is missing')
    return null
  }

  // Находим компонент в домене
  const targetComponent = Endge.domain.getComponent(id)
  if (!targetComponent) {
    console.warn(`[Component]: Component with id "${id}" not found`)
    return null
  }

  // Проверяем, что это JSX компонент
  if (targetComponent.kind !== 'jsx') {
    console.warn(`[Component]: Component "${id}" is not a JSX component`)
    return null
  }

  // Создаем локальный comData, вычисляя выражения в атрибутах
  const localComData: Record<string, any> = {}
  for (const prop of props.node.props) {
    if (prop.type === 6 /* ATTRIBUTE */) {
      // Статический атрибут
      localComData[prop.name] = prop.value?.content || true
    }

    if (
      prop.type === 7 /* DIRECTIVE */ &&
      prop.name === 'bind' &&
      prop.arg?.type === 4 &&
      prop.exp?.type === 4
    ) {
      // Вычисляем значение выражения в контексте родительского scope
      const expr = prop.exp.content.trim()
      const value = Endge.script.evaluate(expr, props.scope, {
        ...props.comData,
        Data: {
          all: props.allData,
          ...props.comData,
        },
      })
      localComData[prop.arg.content] = value
    }
  }

  // Создаем изолированный scope для компонента
  const scopeId = `component-scope-${randomString(5)}`
  const scope = Endge.script.getScope(scopeId, props.scope)

  return ComponentType_DSL(h, {
    model: targetComponent,
    allData: props.allData,
    comData: localComData,
    scope: scope,
  })
}

export default fn
