import type { ElementNode } from '@vue/compiler-dom'
import type { RuntimeScope } from '@endge/core'
import type { JSXRenderMiddlewareInput } from '@endge/core'
import type { VNode } from 'vue'
import { Endge } from '@endge/core'

/**
 * Middleware для обработки событий (on:click и т.п.)
 */
export function JSXRender_Base_Events(
  input: JSXRenderMiddlewareInput,
): VNode | null {
  const { node, props, vnode } = input
  props.handlers = {
    ...props.handlers,
    ...extractEventHandlers(node, props.scope),
  }
  return vnode
}

/**
 * Извлекает события и формирует объект обработчиков
 */
function extractEventHandlers(
  node: ElementNode,
  scope?: RuntimeScope,
): Record<string, CallableFunction> {
  const result: Record<string, CallableFunction> = {}

  for (const prop of node.props) {
    if (
      prop.type === 7 &&
      prop.name === 'on' &&
      prop.arg?.type === 4 &&
      prop.exp?.type === 4
    ) {
      const eventName = 'on' + capitalize(prop.arg.content)
      const handlerName = prop.exp.content.trim()
      const handler = scope?.findExportedFn(handlerName)

      // Если это обработчик - код
      if (handler) {
        result[eventName] = handler
      }
      // Или выполняем Действие
      else if (Endge.domain.hasAction(handlerName)) {
        result[eventName] = () => {
          const action = Endge.domain.hasAction(handlerName)
          // Endge.runtime.
        }
      }
    }
  }

  return result
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
