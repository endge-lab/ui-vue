import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит дату или время через базовые форматы SFC v1. */
export const SFCRender_DateTime: SFCVueRenderAdapterFunction = (input) => {
  const value = formatSFCDateTime(
    input.props.value,
    input.props.format,
    input.props.timezone,
    input.props.empty,
  )

  return input.h('time', {
    ...input.attrs,
    class: ['endge-sfc-datetime', input.props.class],
    datetime: input.props.value == null ? undefined : String(input.props.value),
  }, value)
}

/** Форматирует SFC DateTime в явно выбранной IANA-зоне или локальной зоне браузера. */
export function formatSFCDateTime(
  value: unknown,
  format: unknown,
  timezone: unknown,
  empty: unknown,
): string {
  if (value == null || value === '') return empty == null ? '' : String(empty)

  const text = String(value).trim()
  const timeOnly = format === 'HH:mm'
    ? text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
    : null
  if (timeOnly)
    return `${timeOnly[1]}:${timeOnly[2]}`

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return String(value)
  const timeZone = normalizeTimezone(timezone)

  if (format === 'HH:mm') {
    return formatInTimezone(date, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }, timeZone)
  }

  if (format === 'date') {
    return formatInTimezone(date, {}, timeZone)
  }

  return formatInTimezone(date, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }, timeZone)
}

function normalizeTimezone(value: unknown): string | undefined {
  const timezone = String(value ?? '').trim()
  return !timezone || timezone === 'local' ? undefined : timezone
}

function formatInTimezone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string | undefined,
): string {
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date)
  }
  catch {
    return new Intl.DateTimeFormat(undefined, options).format(date)
  }
}
