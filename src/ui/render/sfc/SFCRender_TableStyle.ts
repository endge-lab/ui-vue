import type { SFCVueRenderContext } from '@/model/render/sfc/sfc-vue-render.type'

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

export function toRevoGridMarkerProps(attrs: SFCTableMarkerAttrs): Record<string, unknown> {
  return {
    ...attrs,
    class: Object.fromEntries(attrs.class.map(className => [className, true])),
  }
}

/** Marks vendor-owned DOM only; native CSS performs all selector matching. */
export function syncSFCTableDOMMarkers(grid: HTMLElement, markers: SFCTableMarkers): void {
  applyMarkerAttrs(grid, markers.grid)
  grid.querySelectorAll<HTMLElement>('revogr-header')
    .forEach(element => applyMarkerAttrs(element, markers.header))
  grid.querySelectorAll<HTMLElement>('revogr-data')
    .forEach((element) => {
      const rowType = element.getAttribute('type') ?? (element as HTMLElement & { type?: string }).type
      if (rowType === 'rgRow') {
        applyMarkerAttrs(element, markers.body)
      }
    })
  grid.querySelectorAll<HTMLElement>('.rgRow')
    .forEach(element => applyMarkerAttrs(
      element,
      element.classList.contains('groupingRow') ? markers.groupRow : markers.row,
    ))
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

function applyMarkerAttrs(element: HTMLElement, attrs: SFCTableMarkerAttrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') {
      for (const className of attrs.class) {
        element.classList.add(className)
      }
    }
    else if (value != null) {
      element.setAttribute(key, String(value))
    }
  }
}
