<script lang="ts" setup>
import type {
  RComponentTable,
  RComponentTableColumn,
  RuntimeBindingScope,
  RuntimeHost,
} from '@endge/core'

import {
  Endge,
  RComponentTableColumn_isHtml,
  asRuntimeBindingScope,
  getRuntimeScopeItemsPath,
  resolveScopedTablePath,
} from '@endge/core'
import { Raph } from '@endge/raph'
import { randomString } from '@endge/utils'
import RevoGrid, { VGridVueTemplate } from '@revolist/vue3-datagrid'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useRevoGrid } from '@/reactive/use-revogrid'
import { useUI } from '@/reactive/use-ui'
import ComponentType_TableCell from '@/ui/render/ts/ComponentType_TableCell'
import ComponentType_Table_ColumnHeader from '@/ui/render/vue/ComponentType_Table_ColumnHeader.vue'
import ComponentType_Table_StatusBar from '@/ui/render/vue/ComponentType_Table_StatusBar.vue'

const props = defineProps<{
  runtime: RuntimeHost<'table'>
  enabledStatusBar?: boolean
}>()

const ui = useUI()

//
//

const gridHeightPx = ref<number>(0)
let ro: ResizeObserver | null = null

//
//
const id = randomString(3)

const source = ref<any[]>([])
const revo = useRevoGrid({
  id,
  runtimeId: props.runtime?.node?.meta?.entityId ?? '',
  getOrderedRowIds: () => source.value.map(row => String(row?.rowId ?? row?.id ?? '').trim()),
})

const previousScrollCoordinate = ref(-1)

function parseTimeToMs(v: unknown): number {
  const s = String(v ?? '').trim()
  if (!s)
    return Number.NaN

  const parts = s.split(':').map(x => Number(x))
  const h = parts[0]
  const m = parts[1]
  const sec = parts[2] ?? 0

  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec))
    return Number.NaN

  return ((h * 60 + m) * 60 + sec) * 1000
}

function normalizeByType(v: unknown, type: string): string | number | boolean | null {
  if (v == null)
    return null

  switch (type) {
    case 'Number': {
      const n = typeof v === 'number' ? v : Number(String(v).trim())
      return Number.isFinite(n) ? n : null
    }

    case 'Boolean': {
      if (typeof v === 'boolean')
        return v
      const s = String(v).trim().toLowerCase()
      if (s === 'true' || s === '1' || s === 'yes')
        return true
      if (s === 'false' || s === '0' || s === 'no')
        return false
      return null
    }

    case 'DateTime': {
      if (v instanceof Date) {
        const t = v.getTime()
        return Number.isNaN(t) ? null : t
      }

      // если пришёл timestamp числом/строкой
      if (typeof v === 'number' && Number.isFinite(v))
        return v

      const s = String(v).trim()
      if (!s)
        return null

      // "1700000000000" -> timestamp
      const n = Number(s)
      if (Number.isFinite(n) && /^\d{10,}$/.test(s))
        return n

      // ISO / RFC / etc
      const t = Date.parse(s)
      return Number.isNaN(t) ? null : t
    }

    case 'Time': {
      const t = parseTimeToMs(v)
      return Number.isNaN(t) ? null : t
    }

    case 'String':
    default:
      return String(v).toLowerCase()
  }
}

function compareByType(a: unknown, b: unknown, type: string): number {
  const av = normalizeByType(a, type)
  const bv = normalizeByType(b, type)
  if (av === bv)
    return 0

  // nulls last
  if (av == null && bv != null)
    return 1
  if (av != null && bv == null)
    return -1
  if (av == null && bv == null)
    return 0

  if (typeof av === 'number' && typeof bv === 'number')
    return av - bv

  if (typeof av === 'boolean' && typeof bv === 'boolean')
    return av === bv ? 0 : (av ? 1 : -1)

  return String(av).localeCompare(String(bv))
}

function getSortBy(columnId: string): string | null {
  const m = tableModel.value as any
  const col = (m?.columns ?? []).find((c: any) => String(c?.id) === String(columnId))
  const by = String(col?.sort?.by ?? '')
  return by.length ? by : null
}

