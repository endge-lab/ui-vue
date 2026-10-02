import type { SFCVueRenderAdapterFunction } from '@/services/render/sfc/sfc-vue-render.type'

type DateTimeFormat = 'time' | 'date' | 'datetime'

const dateTimeFormatOptions: Record<DateTimeFormat, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit', hour12: false },
  date: {},
  datetime: { dateStyle: 'medium', timeStyle: 'short' },
}
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()
const MAX_CACHED_FORMATTERS = 32

// Рендерит дату или время через базовые форматы SFC v1.
export const SFCRender_DateTime: SFCVueRenderAdapterFunction = (input) => {
  const value = formatSFCDateTime(
    input.props.value,
    input.props.format,
    input.props.timezone,
    input.props.empty,
  )
  const compactEditor = normalizeEditorVariant(
    input.props.editorVariant ?? input.props['editor-variant'],
  ) === 'compact'

  return input.h('time', {
    ...input.attrs,
    class: [
      'endge-sfc-datetime',
      compactEditor && 'endge-sfc-datetime--compact',
      compactEditor && !value && 'endge-sfc-datetime--compact-empty',
      input.props.class,
    ],
    datetime: input.props.value == null ? undefined : String(input.props.value),
    ...(compactEditor ? { 'data-endge-editor-variant': 'compact' } : {}),
  }, value)
}

function normalizeEditorVariant(value: unknown): 'compact' | 'default' | null {
  return value === 'compact' || value === 'default' ? value : null
}

// Форматирует SFC DateTime в явно выбранной IANA-зоне или локальной зоне браузера.
export function formatSFCDateTime(
  value: unknown,
  format: unknown,
  timezone: unknown,
  empty: unknown,
): string {
  if (value == null || value === '') {
    return empty == null ? '' : String(empty)
  }

  const text = String(value).trim()
  const timeOnly = format === 'HH:mm'
    ? text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
    : null
  if (timeOnly) {
    return `${timeOnly[1]}:${timeOnly[2]}`
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  const timeZone = normalizeTimezone(timezone)

  if (format === 'HH:mm') {
    return formatInTimezone(date, 'time', timeZone)
  }

  if (format === 'date') {
    return formatInTimezone(date, 'date', timeZone)
  }

  return formatInTimezone(date, 'datetime', timeZone)
}

function normalizeTimezone(value: unknown): string | undefined {
  const timezone = String(value ?? '').trim()
  return !timezone || timezone === 'local' ? undefined : timezone
}

function formatInTimezone(
  date: Date,
  format: DateTimeFormat,
  timeZone: string | undefined,
): string {
  const options = dateTimeFormatOptions[format]
  if (!timeZone) {
    return new Intl.DateTimeFormat(undefined, options).format(date)
  }

  const key = `${format}:${timeZone}`
  let formatter = dateTimeFormatters.get(key)
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat(undefined, {
        ...options,
        timeZone,
      })
    }
    catch {
      return new Intl.DateTimeFormat(undefined, options).format(date)
    }

    if (dateTimeFormatters.size >= MAX_CACHED_FORMATTERS) {
      dateTimeFormatters.delete(dateTimeFormatters.keys().next().value!)
    }
    dateTimeFormatters.set(key, formatter)
  }

  return formatter.format(date)
}
