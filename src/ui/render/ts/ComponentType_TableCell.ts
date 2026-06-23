import type { HyperFunc, VNode } from '@revolist/vue3-datagrid'
import type {
  ReflectComponentTableColumnComponent,
  RuntimeBindingScope,
} from '@endge/core'

import { resolveScopedTablePath } from '@endge/core'
import { RComponentTableColumn_isHtml } from '@endge/core'
import { RComponentTableColumn_isComponent } from '@endge/core'
import type { RComponentTable } from '@endge/core'
import ComponentType_Component from '@/ui/render/ts/ComponentType_Component'
import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import { withBlink } from '@/ui/render/helpers/blink-wrapper'

export default function (
  h: HyperFunc<VNode>,
  props: {
    basePath: string
    scope?: RuntimeBindingScope | null
    table: RComponentTable
    column: ReflectComponentTableColumnComponent
    rowIndex: number
    row: unknown // Фактические данные строки
  },
): VNode | null {


  //
  // ToDo: контекст??
  const inputs = props.column.getInputs()
  // const extracted = Object.fromEntries(
  //   Object.entries(props.column.dataPaths).map(([key, path]) => {
  //     if (!path?.length) return [key, null]
  //
  //     return [
  //       key,
  //       Raph.get(`${path}`, {
  //         vars: {
  //           store: props.basePath,
  //           i: props.rowIndex,
  //         },
  //       }),
  //     ]
  //   }),
  // )
  const extracted: Record<string, unknown> = Object.fromEntries(
    Object.entries(props.column.dataPaths).map(([key, path]) => {
      if (!path?.length) return [key, null]
      const bindingKeys = Object.keys((props.table as any)?.bindings?.keys ?? {})
      const sourceVar = String(
        bindingKeys[0]
        || (props.table as any)?.inputFields?.[(props.table as any)?.sourceIndex]?.name
        || '',
      )
      const scope: RuntimeBindingScope = props.scope ?? {
        parentRuntimeId: null,
        basePath: String(props.basePath ?? '').trim() || null,
        aliases: {
          root: String(props.basePath ?? ''),
          ...(String(props.basePath ?? '').trim() && sourceVar
            ? {
                items: `${String(props.basePath ?? '').trim()}.${sourceVar}`,
                row: `${String(props.basePath ?? '').trim()}.${sourceVar}[$i]`,
              }
            : {}),
        },
      }
      const resolved = resolveScopedTablePath({
        rawPath: String(path),
        scope,
        rowIndex: props.rowIndex,
      })

      return [
        key,
        Raph.get(resolved.path, { vars: resolved.vars }),
      ]
    }),
  )


  //
  // Конвертеры перед отрисовкой
  function applyConverterChain(value: unknown, spec: string | undefined): unknown {
    if (!spec)
      return value

    const ids = String(spec)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    if (!ids.length)
      return value

    let current: unknown = value
    for (const id of ids) {
      const converter = Endge.domain.getConverter(id)
      if (!converter)
        continue
      current = converter.convert(current)
    }
    return current
  }

  for (const extractedKey in extracted) {
    if (!inputs[extractedKey])
      continue
    const spec = props.column.dataConverters?.[extractedKey]
    if (!spec)
      continue
    extracted[extractedKey] = applyConverterChain(extracted[extractedKey], spec)
  }

  // Если в ячейку нужно внедрить внешний компонент
  if (
    RComponentTableColumn_isComponent(props.column) &&
    props.column.componentId
  ) {
    const component = Endge.domain.getComponent(props.column.componentId)
    if (!component) {
      console.error('Component not found', props.column.componentId)
      return h('div', {}, '<err>')
    }

    return ComponentType_Component(h, {
      basePath: props.basePath,
      model: component,
      comData: extracted,
      context: {
        rowIndex: props.rowIndex,
        rowNumber: props.rowIndex + 1,
      },
    })
  }

  return h('div', {}, '<404>')
}
