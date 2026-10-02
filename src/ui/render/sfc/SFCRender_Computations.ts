import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'

const hiddenConsumerScopes = new WeakMap<RComponentSFC_IR_ElementNode, readonly string[]>()

// Ключ строки не должен смешиваться с разделителями иерархии consumer.
export function computationScopeKey(key: unknown): string {
  return encodeURIComponent(String(key))
}

// Удаляет ресурсы ушедших строк/колонок, сохраняя cache текущего набора данных, включая offscreen строки.
export function reconcileTableComputations(
  context: SFCVueRenderContext | null | undefined,
  rows: readonly Record<string, unknown>[],
  rowKey: string,
  columns: readonly { key: string }[],
): void {
  if (!context?.host) {
    return
  }
  const rowIds = new Set(rows.map((row, index) => computationScopeKey(row[rowKey] ?? index)))
  const columnIds = new Set(columns.map(column => computationScopeKey(column.key)))
  context.host.releaseComputationResources(context.consumerScope, (key) => {
    const path = key.slice(context.consumerScope.length + 1)
    if (!path.startsWith('row:')) {
      return true
    }
    const [row, column] = path.split('/')
    return rowIds.has(row!.slice(4)) && columnIds.has(column?.slice(7) ?? '')
  })
}

// For сохраняет только реально присутствующие consumer-ветви.
export function reconcileForComputations(context: SFCVueRenderContext, nodeId: string, keys: readonly unknown[]): void {
  const scope = `${context.consumerScope}/for:${nodeId}`
  const active = new Set(keys.map(computationScopeKey))
  context.host?.releaseComputationResources(scope, (key) => {
    const child = key.slice(scope.length + 1).split(/[/:]/, 1)[0]!
    return active.has(child)
  })
}

// Убирает ресурсы скрытой ветви; Component и Table являются отдельными consumer scopes.
export function releaseNodeComputations(context: SFCVueRenderContext, node: RComponentSFC_IR_ElementNode): void {
  if (!context.host) {
    return
  }

  for (const scope of getHiddenConsumerScopes(node)) {
    context.host.releaseComputationResources(`${context.consumerScope}/${scope}`)
  }
}

function getHiddenConsumerScopes(node: RComponentSFC_IR_ElementNode): readonly string[] {
  const cached = hiddenConsumerScopes.get(node)
  if (cached) {
    return cached
  }

  // A boundary owns all resources below it; primitive nodes have no scope to
  // release. IR is immutable, so this walk is needed only once per hidden node.
  let scopes: readonly string[]
  if (node.directives.for) {
    scopes = [`for:${node.id}`]
  }
  else if (node.tag === 'Component') {
    scopes = [`component:${node.id}`]
  }
  else if (node.tag === 'Table') {
    scopes = [`table:${node.id}`]
  }
  else {
    scopes = (node.children ?? []).flatMap(child => child.kind === 'element' ? getHiddenConsumerScopes(child) : [])
  }
  hiddenConsumerScopes.set(node, scopes)
  return scopes
}
