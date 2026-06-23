import { Endge } from '@endge/core'
import type { JSXRenderMiddlewareInput } from '@endge/core'
import type { VNode } from 'vue'

/**
 * Глобальный контекст JSX-рендера.
 * Отслеживает состояние цепочки if / else-if / else.
 */
export const JSXRenderContext = {
  chainActive: false, // Есть ли активная цепочка if/else-if/else
  lastIfResult: false, // Последний результат if/else-if
}

/**
 * Middleware для обработки v-if / v-else-if / v-else
 */
export function JSXRender_Base_IfElse(
  input: JSXRenderMiddlewareInput,
): VNode | null {
  const { node, props, vnode } = input
  const { scope } = props

  const ifDirective = node.props.find(
    (p) => p.type === 7 && p.name === 'if' && p.exp?.type === 4,
  )

  const elseIfDirective = node.props.find(
    (p) => p.type === 7 && p.name === 'else-if' && p.exp?.type === 4,
  )

  const elseDirective = node.props.find(
    (p) =>
      (p.type === 6 && p.name === 'else') ||
      (p.type === 7 && p.name === 'else'),
  )

  // === v-if ===
  if (ifDirective) {
    const expr = ifDirective.exp.content.trim()
    try {
      const result = Endge.script.evaluate(expr, scope!, {
        ...props.comData,
        Data: { ...props.comData },
      })

      JSXRenderContext.chainActive = true
      JSXRenderContext.lastIfResult = Boolean(result)
      return JSXRenderContext.lastIfResult ? vnode : null
    } catch (e) {
      console.warn('[DSL]: Ошибка в v-if:', expr, e)
      JSXRenderContext.chainActive = true
      JSXRenderContext.lastIfResult = false
      return null
    }
  }

  // === v-else-if ===
  if (elseIfDirective && JSXRenderContext.chainActive) {
    // Только если предыдущий if/else-if был false
    if (!JSXRenderContext.lastIfResult) {
      const expr = elseIfDirective.exp.content.trim()
      try {
        const result = Endge.script.evaluate(expr, scope!, {
          ...props.comData,
          Data: { ...props.comData },
        })

        JSXRenderContext.lastIfResult = Boolean(result)
        return JSXRenderContext.lastIfResult ? vnode : null
      } catch (e) {
        console.warn('[DSL]: Ошибка в v-else-if:', expr, e)
        return null
      }
    } else {
      // предыдущий if/else-if уже сработал
      return null
    }
  }

  // === v-else ===
  if (elseDirective && JSXRenderContext.chainActive) {
    const shouldRender = !JSXRenderContext.lastIfResult
    // Сбрасываем цепочку после else
    JSXRenderContext.chainActive = false
    JSXRenderContext.lastIfResult = false
    return shouldRender ? vnode : null
  }

  // Вне цепочки
  JSXRenderContext.chainActive = false
  JSXRenderContext.lastIfResult = false
  return vnode
}
