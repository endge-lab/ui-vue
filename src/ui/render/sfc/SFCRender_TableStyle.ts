import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'

export type SFCTablePublicPart
  = 'grid'
    | 'header'
    | 'header-cell'
    | 'header-content'
    | 'body'
    | 'row'
    | 'cell'
    | 'cell-content'
    | 'group-row'

export interface SFCTableMarkerAttrs extends Record<string, unknown> {
  'part': SFCTablePublicPart
  'data-endge-part': SFCTablePublicPart
  'class': string[]
}

export interface SFCTableMarkers {
  context: SFCVueRenderContext
  grid: SFCTableMarkerAttrs
  header: SFCTableMarkerAttrs
  body: SFCTableMarkerAttrs
  row: SFCTableMarkerAttrs
  groupRow: SFCTableMarkerAttrs
}

export interface SFCTableColumnMarkers {
  headerCell: SFCTableMarkerAttrs
  headerContent: SFCTableMarkerAttrs
  cell: SFCTableMarkerAttrs
  cellContent: SFCTableMarkerAttrs
}

export interface SFCTablePublicSurface {
  attrs: SFCTableMarkerAttrs
}

export interface SFCTableStyleContract {
  context: SFCVueRenderContext
  markers: SFCTableMarkers
  grid: SFCTablePublicSurface
  header: SFCTablePublicSurface
  body: SFCTablePublicSurface
  groupRow: SFCTablePublicSurface
}

export interface SFCTableColumnStyleSurfaces {
  headerCell: SFCTablePublicSurface
  headerContent: SFCTablePublicSurface
}

export interface SFCTableCellStyleSurfaces {
  cell: SFCTablePublicSurface
  cellContent: SFCTablePublicSurface
}

interface SFCTableRowStyleMeta {
  contract: SFCTableStyleContract
  columnMarkers: SFCTableColumnMarkers[]
  attrs: SFCTableMarkerAttrs
}

export const SFC_TABLE_ROW_CLASS_FIELD = '__endgeStyleRowClass'
const SFC_TABLE_ROW_STYLE_META = Symbol('endge.table.row-style-meta')

export function createSFCTableMarkers(context: SFCVueRenderContext): SFCTableMarkers {
  return {
    context,
    grid: createMarkerAttrs(context, 'grid'),
    header: createMarkerAttrs(context, 'header'),
    body: createMarkerAttrs(context, 'body'),
    row: createMarkerAttrs(context, 'row'),
    groupRow: createMarkerAttrs(context, 'group-row'),
  }
}

export function createSFCTableColumnMarkers(
  markers: SFCTableMarkers,
  columnCount: number,
): SFCTableColumnMarkers[] {
  return Array.from({ length: columnCount }, () => ({
    headerCell: createMarkerAttrs(markers.context, 'header-cell'),
    headerContent: createMarkerAttrs(markers.context, 'header-content'),
    cell: createMarkerAttrs(markers.context, 'cell'),
    cellContent: createMarkerAttrs(markers.context, 'cell-content'),
  }))
}

// Семантические DOM surfaces таблицы для renderer-ов без vendor DOM.
export function createSFCTableStyleContract(context: SFCVueRenderContext): SFCTableStyleContract {
  const markers = createSFCTableMarkers(context)
  return {
    context,
    markers,
    grid: { attrs: markers.grid },
    header: { attrs: markers.header },
    body: { attrs: markers.body },
    groupRow: { attrs: markers.groupRow },
  }
}

export function createSFCTableColumnStyleSurfaces(
  contract: SFCTableStyleContract,
  columnCount: number,
): SFCTableColumnStyleSurfaces[] {
  return createSFCTableColumnMarkers(contract.markers, columnCount).map(markers => ({
    headerCell: { attrs: markers.headerCell },
    headerContent: { attrs: markers.headerContent },
  }))
}

