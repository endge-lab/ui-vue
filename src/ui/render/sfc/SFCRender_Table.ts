import RevoGrid from '@revolist/vue3-datagrid'
import type { RComponentSFC_IR_ElementNode, RComponentSFC_IR_Node, RuntimeBoundaryPatch } from '@endge/core'
import type { PropType } from 'vue'
import { computed, defineComponent, h as vueH, inject, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import type {
  SFCVueRenderContext,
  SFCVueRenderFunction,
  SFCVueRenderH,
} from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCProps, evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'
import { SFCVueBoundaryRegistryKey } from '@/ui/render/sfc/SFCRender_BoundaryRegistry'

interface SFCTableColumn {
  key: string
  title: string
  width: number | null
  cellNodes: RComponentSFC_IR_Node[]
  rowDependencies: Set<string>
}

interface SFCRevoGridElement {
  source?: Record<string, unknown>[]
  refresh?: (type?: 'all' | string) => Promise<void> | void
  setDataAt?: (input: {
    row: number
    col: number
    rowType: 'rgRow'
    colType: 'rgCol'
    val?: unknown
    skipDataUpdate?: boolean
  }) => Promise<void | undefined> | void
}

interface SFCTableCellRenderInput {
  h: SFCVueRenderH
  column: SFCTableColumn
  cellProps: Record<string, unknown>
  rows: Record<string, unknown>[]
}

/** Рендерит SFC Table primitive через RevoGrid, не раскрывая RevoGrid в SFC-синтаксис. */
export const SFCRender_Table: SFCVueRenderFunction = SFCRender_Base((input) => {
  const rows = normalizeRows(input.props.rows)
  const rowKey = normalizeText(input.props['row-key'] ?? input.props.rowKey, 'id')
  const columns = collectTableColumns(input.node, input.context)
  const source = rows.map(row => normalizeRowSnapshot(row, rowKey))

  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-table', input.props.class],
    style: {
      ...(isPlainObject(input.attrs.style) ? input.attrs.style : {}),
      width: normalizeCssSize(input.props.width ?? input.props.w, '100%'),
      height: normalizeCssSize(input.props.height ?? input.props.h, '360px'),
      minHeight: '180px',
    },
  }, [
    input.h(SFCRevoGridTable as any, {
      boundaryId: input.node.id,
      columns,
      source,
      rowKey,
      rowSize: normalizeNumber(input.props.rowSize, 40),
      theme: normalizeText(input.props.theme, 'compact'),
      renderVersion: input.context.renderVersion,
      renderCell: (cellInput: SFCTableCellRenderInput) => {
        return renderTableCell({
          ...cellInput,
          fallbackH: input.h,
          context: input.context,
        })
      },
    }),
  ])
})