const runtimeScope = computed<RuntimeBindingScope>(() => {
  const scope = asRuntimeBindingScope(props.runtime?.meta?.scope)
  if (scope) {
    return scope
  }

  const fallbackBasePath = String(props.runtime?.node?.meta?.basePath ?? '')
  const fallbackSourceVar = String(sourceVar.value ?? '').trim()
  return {
    parentRuntimeId: null,
    basePath: fallbackBasePath || null,
    aliases: {
      root: fallbackBasePath,
      ...(fallbackBasePath && fallbackSourceVar
        ? {
            items: `${fallbackBasePath}.${fallbackSourceVar}`,
            row: `${fallbackBasePath}.${fallbackSourceVar}[$i]`,
          }
        : {}),
    },
  }
})

function getRowValueBy(rowIndex: number, columnId: string, by: string): unknown {

  const m = tableModel.value as any
  if (!m || !by)
    return undefined

  const col = (m?.columns ?? []).find((c: any) => String(c?.id) === String(columnId))
  const pathRaw: string | undefined = col?.dataPaths?.[by]

  if (pathRaw && pathRaw.length) {
    const resolved = resolveScopedTablePath({
      rawPath: pathRaw,
      scope: runtimeScope.value,
      rowIndex,
    })

    return Raph.get(resolved.path, { vars: resolved.vars })
  }

  const path = getStorePath()
  if (!path)
    return undefined
  const raw = safeGet(path)
  const arr: any[] = Array.isArray(raw) ? raw : []
  const row = arr[rowIndex]
  if (!row)
    return undefined

  if (by.includes('.')) {
    return by.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), row)
  }

  return row[by]
}

const gridRef = ref(null)
const wrapRef = ref<HTMLDivElement | null>(null)

/** runtime -> meta */
const tableId = computed(() =>
  String(props.runtime?.node?.meta?.entityId ?? ''),
)
const basePath = computed(() =>
  String(runtimeScope.value.basePath ?? props.runtime?.node?.meta?.basePath ?? ''),
)

/** model */
const tableModel = computed<RComponentTable | null>(() => {
  if (!tableId.value)
    return null
  return (Endge.domain.getComponent(tableId.value) as RComponentTable) ?? null
})

//
// ZOOM
//
const ROW_BASE_HEIGHT: Record<string, number> = {
  'zoom-50': 25,
  'zoom-75': 30,
  'zoom-100': 40,
  'zoom-125': 40,
  'zoom-150': 45,
}

const rowSize = computed(() => {
  // const m = tableModel.value
  // if (m) {
  //   return m.rowSizeCalc === 'zoom' ? 40 : m.rowSizeCalc
  // }

  //
  // AUTO ZOOM LOGIC
  //
  const zoom = ui.value.zoomClass
  const base = ROW_BASE_HEIGHT[zoom] ?? 40
  return base
})

/** bindings -> sourceVar */
const sourceVar = computed(() => {
  const m = tableModel.value
  if (!m)
    return ''
  const keys = (m as any).bindings?.keys ?? {}
  const firstKey = Object.keys(keys)[0] // обычно "items"
  return firstKey || m.inputFields?.[m.sourceIndex]?.name || ''
})

/** utils */
function safeGet(path: string): any {
  return Raph.get(path)
}

function refreshSource(reason = 'manual'): void {
  const path = getStorePath()
  if (!path)
    return

  const v = safeGet(path)

  console.groupCollapsed(`[TableRenderer] refreshSource (${reason})`)
  try {
    console.log('runtime.id', props.runtime?.id)
    console.log('tableId', tableId.value)
    console.log('scope', runtimeScope.value)
    console.log('sourceVar', sourceVar.value)
    console.log('path', path)
    console.log('isArray', Array.isArray(v))
    console.log('len', Array.isArray(v) ? v.length : '-')
    if (Array.isArray(v))
      console.log('preview[0..1]', v.slice(0, 2))
  }
  finally {
    console.groupEnd()
  }

  const arr: any[] = Array.isArray(v) ? v : []

  source.value = arr
    .map((item, i) => {
      const rowId = String(item?.rowId ?? item?.id ?? `r${i}`)
      return { ...item, rowId }
    })
  revo.notifyDataChanged()
}

