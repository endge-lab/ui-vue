import type { EndgeViewId, RComponent, RFilter, RQuery, RuntimeHost, RView } from '@endge/core'

import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import { onBeforeUnmount, shallowRef } from 'vue'

export interface UseEndgeViewOptions {
  /** Space для query runtime (фильтры и т.д.) */
  space?: string
}

export interface UseEndgeViewReturn {
  /** Runtime компонента (таблица) */
  comRt: Readonly<ReturnType<typeof shallowRef<RuntimeHost<'table'> | null>>>
  /** Runtime запроса */
  queryRt: Readonly<ReturnType<typeof shallowRef<RuntimeHost<'query'> | null>>>
  /** Перезапуск запроса вида */
  refresh: () => Promise<void>
  /** Ручное уничтожение рантаймов (вызывается автоматически в onBeforeUnmount) */
  destroy: () => void
  /** Доменная сущность вида */
  view: RView | null
  /** Доменная сущность фильтра вида (если view.filterId задан) */
  filter: RFilter | undefined
  /** Доменная сущность компонента (таблица/DSL) */
  table: RComponent | null
  /** Доменная сущность запроса */
  query: RQuery | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function areEqualValues(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((item, index) => areEqualValues(item, b[index]))
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
      return false
    }
    return aKeys.every(key => areEqualValues(a[key], b[key]))
  }

  return false
}

function hasObjectPatchChanges(current: unknown, patch: Record<string, unknown>): boolean {
  const source = isPlainObject(current) ? current : {}
  return Object.entries(patch).some(([key, value]) => !areEqualValues(source[key], value))
}

function restorePersistedFilterToRaph(filter: string | { identity?: string | null }, space?: string): void {
  const rawIdentity = typeof filter === 'string'
    ? filter
    : String(filter?.identity ?? '')
  const identity = rawIdentity.trim().replace(/^filters\./, '')
  const normalizedSpace = String(space ?? 'default').trim() || 'default'
  if (!identity) {
    return
  }

  try {
    const raw = localStorage.getItem('endge:filters')
    const store = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    const payload = store?.[`${identity}.${normalizedSpace}`]
    if (!isPlainObject(payload)) {
      return
    }

    const raphKey = `filters.${identity}.${normalizedSpace}`
    if (!hasObjectPatchChanges(Raph.get(raphKey), payload)) {
      return
    }

    Raph.merge(raphKey, payload)
  }
  catch {
  }
}

/**
 * Композабл: поднимает вид по identity, создаёт query + table runtimes, правильные пути.
 * Жизненный цикл: при размонтировании компонента автоматически вызывает destroy().
 */
export function useEndgeView(
  identity: EndgeViewId,
  options: UseEndgeViewOptions = {},
): UseEndgeViewReturn {
  const space = options.space ?? 'default'

  const comRt = shallowRef<RuntimeHost<'table'> | null>(null)
  const queryRt = shallowRef<RuntimeHost<'query'> | null>(null)

  function destroy(): void {
    try {
      queryRt.value?.destroy?.()
      comRt.value?.destroy?.()
    }
    finally {
      queryRt.value = null
      comRt.value = null
    }
  }

  const view = Endge.domain.getView(identity)
  if (!view) {
    console.error(`[useEndgeView] View "${identity}" not found`)
    return { comRt, queryRt, refresh: async () => {}, destroy, view: null, filter: undefined, table: null, query: null }
  }

  const queryId = view.queryId
  const componentId = view.componentId

  const query = Endge.domain.getQuery(queryId)
  const component = Endge.domain.getComponent(componentId)
  const filter = view.filterId ? Endge.domain.getFilter(view.filterId) : undefined

  if (filter) {
    restorePersistedFilterToRaph(filter, space)
  }

  if (!query) {
    console.error(`[useEndgeView] Query "${queryId}" for view "${identity}" not found`)
    return { comRt, queryRt, refresh: async () => {}, destroy, view, filter, table: null, query: null }
  }

  if (!component) {
    console.error(`[useEndgeView] Component "${componentId}" for view "${identity}" not found`)
    return { comRt, queryRt, refresh: async () => {}, destroy, view, filter, table: null, query }
  }
  const queryIdentity = String(query.identity ?? '').trim()
  if (!queryIdentity) {
    console.error(`[useEndgeView] Query identity is empty for view "${identity}"`)
    return { comRt, queryRt, refresh: async () => {}, destroy, view, filter, table: component, query }
  }

  queryRt.value = Endge.runtime.execute(query, { space }) as RuntimeHost<'query'> | null
  comRt.value = Endge.runtime.execute(component as any, {
    basePath: `queries.${queryIdentity}`,
  }) as RuntimeHost<'table'> | null

  async function refresh(): Promise<void> {
    await query.run({ filterSpace: space })
  }

  onBeforeUnmount(() => {
    destroy()
  })

  return { comRt, queryRt, refresh, destroy, view, filter, table: component, query }
}

function useEndgeViewInternal(identity: EndgeViewId, options?: UseEndgeViewOptions) {
  return useEndgeView(identity, options ?? {})
}

/**
 * Фасад для композаблов Endge (Vue).
 * useEndge.view('<identity>') - быстрый запуск вида с управлением жизненным циклом.
 */
export const useEndge = {
  view: useEndgeViewInternal,
}