const SFCRevoGridTable = defineComponent({
  name: 'SFCRevoGridTable',
  props: {
    boundaryId: {
      type: String,
      required: true,
    },
    columns: {
      type: Array as PropType<SFCTableColumn[]>,
      required: true,
    },
    source: {
      type: Array as PropType<Record<string, unknown>[]>,
      required: true,
    },
    rowKey: {
      type: String,
      required: true,
    },
    rowSize: {
      type: Number,
      required: true,
    },
    theme: {
      type: String,
      required: true,
    },
    renderVersion: {
      type: Number,
      required: true,
    },
    renderCell: {
      type: Function as PropType<(input: SFCTableCellRenderInput) => ReturnType<SFCVueRenderH>>,
      required: true,
    },
  },
  setup(props) {
    const gridRef = ref<{ $el?: SFCRevoGridElement } | SFCRevoGridElement | null>(null)
    const boundaryRegistry = inject(SFCVueBoundaryRegistryKey, null)
    const currentSource = shallowRef(cloneRows(props.source))
    const previousSource = shallowRef(cloneRows(props.source))
    const previousColumnsSignature = shallowRef(createColumnsSignature(props.columns))

    const revoColumns = computed(() => props.columns.map((column, columnIndex) => {
      return createRevoColumn(column, columnIndex, (h, cellProps) => {
        return props.renderCell({
          h,
          column,
          cellProps,
          rows: currentSource.value,
        })
      })
    }))

    const unregisterBoundary = boundaryRegistry?.register(props.boundaryId, {
      applyPatch: applyRuntimePatch,
    })

    onBeforeUnmount(() => {
      unregisterBoundary?.()
    })

    watch(
      () => [props.renderVersion, props.source, props.columns] as const,
      async () => {
        const nextSource = cloneRows(props.source)
        currentSource.value = nextSource
        await nextTick()
        await updateGridCells({
          grid: resolveGridElement(gridRef.value),
          previousRows: previousSource.value,
          nextRows: nextSource,
          previousColumnsSignature: previousColumnsSignature.value,
          nextColumns: props.columns,
          rowKey: props.rowKey,
        })
        previousSource.value = cloneRows(nextSource)
        previousColumnsSignature.value = createColumnsSignature(props.columns)
      },
    )

    async function applyRuntimePatch(patch: RuntimeBoundaryPatch): Promise<boolean> {
      if (patch.kind !== 'collection-projection-update' || patch.boundaryId !== props.boundaryId)
        return false
      if (patch.itemIndex == null || patch.affectedProjections.length === 0)
        return false

      const nextSource = replaceRowSnapshot(
        currentSource.value,
        patch.itemIndex,
        patch.itemSnapshot,
        props.rowKey,
      )
      currentSource.value = nextSource
      await nextTick()

      const grid = resolveGridElement(gridRef.value)
      if (!grid)
        return false

      grid.source = nextSource

      for (const projection of patch.affectedProjections) {
        await grid.setDataAt?.({
          row: patch.itemIndex,
          col: projection.index,
          rowType: 'rgRow',
          colType: 'rgCol',
          val: nextSource[patch.itemIndex]?.[projection.key],
          skipDataUpdate: true,
        })
      }

      previousSource.value = cloneRows(nextSource)
      return true
    }

    return () => vueH(RevoGrid as any, {
      ref: gridRef,
      columns: revoColumns.value,
      source: currentSource.value,
      rowSize: props.rowSize,
      exporting: true,
      theme: props.theme,
      resize: true,
      range: false,
      readonly: true,
      useAutofill: false,
      style: 'height: 100%',
    })
  },
})

function collectTableColumns(
  tableNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
): SFCTableColumn[] {
  return tableNode.children
    .filter(isElementNode)
    .filter(node => node.tag === 'Column')
    .map((node, index) => createTableColumn(node, context, index))
}

function createTableColumn(
  columnNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  index: number,
): SFCTableColumn {
  const props = evaluateSFCProps(columnNode.props, context)
  const key = normalizeColumnKey(columnNode, context, props.key, `column_${index}`)

  return {
    key,
    title: normalizeText(props.title ?? props.name, key),
    width: normalizeOptionalNumber(props.width ?? props.size),
    cellNodes: resolveCellNodes(columnNode),
    rowDependencies: extractRowDependencies(resolveCellNodes(columnNode), key),
  }
}

function resolveCellNodes(columnNode: RComponentSFC_IR_ElementNode): RComponentSFC_IR_Node[] {
  const cell = columnNode.children
    .filter(isElementNode)
    .find(node => node.tag === 'Cell')

  return cell?.children ?? columnNode.children
}