/** columns */
const columns = computed(() => {
  const m = tableModel.value
  if (!m)
    return []

  return m.columns
    .filter(x => x.isActive)
    .map((column: RComponentTableColumn, index: number) => {
      if (RComponentTableColumn_isHtml(column))
        return null

      const emitColumnEvent = (eventName: string, event: Event, cellProps: any) => {
        const selectedRowIds: Set<string> = new Set(revo.getSelectedRowIds())

        const fallbackRowId: string = String(cellProps?.model?.rowId ?? cellProps?.model?.id ?? '').trim()
        if (selectedRowIds.size === 0 && fallbackRowId) {
          selectedRowIds.add(fallbackRowId)
        }

        const rows = source.value.filter((item) => {
          const rowId: string = String(item?.rowId ?? item?.id ?? '').trim()
          return rowId ? selectedRowIds.has(rowId) : false
        })

        if (!rows.length && cellProps?.model) {
          rows.push(cellProps.model)
        }

        props.runtime.emit(`table-column:${eventName}` as any, {
          event,

          // колонка
          column,
          columnIndex: index,

          // строка
          rowIndex: cellProps.rowIndex,
          // row: source.value?.[cellProps.rowIndex],
          row: cellProps.model,
          rows,
        })
      }

      //
      // Persistance настройки
      const columnSettings = revo.getColumnSettingsByIndex(index)

      let size = columnSettings?.width || (Number.isFinite(Number((column as any).width))
        ? Number((column as any).width)
        : 150)
      if (size <= 20) {
        size = 20
      }

      //
      // Mock
      const pinned = false

      //
      // СОРТИРОВКИ
      const columnId = String((column as any).id)
      const isSortable = (column as any).sort != null

      const meta = revo.sort.getMeta(columnId)
      const sortEnabled = isSortable && meta.enabled
      const sortOrder = sortEnabled ? meta.order : undefined
      const sortIndex = sortEnabled ? meta.index : undefined

      //
      //
      return {
        prop: (column as any).id,
        name: (column as any).title,

        autoSize: true,
        size,
        pin:
          (column as any).pin === 'left'
            ? 'colPinStart'
            : (column as any).pin === 'right'
                ? 'colPinEnd'
                : undefined,

        //
        // Сортировки revogrid отключаем (управляем этим сами)
        sortable: undefined,
        order: undefined,
        cellCompare: undefined,

        //
        // Шаблон
        columnTemplate: VGridVueTemplate(ComponentType_Table_ColumnHeader, {
          entity: column,
          hasFilters: false,
          isPinned: (column as any).pin?.length && (column as any).pin !== 'none' && (column as any).pin != null && (column as any).pin !== undefined,
          hasActiveFilters: false,

          //
          // Реальная сортировка управляется нашим шаблоном (в entity все данные)
          isSortable,
          sortEnabled,
          sortOrder,
          sortIndex,
          onSortClick: (e?: MouseEvent) => revo.sort.toggle(columnId, e?.shiftKey),
        }),

        cellTemplate: (h: any, cellProps: any) => {
          return ComponentType_TableCell(h, {
            basePath: `${basePath.value}`,
            scope: runtimeScope.value,
            table: m,
            column,
            rowIndex: cellProps.rowIndex,
            row: cellProps.model,
          })
        },

        cellProperties: (cellProps: any) => {
          const rowId = String(cellProps.model?.rowId ?? `r${cellProps.rowIndex}`)

          return {
            'row-id': rowId,
            'cell-id': `${rowId}-${index}-np`,

            'onClick': (e: MouseEvent) => emitColumnEvent('click', e, cellProps),
            'onDblClick': (e: MouseEvent) => emitColumnEvent('dblclick', e, cellProps),
            'onContextMenu': (e: MouseEvent) => emitColumnEvent('contextmenu', e, cellProps),
            'onMouseDown': (e: MouseEvent) => emitColumnEvent('mousedown', e, cellProps),
            'onMouseUp': (e: MouseEvent) => emitColumnEvent('mouseup', e, cellProps),
          }
        },
      }
    })
    .filter(Boolean)
})

/** runtime subs */
type Unsub = () => void
const unsubs = ref<Unsub[]>([])

function cleanupSubs(): void {
  for (const fn of unsubs.value) fn()
  unsubs.value = []
}

