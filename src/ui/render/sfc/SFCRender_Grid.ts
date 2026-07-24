import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит renderer-neutral Grid через нативный CSS Grid. */
export const SFCRender_Grid: SFCVueRenderAdapterFunction = (input) => {
  const gap = normalizeLength(input.props.gap, 4)
  const columnGap = normalizeLength(input.props.columnGap, 4)
  const rowGap = normalizeLength(input.props.rowGap, 4)

  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-grid', input.props.class],
    style: {
      ...(input.attrs.style as Record<string, string> | undefined),
      display: 'grid',
      gridTemplateColumns: normalizeTracks(input.props.columns, 12),
      gridTemplateRows: normalizeOptionalTracks(input.props.rows),
      gridAutoRows: normalizeLength(input.props.autoRows),
      gridAutoFlow: normalizeAutoFlow(input.props.autoFlow),
      ...(gap ? { gap } : {}),
      ...(columnGap ? { columnGap } : {}),
      ...(rowGap ? { rowGap } : {}),
      alignItems: normalizeAlignment(input.props.align),
      justifyItems: normalizeAlignment(input.props.justify),
    },
  }, input.children)
}

function normalizeTracks(value: unknown, fallback: number): string {
  return normalizeOptionalTracks(value) ?? `repeat(${fallback}, minmax(0, 1fr))`
}

function normalizeOptionalTracks(value: unknown): string | undefined {
  if (value == null || value === false) return undefined
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return `repeat(${value}, minmax(0, 1fr))`
  }

  const source = String(value).trim()
  if (source === '') return undefined
  if (/^\d+$/.test(source) && Number(source) > 0) {
    return `repeat(${Number(source)}, minmax(0, 1fr))`
  }

  return source
}

function normalizeLength(value: unknown, numericUnit = 1): string | undefined {
  if (value == null || value === false) return undefined
  if (typeof value === 'number') return `${value * numericUnit}px`

  const source = String(value).trim()
  if (source === '') return undefined
  if (/^-?\d+(\.\d+)?$/.test(source)) return `${Number(source) * numericUnit}px`

  return source
}

function normalizeAutoFlow(value: unknown): string | undefined {
  const source = String(value ?? '').trim()
  return ['row', 'column', 'row dense', 'column dense'].includes(source)
    ? source
    : undefined
}

function normalizeAlignment(value: unknown): string | undefined {
  const source = String(value ?? '').trim()
  return ['start', 'center', 'end', 'stretch'].includes(source)
    ? source
    : undefined
}