function normalizeColumnKey(
  columnNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  propValue: unknown,
  fallback: string,
): string {
  const evaluated = propValue ?? evaluateSFCValue(columnNode.directives.key, context)
  if (evaluated != null)
    return normalizeText(evaluated, fallback)

  const directiveKey = columnNode.directives.key
  if (directiveKey?.kind === 'expression' && directiveKey.reads.length === 0)
    return normalizeText(directiveKey.source.replace(/^['"]|['"]$/g, ''), fallback)

  return fallback
}

function createRevoColumn(
  column: SFCTableColumn,
  columnIndex: number,
  renderCell: (h: SFCVueRenderH, cellProps: Record<string, unknown>) => ReturnType<SFCVueRenderH>,
): Record<string, unknown> {
  return {
    prop: column.key,
    name: column.title,
    __sfcColumnIndex: columnIndex,
    sortable: false,
    autoSize: column.width == null,
    size: column.width ?? 150,
    cellTemplate: (cellH: SFCVueRenderH, cellProps: Record<string, unknown>) => renderCell(cellH, cellProps),
  }
}

function renderTableCell(input: SFCTableCellRenderInput & {
  fallbackH: SFCVueRenderH
  context: SFCVueRenderContext
}): ReturnType<SFCVueRenderH> {
  const h = input.h ?? input.fallbackH
  const rowIndex = normalizeNumber(input.cellProps.rowIndex, 0)
  const row = normalizeCellRow(input.rows, input.cellProps, rowIndex)
  const cellContext = extendSFCVueRenderContext(input.context, {
    row,
    rowIndex,
    value: row[input.column.key],
  })
  const children = renderSFCNodes(h, input.column.cellNodes, cellContext)

  return h('div', {
    class: 'endge-sfc-table-cell',
    style: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      minWidth: 0,
    },
  }, children)
}

async function updateGridCells(input: {
  grid: SFCRevoGridElement | null
  previousRows: Record<string, unknown>[]
  nextRows: Record<string, unknown>[]
  previousColumnsSignature: string
  nextColumns: SFCTableColumn[]
  rowKey: string
}): Promise<void> {
  if (!input.grid)
    return

  input.grid.source = input.nextRows

  const nextColumnsSignature = createColumnsSignature(input.nextColumns)
  if (input.previousColumnsSignature !== nextColumnsSignature) {
    await input.grid.refresh?.('all')
    return
  }

  const changedRows = collectChangedRows(input.previousRows, input.nextRows, input.rowKey)
  if (!changedRows) {
    await input.grid.refresh?.('all')
    return
  }

  let updatedCells = 0
  for (const [rowIndex, changedFields] of changedRows.entries()) {
    for (let colIndex = 0; colIndex < input.nextColumns.length; colIndex++) {
      const column = input.nextColumns[colIndex]
      if (!shouldUpdateColumn(column, changedFields))
        continue

      updatedCells++
      await input.grid.setDataAt?.({
        row: rowIndex,
        col: colIndex,
        rowType: 'rgRow',
        colType: 'rgCol',
        val: input.nextRows[rowIndex]?.[column.key],
        skipDataUpdate: true,
      })
    }
  }

  if (updatedCells === 0 && changedRows.size > 0)
    await input.grid.refresh?.('all')
}

function collectChangedRows(
  previousRows: Record<string, unknown>[],
  nextRows: Record<string, unknown>[],
  rowKey: string,
): Map<number, Set<string>> | null {
  if (previousRows.length !== nextRows.length)
    return null

  const result = new Map<number, Set<string>>()
  for (let index = 0; index < nextRows.length; index++) {
    const previousRow = previousRows[index]
    const nextRow = nextRows[index]

    if (String(previousRow?.[rowKey] ?? index) !== String(nextRow?.[rowKey] ?? index))
      return null

    const changedFields = collectChangedFields(previousRow, nextRow)
    if (changedFields.size > 0)
      result.set(index, changedFields)
  }

  return result
}

function collectChangedFields(
  previousRow: Record<string, unknown>,
  nextRow: Record<string, unknown>,
): Set<string> {
  const keys = new Set([...Object.keys(previousRow), ...Object.keys(nextRow)])
  const result = new Set<string>()

  for (const key of keys) {
    if (!Object.is(previousRow[key], nextRow[key]))
      result.add(key)
  }

  return result
}

function shouldUpdateColumn(column: SFCTableColumn, changedFields: Set<string>): boolean {
  if (column.rowDependencies.size === 0)
    return changedFields.has(column.key)

  for (const dependency of column.rowDependencies) {
    if (changedFields.has(dependency))
      return true
  }

  return false
}

function extractRowDependencies(nodes: RComponentSFC_IR_Node[], columnKey: string): Set<string> {
  const result = new Set<string>()

  for (const node of nodes)
    collectRowDependencies(node, result, columnKey)

  return result
}

function collectRowDependencies(
  node: RComponentSFC_IR_Node,
  result: Set<string>,
  columnKey: string,
): void {
  if (node.kind === 'expression') {
    if (node.value.kind === 'expression')
      collectRowDependenciesFromSource(node.value.source, result, columnKey)
    return
  }

  if (node.kind !== 'element')
    return

  for (const value of Object.values(node.props)) {
    if (value.kind === 'expression')
      collectRowDependenciesFromSource(value.source, result, columnKey)
  }

  for (const value of [
    node.directives.if,
    node.directives.elseIf,
    node.directives.key,
    node.directives.for?.source,
  ]) {
    if (value?.kind === 'expression')
      collectRowDependenciesFromSource(value.source, result, columnKey)
  }

  for (const child of node.children)
    collectRowDependencies(child, result, columnKey)
}

function collectRowDependenciesFromSource(source: string, result: Set<string>, columnKey: string): void {
  const rowFieldPattern = /\brow\.([A-Za-z_$][\w$]*)/g
  let match: RegExpExecArray | null

  while ((match = rowFieldPattern.exec(source)))
    result.add(match[1])

  if (/\bvalue\b/.test(source))
    result.add(columnKey)
}

function createColumnsSignature(columns: SFCTableColumn[]): string {
  return columns
    .map(column => `${column.key}:${column.title}:${column.width ?? ''}`)
    .join('|')
}

function resolveGridElement(value: { $el?: SFCRevoGridElement } | SFCRevoGridElement | null): SFCRevoGridElement | null {
  if (!value)
    return null

  if ('$el' in value && value.$el)
    return value.$el

  if (isRevoGridElement(value))
    return value

  return null
}

function isRevoGridElement(value: unknown): value is SFCRevoGridElement {
  return isPlainObject(value)
    && (
      'refresh' in value
      || 'setDataAt' in value
      || 'source' in value
    )
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value))
    return []

  return value.map((item) => {
    return isPlainObject(item)
      ? { ...item }
      : { value: item }
  })
}

function cloneRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => ({ ...row }))
}

function replaceRowSnapshot(
  rows: Record<string, unknown>[],
  rowIndex: number,
  nextRow: unknown,
  rowKey: string,
): Record<string, unknown>[] {
  if (!isPlainObject(nextRow))
    return rows

  const result = cloneRows(rows)
  result[rowIndex] = normalizeRowSnapshot(nextRow, rowKey)
  return result
}

function normalizeRowSnapshot(row: Record<string, unknown>, rowKey: string): Record<string, unknown> {
  return {
    ...row,
    rowId: row[rowKey] == null ? String(row.__index ?? '') : String(row[rowKey]),
  }
}

function normalizeCellRow(
  rows: Record<string, unknown>[],
  cellProps: Record<string, unknown>,
  rowIndex: number,
): Record<string, unknown> {
  const row = rows[rowIndex] ?? cellProps.model ?? cellProps.row
  return isPlainObject(row) ? row : {}
}

function normalizeText(value: unknown, fallback: string): string {
  const source = String(value ?? '').trim()
  return source || fallback
}

function normalizeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value == null || value === '')
    return null

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeCssSize(value: unknown, fallback: string): string {
  if (value == null || value === '')
    return fallback

  if (typeof value === 'number')
    return `${value}px`

  const source = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(source))
    return `${Number(source)}px`

  return source
}

function isElementNode(node: RComponentSFC_IR_Node): node is RComponentSFC_IR_ElementNode {
  return node.kind === 'element'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