function sub(event: string, handler: (payload: any) => void): void {
  const cb = (payload: any) => handler(payload)
  props.runtime.on(event as any, cb as any)
  unsubs.value.push(() => props.runtime.off(event as any, cb as any))
}

function applyCellUpdates(data: any): void {
  if (!gridRef.value?.$el) {
    return
  }

  const m = tableModel.value
  if (!m) {
    return
  }

  const resolvedSourceVar
    = m.inputFields[m.sourceIndex]?.name || sourceVar.value || 'items'
  const pk = (m as any).bindings?.keys?.[resolvedSourceVar]?.pk || 'id'
  const itemsPath = getStorePath()

  const getStoreArray = (name: string) =>
    name === resolvedSourceVar && itemsPath
      ? (Raph.get(itemsPath) as any[]) ?? []
      : []

  const findRowIndexByPk = (pkValue: unknown): number => {
    const rows = getStoreArray(resolvedSourceVar)
    if (!Array.isArray(rows))
      return -1
    return rows.findIndex(row => row && row[pk] === pkValue)
  }

  const tryRead = (pathOrValue: unknown): unknown => {
    if (
      typeof pathOrValue === 'string'
      && (
        pathOrValue.startsWith('$')
        || pathOrValue.startsWith('@')
      )
    ) {
      try {
        const resolved = resolveScopedTablePath({
          rawPath: pathOrValue,
          scope: runtimeScope.value,
        })
        return Raph.get(resolved.path, { vars: resolved.vars })
      }
      catch {
        return undefined
      }
    }

    return pathOrValue
  }

  const resolveRowIndexFromEvent = (event: any): number => {
    const resolved: Array<{
      segment: string
      keyField?: string
      keyValue?: unknown
      index?: number
    }> = event?.resolved ?? []

    for (const segment of resolved) {
      if (segment.keyValue == null) {
        continue
      }

      const pkValue = tryRead(segment.keyValue)
      if (pkValue === undefined) {
        continue
      }

      const rowIndex = findRowIndexByPk(pkValue)
      if (rowIndex !== -1) {
        return rowIndex
      }
    }

    const primarySegment = resolved.find(
      segment =>
        segment.segment === resolvedSourceVar
        && typeof segment.index === 'number',
    )

    return typeof primarySegment?.index === 'number'
      ? primarySegment.index
      : -1
  }

  const shouldUpdate = new Map<number, Set<number>>()

  for (const child of data?.children ?? []) {
    const colIndex = Number(child?.node?.meta?.columnIndex ?? -1)
    const columnId = String(child?.node?.meta?.columnId ?? '')
    if (colIndex < 0) {
      continue
    }

    let rows = shouldUpdate.get(colIndex)
    if (!rows) {
      rows = new Set<number>()
      shouldUpdate.set(colIndex, rows)
    }

    for (const event of child?.events ?? []) {
      const rowIndex = resolveRowIndexFromEvent(event)
      if (rowIndex >= 0) {
        rows.add(rowIndex)
        console.log('[TableRenderer] resolve cell update', {
          runtimeId: props.runtime?.id,
          columnId,
          columnIndex: colIndex,
          rowIndex,
          canonical: event?.canonical,
        })
      }
    }
  }

  for (const [colIndex, rowIndexes] of shouldUpdate.entries()) {
    for (const rowIndex of rowIndexes) {
      console.log('[TableRenderer] setDataAt', {
        runtimeId: props.runtime?.id,
        rowIndex,
        colIndex,
      })

      gridRef.value.$el.setDataAt({
        row: rowIndex,
        col: colIndex,
        rowType: 'rgRow',
        colType: 'rgCol',
        val: null,
      })
    }
  }
}

function setupSubs(): void {
  cleanupSubs()

  sub('update:root', (p: any) => {
    if (!gridRef.value?.$el) {
      return
    }

    // p может содержать events/meta - ты их прокинул в фазе
    console.log('[TableRenderer] event update:root', {
      eventsLen: p?.events?.length ?? 0,
      canonicals: (p?.events ?? []).map((e: any) => e?.canonical),
    })
    refreshSource('update:root')
    gridRef.value!.$el.refresh()
  })

  sub('update:cells', (payload: any) => {
    console.log('[TableRenderer] event update:cells', {
      childrenLen: payload?.children?.length ?? 0,
    })

    applyCellUpdates(payload)
  })

  //
  // sub('table-column:click', (p: any) =>
  //   console.log('[TableRenderer] table-column:click', p),
  // )
}

