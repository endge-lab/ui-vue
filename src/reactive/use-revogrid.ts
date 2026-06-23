import type { Ref } from 'vue'

import { debounce } from 'lodash'
import { computed, reactive, ref } from 'vue'

import { useLocalStorageMap } from '@/tools/useLocalStorageMap'

export const SELECTED_CELL_CLASS = 'selected-cell'
export const SELECTED_ROW_CLASS = 'selected-row'
export const MULTI_SELECTED_ROW_CLASS = 'multi-selected-row'

export type HighlightStrategy = 'click' | 'scroll'

export interface UseRevoGridOptions {
  id: string
  runtimeId: string
  getOrderedRowIds?: () => string[]
}

export interface SelectedItem {
  model?: unknown | null
  col?: string | null
  row: string | null
  colEl?: Element | null
  rowEls: Array<Element>
  lastTime?: number
}

export type SortOrder = 'asc' | 'desc'
export interface SortRule { columnId: string, type: string, order: SortOrder }

export interface SortMeta {
  enabled: boolean
  order?: SortOrder
  index?: number
}

export interface ColumnSettings {
  width?: number
  pinned?: boolean
  pinnedSide?: 'left' | 'right'
  order?: 'asc' | 'desc'
  filter?: any
  locallyHidden?: boolean

  _updated?: number
  _index?: number
  /** Порядок в списке множественной сортировки (0, 1, 2…). */
  _sortIndex?: number
}

function resolveRevoEl(x: unknown): HTMLRevoGridElement | null {
  if (!x)
    return null

  // Vue component instance
  const maybeEl = (x as any).$el
  if (maybeEl)
    return maybeEl as HTMLRevoGridElement

  // Already the custom element
  return x as HTMLRevoGridElement
}

