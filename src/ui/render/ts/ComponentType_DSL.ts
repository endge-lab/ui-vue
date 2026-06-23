import { Endge } from '@endge/core'
import type { RComponentDSL } from '@endge/core'
import type { VNode } from 'vue'
import type { TemplateChildNode } from '@vue/compiler-dom'
import { randomString } from '@endge/utils'
import ComponentType_Base from '@/ui/render/ts/ComponentType_Base'
import type { ComponentType_Props } from '@endge/core'
import { patchTagMetadata } from '@/ui/render/helpers/patch-tag-metadata'

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const fn = (
  h: (...args: any[]) => VNode,
  props: ComponentType_Props<RComponentDSL>,
): VNode => {
  const { ast, varsPaths } = props.model
  const domain = Endge.domain
  const scope = props.scope

  if (!ast) return h('div', 'Empty DSL')

  // 1. Извлекаем значения переменных заранее
  const varsMap = new Map<string, any>()
  varsPaths.forEach((path, key) => {
    const value = Endge.extract.path(props.comData, domain, path, null)
    varsMap.set(key, value)
  })
  if (props.context) {
    for (const key in props.context) {
      varsMap.set(key, props.context[key])
    }
  }

  // 2. Основная функция рендера
  function renderNode(node: TemplateChildNode): VNode | string | null {
    if (node.type === 1 /* ELEMENT */) {
      const tag = node.tag
      const renderer = Endge.uiRegistry.resolveLegacyComponentRenderer({
        componentIdentity: String(tag),
        host: 'view',
      })

      // Обработка кастомного тега
      if (renderer) {
        const children = node.children.map(renderNode).filter(Boolean)

        const handlers: Record<string, Function> = {}
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
            if (handler) {
              handlers[eventName] = handler
            }
          }
        }

        if (renderer.renderType === 'component') {
          return h(renderer.component, {
            node,
            children,
            comData: props.comData,
            varsMap,
            scope,
            ...handlers,
          })
        }

        return renderer.component(h, {
          node,
          children,
          comData: props.comData,
          varsMap,
          scope,
          ...handlers,
        })
      }

      // Обычный HTML тег
      const nativeChildren = node.children.map(renderNode).filter(Boolean)
      const nativeAttrs: Record<string, any> = {}

      for (const prop of node.props) {
        // Простой HTML-атрибут
        if (prop.type === 6 /* ATTRIBUTE */) {
          nativeAttrs[prop.name] = prop.value?.content || true
        }

        // Обработка директив вида @click="handler"
        if (
          prop.type === 7 /* DIRECTIVE */ &&
          prop.name === 'on' &&
          prop.arg?.type === 4 &&
          prop.exp?.type === 4
        ) {
          const eventName = 'on' + capitalize(prop.arg.content)
          const handlerName = prop.exp.content.trim()
          const handler = scope?.export.names?.[handlerName]
          if (handler) {
            nativeAttrs[eventName] = handler
          }
        }

        // Обработка :bind
        if (
          prop.type === 7 &&
          prop.name === 'bind' &&
          prop.arg?.type === 4 &&
          prop.exp?.type === 4
        ) {
          nativeAttrs[prop.arg.content] = evaluateExpr(prop.exp.content)
        }
      }

      return h(tag, nativeAttrs, nativeChildren)
    }

    // {{ $.something }} - интерполяция
    if (node.type === 5 /* INTERPOLATION */) {
      return evaluateExpr(node.content.content)
    }

    // Текст без интерполяции
    if (node.type === 2 /* TEXT */) {
      return node.content
    }

    return null
  }

  // 3. Вспомогательная функция
  function evaluateExpr(expr: string): any {
    const key = expr.trim()
    return varsMap.has(key) ? varsMap.get(key) : null
  }

  const children = ast.children.map(renderNode).filter(Boolean) as (VNode | string)[]
  const nextId = () => randomString(8)
  patchTagMetadata(children, true, nextId)
  return h('div', {}, children)
}

export default ComponentType_Base(fn)