function selectAllRows(): void {
  revo.selectRows(
    source.value.map(row => String(row?.rowId ?? row?.id ?? '').trim()),
  )
}

function setGridHeightFromWrap(): void {
  const el = wrapRef.value
  if (!el)
    return

  const h = Math.floor(el.getBoundingClientRect().height)
  gridHeightPx.value = Math.max(0, h)

  nextTick(() => {
    try {
      gridRef.value?.$el?.refresh?.()
    }
    catch {}
  })
}

const gridStyle = computed<Record<string, string>>(() => {
  const h = gridHeightPx.value
  const styles = {
    height: h > 0 ? `${h}px` : '0px',
    width: '100%',
  }

  return styles
})

//
// STATUS BAR
//
type OnlineStatus = 'online' | 'offline'
interface TableStatusData {
  title: string
  displayed: number
  total: number
  selectedRow?: number | null
  online?: {
    status: OnlineStatus
    text: string
    tooltip?: string
  }
}

const statusData = computed<TableStatusData>(() => ({
  title: 'Основная таблица',
  displayed: source.value.length,
  total: source.value.length,
  selectedRow: revo.selectedRowIndex.value == null ? null : revo.selectedRowIndex.value + 1,
  online: {
    status: 'online',
    text: 'online',
    tooltip: '',
  },
}))

function getStorePath(): string | null {
  const scopedItemsPath = getRuntimeScopeItemsPath(runtimeScope.value)
  if (scopedItemsPath) {
    return scopedItemsPath
  }

  if (!basePath.value || !sourceVar.value)
    return null

  return `${basePath.value}.${sourceVar.value}`
}

function applyExternalSort(): void {
  console.log('[applyExternalSort]')
  console.log(revo.sort.state.value)

  const path = getStorePath()
  if (!path)
    return

  const raw = safeGet(path)
  const arr: any[] = Array.isArray(raw) ? raw : []

  // если правил нет - ничего не делаем (или верни дефолт как хочешь)
  if (revo.sort.state.value.length === 0) {
    // сброс: возвращаем порядок как он сейчас в сторе (или как приходит из backend)
    Raph.set(path, arr)
    return
  }

  const rules = revo.sort.state.value
    .map((r) => {
      const by = getSortBy(r.columnId)
      if (!by) {
        console.log('[TableV2 sort] правило без sort.by - пропускаем колонку', {
          columnId: r.columnId,
          rawRule: r,
        })
        return null
      }
      return { ...r, by }
    })
    .filter(Boolean) as Array<{ columnId: string, type: string, order: string, by: string }>

  console.log('[TableV2 sort] построенные правила', {
    path,
    state: revo.sort.state.value,
    rules,
  })

  if (rules.length === 0) {
    console.log('[TableV2 sort] rules пустой, сортировку не применяем', {
      path,
      state: revo.sort.state.value,
    })
    return
  }

  let loggedFirstRow = false
  const indexMap = new Map<any, number>()
  arr.forEach((row, i) => {
    indexMap.set(row, i)
  })
  const sorted = [...arr].sort((a, b) => {
    const idxA = indexMap.get(a) ?? -1
    const idxB = indexMap.get(b) ?? -1
    for (const rule of rules) {
      const valA = getRowValueBy(idxA, rule.columnId, rule.by)
      const valB = getRowValueBy(idxB, rule.columnId, rule.by)
      if (!loggedFirstRow && idxA === 0) {
        console.log('[TableV2 sort] сравнение для первой строки:', { by: rule.by, type: rule.type, order: rule.order, valA, valB })
        loggedFirstRow = true
      }
      let cmp = compareByType(valA, valB, rule.type)
      if (rule.order === 'desc')
        cmp = -cmp
      if (cmp !== 0)
        return cmp
    }
    return 0
  })

  if (shallowSameOrderById(arr, sorted)) {
    console.log('[TableV2 sort] порядок не изменился (rowId совпадает), сортировку можно считать no-op', {
      path,
      rules,
    })
    return
  }

  console.log('[TableV2 sort] результат сортировки:', {
    path,
    rules,
    lengthBefore: arr.length,
    lengthAfter: sorted.length,
    sampleBefore: arr.slice(0, 10),
    sampleAfter: sorted.slice(0, 10),
  })

  Raph.set(path, sorted)
  refreshSource('sort')
}

