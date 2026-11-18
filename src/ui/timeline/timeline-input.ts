import type { TimelineChartMountConfig, TimelineGroupColumnInput, TimelineGroupInput } from '@nova-lab/timeline'

export interface TimelineViewportRange { start: number, end: number }
let generatedId = 0
export function nextTimelineId(): string {
  return `endge-sfc-timeline-${++generatedId}`
}
export const EMPTY_TIMELINE_DATA = Object.freeze({})

// A bare chart should show its first nonempty data even when it is outside today's window.
export function inferTimelineRange(data: NonNullable<TimelineChartMountConfig['data']>) {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  function include(timestamp: number): void {
    if (Number.isFinite(timestamp)) {
      start = Math.min(start, timestamp)
      end = Math.max(end, timestamp)
    }
  }
  for (const rows of [data.tasks, data.backgrounds]) {
    for (const row of rows ?? []) {
      include(row.startTime)
      include(row.endTime)
    }
  }
  for (const point of data.points ?? []) {
    include(point.time)
  }
  if (!Number.isFinite(start)) {
    return undefined
  }
  const padding = Math.max(60_000, (end - start) * 0.05)
  return { start: start - padding, end: end + padding, min: start - padding * 10, max: end + padding * 10 }
}

export function readTimelineRange(value: unknown): TimelineViewportRange | undefined {
  const range = value as Partial<TimelineViewportRange> | null
  if (typeof range?.start === 'number' && typeof range.end === 'number'
    && Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start) {
    return { start: range.start, end: range.end }
  }
  return undefined
}

export function sameTimelineRange(a: TimelineViewportRange | undefined, b: TimelineViewportRange | undefined): boolean {
  return a?.start === b?.start && a?.end === b?.end
}

export function timelinePixels(value: unknown, fallback: number, minimum = 1): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return fallback
  }
  const result = Number(typeof value === 'string' ? value.trim().replace(/px$/i, '') : value)
  return Number.isFinite(result) && result >= minimum ? result : fallback
}

export function mergeTimelineOptions(
  base: TimelineChartMountConfig['options'],
  override: unknown,
): NonNullable<TimelineChartMountConfig['options']> {
  if (override != null && !isTimelineRecord(override)) {
    throw new TypeError('Timeline options должны быть объектом.')
  }
  return mergeRecords(base ?? {}, override ?? {}) as NonNullable<TimelineChartMountConfig['options']>
}

function mergeRecords(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(override)])].map((key) => {
    const previous = base[key]
    const next = override[key]
    return [key, !Object.hasOwn(override, key)
      ? previous
      : isTimelineRecord(previous) && isTimelineRecord(next) ? mergeRecords(previous, next) : next]
  }))
}

export function isTimelineRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function readTimelineColumns(input: unknown): TimelineGroupColumnInput[] {
  if (!Array.isArray(input)) {
    throw new TypeError('Timeline columns должны быть массивом.')
  }
  const ids = new Set<string>()
  return input.map((column: unknown) => {
    if (!isTimelineRecord(column) || typeof column.id !== 'string' || !column.id.trim()
      || typeof column.field !== 'string' || !column.field.trim() || ids.has(column.id)) {
      throw new Error('Timeline column требует уникальный id и имя поля field.')
    }
    ids.add(column.id)
    const field = column.field
    const value = (group: TimelineGroupInput) => {
      const record = group as unknown as Record<string, unknown>
      return Object.hasOwn(record, field) ? record[field] : undefined
    }
    return {
      id: column.id,
      title: typeof column.title === 'string' ? column.title : field,
      width: timelinePixels(column.width, 160),
      sortable: column.sortable === true,
      data: group => String(value(group) ?? ''),
      value: (group) => {
        const raw = value(group)
        return typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string' ? raw : null
      },
    }
  })
}

export function readTimelineData(input: unknown): TimelineChartMountConfig['data'] {
  if (!isTimelineRecord(input)) {
    throw new TypeError('Timeline data должны быть объектом.')
  }
  for (const name of ['groups', 'tasks', 'points', 'links', 'backgrounds']) {
    if (input[name] != null && !Array.isArray(input[name])) {
      throw new TypeError(`Timeline data.${name} должны быть массивом.`)
    }
  }
  return input
}