// Добавляет к видимому окну строк семантические attrs. Индексы строк оставляет
// браузеру: TanStack рендерит настоящие tr/td, поэтому native CSS selectors
// работают без runtime-generated классов.
export function decorateSFCTableRowWindow(
  rows: readonly Record<string, unknown>[],
  columnCount: number,
  contract: SFCTableStyleContract,
  _startIndex: number,
  _totalRowCount: number,
): Record<string, unknown>[] {
  const columnMarkers = createSFCTableColumnMarkers(contract.markers, columnCount)
  return rows.map((row) => {
    const decorated = {
      ...row,
      [SFC_TABLE_ROW_CLASS_FIELD]: contract.markers.row.class.join(' '),
    }
    Object.defineProperty(decorated, SFC_TABLE_ROW_STYLE_META, {
      configurable: false,
      enumerable: false,
      value: {
        contract,
        columnMarkers,
        attrs: contract.markers.row,
      } satisfies SFCTableRowStyleMeta,
      writable: false,
    })
    return decorated
  })
}

export function getSFCTableRowAttrs(
  row: Record<string, unknown>,
  states: Iterable<string> = [],
): SFCTableMarkerAttrs {
  const metadata = readRowStyleMeta(row)
  return withStates(metadata?.attrs ?? fallbackMarkerAttrs('row'), states)
}

export function getSFCTableCellStyleSurfaces(
  row: Record<string, unknown>,
  columnIndex: number,
  states: Iterable<string> = [],
): SFCTableCellStyleSurfaces | null {
  const metadata = readRowStyleMeta(row)
  const markers = metadata?.columnMarkers[columnIndex]
  if (!markers) {
    return null
  }
  return {
    cell: { attrs: withStates(markers.cell, states) },
    cellContent: { attrs: withStates(markers.cellContent, states) },
  }
}

function readRowStyleMeta(row: Record<string, unknown>): SFCTableRowStyleMeta | undefined {
  return (row as Record<PropertyKey, unknown>)[SFC_TABLE_ROW_STYLE_META] as SFCTableRowStyleMeta | undefined
}

function withStates(attrs: SFCTableMarkerAttrs, states: Iterable<string>): SFCTableMarkerAttrs {
  const nextStates = new Set<string>()
  const authoredStates = attrs['data-endge-state']
  if (typeof authoredStates === 'string') {
    authoredStates.split(/\s+/).filter(Boolean).forEach(state => nextStates.add(state))
  }
  for (const state of states) {
    if (state) {
      nextStates.add(state)
    }
  }
  return {
    ...attrs,
    ...(nextStates.size ? { 'data-endge-state': [...nextStates].join(' ') } : {}),
  }
}

function fallbackMarkerAttrs(part: SFCTablePublicPart): SFCTableMarkerAttrs {
  return { part, 'data-endge-part': part, 'class': [] }
}

function createMarkerAttrs(context: SFCVueRenderContext, part: SFCTablePublicPart): SFCTableMarkerAttrs {
  const host = context.styleParent
  const attrs: SFCTableMarkerAttrs = {
    part,
    'data-endge-part': part,
    'class': [...(host?.classes ?? [])],
    'data-endge-tag': host?.tag ?? 'Table',
  }
  appendAuthoredAttributes(attrs, host?.attributes)
  if (host?.id) {
    attrs['data-endge-id'] = host.id
  }
  if (host?.states.size) {
    attrs['data-endge-state'] = [...host.states].join(' ')
  }
  if (host?.component) {
    attrs['data-endge-component'] = host.component
  }
  if (host?.identity) {
    attrs['data-endge-identity'] = host.identity
  }
  const scopeId = host?.ownerScopeId ?? context.styleOwnerScopeId
  if (scopeId) {
    attrs['data-endge-scope'] = scopeId
  }
  if (context.runtimeScopeIds.length) {
    attrs['data-endge-runtime-scope'] = context.runtimeScopeIds.join(' ')
  }
  return attrs
}

function appendAuthoredAttributes(
  target: SFCTableMarkerAttrs,
  attributes: Record<string, unknown> | undefined,
): void {
  for (const [name, value] of Object.entries(attributes ?? {})) {
    if (
      ['class', 'style', 'part', 'id', 'state', 'component', 'identity', 'ref', 'key'].includes(name)
      || name.startsWith('on')
    ) {
      continue
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      target[name] = value
    }
  }
}