export function useRevoGrid(options: UseRevoGridOptions) {
  const id: string = options.id
  let loaded: boolean = false

  /**
   * Сортировки
   */
  let sortResolveIndexByColumnId: ((columnId: string) => number | null) | null = null
  let sortGetTypeByColumnId: ((columnId: string) => string) | null = null
  let sortGetColumnIdByIndex: ((index: number) => string | null) | null = null
  let sortOnChange: ((rules: Array<SortRule>) => void) | null = null
  /** Id таблицы для ключа хранилища сортировки (id, не identity). Задаётся в init(). */
  let sortTableId: string = ''
  const sortState = ref<Array<SortRule>>([])

  function emitSortChange(): void {
    if (sortOnChange) {
      sortOnChange([...sortState.value])
    }
  }

  function getSortMeta(columnId: string): SortMeta {
    const idx = sortState.value.findIndex(r => r.columnId === columnId)
    if (idx < 0)
      return { enabled: false }
    return { enabled: true, order: sortState.value[idx].order, index: idx }
  }

  function setSingleSort(columnId: string, order: SortOrder | null): void {
    if (!order) {
      sortState.value = []
      persistSortState()
      emitSortChange()
      return
    }
    const type = sortGetTypeByColumnId ? sortGetTypeByColumnId(columnId) : 'String'
    sortState.value = [{ columnId, type, order }]
    persistSortState()
    emitSortChange()
  }

  /** Ключ в хранилище сортировки: только id таблицы и колонки (не identity). */
  function sortStorageKey(columnId: string): string {
    return `${sortTableId || options.runtimeId}-${columnId}`
  }

  function getSortStoragePrefix(): string {
    return `${sortTableId || options.runtimeId}-`
  }

  /** Сохранить только включённые сортировки в отдельное хранилище (tableId-columnId). Отключённые колонки удаляются. */
  function persistSortState(): void {
    const prefix = getSortStoragePrefix()
    for (const key of Array.from(sortStorage.value.keys())) {
      if (key.startsWith(prefix))
        sortStorage.value.delete(key)
    }
    sortState.value.forEach((rule, sortIndex) => {
      sortStorage.value.set(sortStorageKey(rule.columnId), { order: rule.order, sortIndex })
    })
  }

  /** Добавить/обновить/удалить колонку в списке сортировок (Shift+клик). */
  function toggleSortAdditive(columnId: string): void {
    const current = sortState.value.find(r => r.columnId === columnId)
    const nextOrder: SortOrder | null = !current ? 'asc' : current.order === 'asc' ? 'desc' : null
    const type = sortGetTypeByColumnId ? sortGetTypeByColumnId(columnId) : 'String'

    if (nextOrder == null) {
      sortState.value = sortState.value.filter(r => r.columnId !== columnId)
    } else if (current) {
      sortState.value = sortState.value.map(r =>
        r.columnId === columnId ? { ...r, order: nextOrder } : r,
      )
    } else {
      sortState.value = [...sortState.value, { columnId, type, order: nextOrder }]
    }
    persistSortState()
    emitSortChange()
  }

  /** Обычный клик: цикл по колонке (asc → desc → выкл), остальные столбцы не трогаем. Shift+клик: сортировка только по этой колонке. */
  function toggleSort(columnId: string, shiftKey?: boolean): void {
    if (shiftKey) {
      const current = sortState.value.find(r => r.columnId === columnId)
      const next: SortOrder | null = !current ? 'asc' : current.order === 'asc' ? 'desc' : null
      setSingleSort(columnId, next)
      return
    }
    toggleSortAdditive(columnId)
  }

  function restoreSortFromStorage(): void {
    if (!sortGetTypeByColumnId)
      return

    const prefix = getSortStoragePrefix()
    const withOrder: Array<{ columnId: string, order: SortOrder, sortIndex: number }> = []

    for (const [key, value] of sortStorage.value.entries()) {
      if (!key.startsWith(prefix))
        continue
      const order = value?.order
      if (order !== 'asc' && order !== 'desc')
        continue
      const columnId = key.slice(prefix.length)
      if (!columnId)
        continue
      const sortIndex = Number(value?.sortIndex)
      withOrder.push({ columnId, order, sortIndex: Number.isFinite(sortIndex) ? sortIndex : 0 })
    }

    withOrder.sort((a, b) => a.sortIndex - b.sortIndex)
    const getType = sortGetTypeByColumnId ?? (() => 'String')
    sortState.value = withOrder.map(({ columnId, order }) => ({
      columnId,
      type: getType(columnId),
      order,
    }))
  }

  /**
   * Persistence
   */
  /**
   * localStorage: настройки колонок (ширина и т.д.), ключ = runtimeId-index.
   */
  const viewsColumnsSettings = useLocalStorageMap('endge-revogrid-settings') as Ref<Map<string, ColumnSettings>>

  /**
   * localStorage: только состояние сортировки. Ключ = tableId-columnId (id, не identity).
   * Хранятся только включённые колонки; при отключении ключ удаляется.
   */
  const sortStorage = useLocalStorageMap('endge-revogrid-sort') as Ref<Map<string, { order: SortOrder, sortIndex: number }>>

  function columnStorageId(colIndex: number | string): string {
    return `${options.runtimeId}-${colIndex}`
  }

  function getColumnSettingsByIndex(colIndex: number): ColumnSettings {
    return viewsColumnsSettings.value.get(columnStorageId(colIndex)) || {}
  }

  function getColumnsSettings(): Record<string, ColumnSettings> {
    const prefix = `${options.runtimeId}-`
    const r: Record<string, ColumnSettings> = {}

    for (const [key, value] of viewsColumnsSettings.value.entries()) {
      if (key.startsWith(prefix)) {
        r[key] = value
      }
    }

    return r
  }

  function updateColumnSettings(colIndex: number, data: Partial<ColumnSettings>): void {
    const key = columnStorageId(colIndex)
    const current: ColumnSettings = viewsColumnsSettings.value.get(key) || {}

    viewsColumnsSettings.value.set(key, {
      ...current,
      ...data,
      _updated: Date.now(),
      _index: colIndex,
    })
  }

  function resetColumnSettingField(fieldKey: keyof ColumnSettings): void {
    const prefix = `${options.runtimeId}-`

    for (const [key, value] of viewsColumnsSettings.value.entries()) {
      if (key.startsWith(prefix)) {
        viewsColumnsSettings.value.set(key, {
          ...value,
          [fieldKey]: undefined,
          _updated: Date.now(),
        })
      }
    }
  }

  function resetToDefault(): void {
    resetSelection()

    const prefix = `${options.runtimeId}-`
    const keysToDelete: Array<string> = []

    for (const [key] of viewsColumnsSettings.value.entries()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      viewsColumnsSettings.value.delete(key)
    }
  }

  /**
  /**
   * Храним ТОЛЬКО DOM-элемент, который явно bind
   */
  const el = ref<HTMLRevoGridElement | null>(null)

  function bindTableEl(input: unknown): void {
    el.value = resolveRevoEl(input)
  }

  function getTableEl(): HTMLRevoGridElement | null {
    return el.value
  }

  /**
   * Данные о текущем выделенном элементе.
   */
  const selectedItem = reactive<SelectedItem>({
    model: null,
    col: null,
    row: null,
    colEl: null,
    rowEls: [],
    lastTime: 0,
  })

  const multiSelectedItems = reactive<Array<SelectedItem>>([])
  const selectionAnchorRow = ref<string | null>(null)

  const selectedRowIndex = computed<number | null>(() => null)

  function getSelectedRowIds(): string[] {
    return [...new Set(
      [
        String(selectedItem.row ?? '').trim(),
        ...multiSelectedItems.map(item => String(item?.row ?? '').trim()),
      ].filter(Boolean),
    )]
  }

  function resolveOrderedRowIds(): string[] {
    return [...new Set(
      (options.getOrderedRowIds?.() ?? [])
        .map(rowId => String(rowId ?? '').trim())
        .filter(Boolean),
    )]
  }

  function resolveRangeRowIds(startRowId: string, endRowId: string): string[] {
    const orderedRowIds: string[] = resolveOrderedRowIds()
    if (orderedRowIds.length === 0) {
      return [...new Set([startRowId, endRowId].filter(Boolean))]
    }

    const startIndex: number = orderedRowIds.indexOf(startRowId)
    const endIndex: number = orderedRowIds.indexOf(endRowId)
    if (startIndex < 0 || endIndex < 0) {
      return [...new Set([startRowId, endRowId].filter(Boolean))]
    }

    const from: number = Math.min(startIndex, endIndex)
    const to: number = Math.max(startIndex, endIndex)
    return orderedRowIds.slice(from, to + 1)
  }

  /**
   * Задержкa выделения строки после скролла
   */
  const debouncedScrollHighlightSelection = debounce(() => {
    const tableEl = getTableEl()
    if (!tableEl)
      return

    if (!multiSelectedItems.length) {
      const col = selectedItem.col
      const row = selectedItem.row

      if (row) {
        if (!selectedItem.rowEls.length) {
          selectedItem.rowEls = Array.from(tableEl.getElementsByClassName(row))
        }
        selectedItem.rowEls.forEach(x => x.classList.add(SELECTED_ROW_CLASS))
      }

      if (col) {
        if (!selectedItem.colEl) {
          selectedItem.colEl = tableEl.querySelector(`.rgCell[cell-id="${col}"]`)
        }
        selectedItem.colEl?.classList.add(SELECTED_CELL_CLASS)
      }
    }

    for (const item of multiSelectedItems) {
      if (!item.row)
        continue

      if (!item.rowEls.length) {
        item.rowEls = Array.from(tableEl.getElementsByClassName(item.row))
      }

      item.rowEls.forEach(x => x.classList.add(MULTI_SELECTED_ROW_CLASS))
    }
  }, 300)

  function clearSelection(option: 'default' | 'singleOnly' | 'multiOnly' = 'default'): void {
    if (option !== 'multiOnly') {
      selectedItem.colEl?.classList?.remove(SELECTED_CELL_CLASS)
      selectedItem.rowEls?.forEach?.(x => x.classList?.remove(SELECTED_ROW_CLASS))

      selectedItem.colEl = null
      selectedItem.rowEls = []
    }

    if (option !== 'singleOnly') {
      multiSelectedItems.forEach((item) => {
        item.rowEls?.forEach?.(x => x.classList?.remove(MULTI_SELECTED_ROW_CLASS))
        item.rowEls = []
      })
    }
  }

  function resetSelection(): void {
    clearSelection()
    selectedItem.colEl = null
    selectedItem.rowEls = []
    selectedItem.col = null
    selectedItem.row = null
    multiSelectedItems.length = 0
    selectionAnchorRow.value = null
  }

  function selectRows(rowIds: string[]): void {
    const tableEl = getTableEl()
    if (!tableEl) {
      return
    }

    resetSelection()

    const now: number = Date.now()
    const uniqueRowIds: string[] = [...new Set(
      rowIds
        .map(rowId => String(rowId ?? '').trim())
        .filter(Boolean),
    )]

    for (const row of uniqueRowIds) {
      const rowEls: Array<Element> = Array.from(tableEl.getElementsByClassName(row) || [])
      rowEls.forEach(x => x.classList.add(MULTI_SELECTED_ROW_CLASS))

      multiSelectedItems.push({
        row,
        rowEls,
        lastTime: now,
      })
    }

    selectionAnchorRow.value = uniqueRowIds[0] ?? null
  }

  function highlightSelection(event: Event | null, strategy: HighlightStrategy = 'click'): void {
    const tableEl = getTableEl()
    if (!tableEl)
      return

    const isCtrlPressed: boolean = event instanceof MouseEvent && (event.ctrlKey || event.metaKey)
    const isShiftPressed: boolean = event instanceof MouseEvent && event.shiftKey
    const isM1Pressed: boolean = event instanceof MouseEvent && event.button === 0

    const now: number = Date.now()

    if (strategy === 'click') {
      if (!isM1Pressed && multiSelectedItems.length > 0) {
        return
      }

      const cellEl: HTMLElement | null
        = ((event?.target as HTMLElement | null)?.closest?.('.rgCell') as HTMLElement | null) || null

      const col: string | null = cellEl?.getAttribute('cell-id') || null
      const row: string | null = cellEl?.getAttribute('row-id') || null

      if (col && row) {
        const rowEls: Array<Element> = Array.from(tableEl.getElementsByClassName(row) || [])

        // Повторное нажатие - проброс события дальше
        if (selectedItem.lastTime && selectedItem.col === col && now - selectedItem.lastTime >= 400 && !isCtrlPressed && !isShiftPressed) {
          return
        }

        clearSelection('singleOnly')

        if (isShiftPressed && isM1Pressed) {
          const anchorRowId: string = String(selectionAnchorRow.value ?? selectedItem.row ?? row).trim()
          const rangeRowIds: string[] = resolveRangeRowIds(anchorRowId, row)
          const nextRowIds: string[] = isCtrlPressed
            ? [...new Set([...getSelectedRowIds(), ...rangeRowIds])]
            : rangeRowIds

          selectRows(nextRowIds)

          selectedItem.col = col
          selectedItem.row = row
          selectedItem.colEl = cellEl
          selectedItem.rowEls = rowEls
          selectedItem.lastTime = now
          selectionAnchorRow.value = anchorRowId || row
        }
        else if (!isCtrlPressed) {
          clearSelection('multiOnly')
          multiSelectedItems.length = 0

          cellEl?.classList.add(SELECTED_CELL_CLASS)
          rowEls.forEach(x => x.classList.add(SELECTED_ROW_CLASS))

          selectedItem.col = col
          selectedItem.row = row
          selectedItem.colEl = cellEl
          selectedItem.rowEls = rowEls
          selectedItem.lastTime = now
          selectionAnchorRow.value = row
        }
        else if (isM1Pressed) {
          const existingItemIndex: number = multiSelectedItems.findIndex(item => item.row === row)

          if (existingItemIndex >= 0) {
            const existingItem = multiSelectedItems[existingItemIndex]
            existingItem.rowEls?.forEach(x => x.classList.remove(MULTI_SELECTED_ROW_CLASS))
            multiSelectedItems.splice(existingItemIndex, 1)
          }
          else {
            rowEls.forEach(x => x.classList.add(MULTI_SELECTED_ROW_CLASS))

            const newMultiSelectedItem: SelectedItem = {
              row,
              rowEls,
              lastTime: now,
            }

            multiSelectedItems.push(newMultiSelectedItem)
          }

          selectedItem.col = col
          selectedItem.row = row
          selectedItem.colEl = cellEl
          selectedItem.rowEls = rowEls
          selectedItem.lastTime = now
          selectionAnchorRow.value = row
        }
      }
    }
    else {
      clearSelection()
      debouncedScrollHighlightSelection()
    }
  }

  function syncSelectionAfterDataChange(): void {
    // 1) если ничего не выделено - только подчистим подсветку (на всякий)
    const hasAnySelection: boolean = Boolean(selectedItem.row) || multiSelectedItems.length > 0

    // всегда очищаем текущие классы (DOM мог переиспользоваться)
    clearSelection()

    if (!hasAnySelection)
      return

    // 2) заново “подсветить” по сохранённым row/col
    // стратегия scroll использует debouncedScrollHighlightSelection,
    // который пере-вытащит rowEls/colEl через DOM
    highlightSelection(null, 'scroll')
  }

  function globalContextHandler(event: Event): void {
    event?.preventDefault()
    highlightSelection(event, 'click')
  }

  async function init(initOpts: {
    el: any
    /** Id таблицы (компонента) для ключа хранилища сортировки - id, не identity. */
    tableId?: string
    sort?: {
      resolveIndexByColumnId: (columnId: string) => number | null
      getTypeByColumnId: (columnId: string) => string
      getColumnIdByIndex: (index: number) => string | null
      onChange: (rules: Array<SortRule>) => void
    }
  }): Promise<void> {
    sortTableId = initOpts.tableId ?? options.runtimeId
    bindTableEl(initOpts.el)

    const tableEl = getTableEl()
    if (!tableEl) {
      console.error('[useRevoGrid] bindTableEl() was not called (table element is missing)')
      return
    }

    tableEl.addEventListener('click', highlightSelection, true)
    tableEl.addEventListener('contextmenu', globalContextHandler, true)

    // sort DI
    sortResolveIndexByColumnId = initOpts.sort?.resolveIndexByColumnId ?? null
    sortGetTypeByColumnId = initOpts.sort?.getTypeByColumnId ?? null
    sortGetColumnIdByIndex = initOpts.sort?.getColumnIdByIndex ?? null
    sortOnChange = initOpts.sort?.onChange ?? null

    // restore sort from storage once
    restoreSortFromStorage()
    emitSortChange()

    loaded = true
  }

  function destroy(): void {
    const tableEl = getTableEl()
    if (!tableEl) {
      loaded = false
      return
    }

    tableEl.removeEventListener('click', highlightSelection, true)
    tableEl.removeEventListener('contextmenu', globalContextHandler, true)

    loaded = false
  }

  function beforesortingapply(
    e: Event & {
      detail: {
        column: { prop: string }
        order: string
        additive: boolean
      }
    },
  ): void {
    e.preventDefault()
    //
    // const prop = e?.detail?.column?.prop
    // const order = e?.detail?.order
    //
    // if (!prop || !order)
    //   return
    //
    // // применяем сортировку к нашему source
    // applySortToExternalSource(prop, order)
    //
    // // после перестановки строк сбрасываем выделение, иначе реиспользуемые DOM строки подсветятся неверно
    // resetSelection?.()
  }

  function aftercolumnresize(
    e: Event & {
      detail: Record<string, { size: number, prop: string }>
    },
  ): void {
    setTimeout(() => {
      highlightSelection(e, 'scroll')

      const keys: Array<string> = Object.keys(e.detail || {})
      const firstKey: string | undefined = keys[0]
      if (!firstKey)
        return

      const payload = e.detail[firstKey]
      if (!payload)
        return

      const size: number = Number(payload.size || 0)
      if (!Number.isFinite(size))
        return

      const colIndex: number = Number(firstKey)
      if (!Number.isFinite(colIndex))
        return

      updateColumnSettings(colIndex, { width: size })
    }, 1)
  }

  const notifyDataChanged = debounce((): void => {
    // 1) пересортировать (если нужно)
    if (sortState.value.length > 0) {
      emitSortChange()
    }

    // 2) пересинхронизировать подсветку
    syncSelectionAfterDataChange()
  }, 0)

  return {
    id,
    bindTableEl,
    loaded: computed<boolean>(() => loaded),

    notifyDataChanged,

    // persistence
    getColumnSettingsByIndex,
    updateColumnSettings,
    resetColumnSettingField,
    getColumnsSettings,
    resetToDefault,

    // sort
    sort: {
      state: computed<Array<SortRule>>(() => sortState.value),
      getMeta: getSortMeta,
      toggle: toggleSort,
      setSingle: setSingleSort,
      restore: restoreSortFromStorage,
    },

    // selection
    selectedItem,
    multiSelectedItems,
    getSelectedRowIds,
    selectedRowIndex,
    selectRows,
    highlightSelection,
    clearSelection,
    resetSelection,

    // lifecycle
    init,
    destroy,

    // Проброс событий
    eventBinding: {
      beforesortingapply,
      // beforefilterapply,
      aftercolumnresize,
      // beforegridrender,
      // aftergridrender,
      // afteranysource,
      // beforefiltertrimmed,
    },
  }
}