function shallowSameOrderById(a: any[], b: any[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  // Сравниваем порядок по ссылкам на объекты, а не по id/rowId.
  // Если после сортировки на позиции i стоит другой объект, считаем порядок изменившимся.
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false
  }
  return true
}

//
// LIFECYCLE
//

onMounted(async () => {
  setGridHeightFromWrap()

  if (wrapRef.value) {
    ro = new ResizeObserver(() => {
      setGridHeightFromWrap()
    })
    ro.observe(wrapRef.value)
  }

  refreshSource('mounted')
  setupSubs()

  // Revo
  await nextTick()

  setTimeout(async () => {
    await revo.init({
      el: gridRef.value,
      tableId: tableModel.value?.id ?? '',
      sort: {
        resolveIndexByColumnId: (columnId: string): number | null => {
          const m = tableModel.value as any
          if (!m)
            return null

          const active = m.columns
            .filter((c: any) => c?.isActive)
            .filter((c: any) => !RComponentTableColumn_isHtml(c))

          const idx = active.findIndex((c: any) => String(c?.id) === String(columnId))
          return idx >= 0 ? idx : null
        },

        getColumnIdByIndex: (index: number): string | null => {
          const m = tableModel.value as any
          if (!m)
            return null

          const active = m.columns
            .filter((c: any) => c?.isActive)
            .filter((c: any) => !RComponentTableColumn_isHtml(c))

          const col = active[index]
          const id = String(col?.id ?? '').trim()
          return id.length ? id : null
        },

        getTypeByColumnId: (columnId: string): string => {
          const m = tableModel.value as any
          const col = (m?.columns ?? []).find((c: any) => String(c?.id) === String(columnId))
          return String(col?.sort?.type ?? 'String')
        },

        onChange: () => {
          // composable сам persist/restore,
          // компонент отвечает только за применение сортировки к данным
          applyExternalSort()
          nextTick(() => gridRef.value?.$el?.refresh?.())
        },
      },
    })
    gridRef.value!.$el.refresh()
  }, 100)
})

onBeforeUnmount(() => {
  if (ro) {
    ro.disconnect()
    ro = null
  }

  revo.destroy()
  cleanupSubs()
})

defineExpose({
  selectAllRows,
})

watch(
  () => props.runtime?.id,
  () => {
    refreshSource('runtime changed')
    gridRef.value!.$el.refresh()
    setupSubs()
  },
)

watch(
  () => `${getStorePath() ?? ''}::${sourceVar.value}`,
  () => {
    // если поменялся sourceVar (например keys обновились) - перезабрать source
    refreshSource('spec changed')
    gridRef.value!.$el.refresh()
  },
)
</script>

<template>
  <div ref="wrapRef" class="flex flex-col h-full w-full min-h-0 min-w-0">
    <RevoGrid
      :id="id"
      ref="gridRef"
      :style="gridStyle"
      :columns="columns"
      :source="source"
      :row-size="rowSize"
      :class="`endge-table ${ui.zoomClass} z-10 d-flex flex-column flex-1`"
      exporting
      theme="compact"
      resize
      row-class="rowId"
      :range="false"
      readonly
      :use-autofill="false"
      v-on="revo.eventBinding"
      @viewportscroll="
        e => {
          if (e.detail.coordinate !== previousScrollCoordinate && e.detail.coordinate >= 0) {
            revo.highlightSelection(null, 'scroll')
            previousScrollCoordinate = e.detail.coordinate
          }
        }
      "
    />

    <!-- STATUS BAR -->
    <div
      v-if="props.enabledStatusBar"
      class="shrink-0 border-t bg-background px-2 py-1"
      style="height: 28px;"
    >
      <ComponentType_Table_StatusBar :data="statusData" />
    </div>
  </div>
</template>
