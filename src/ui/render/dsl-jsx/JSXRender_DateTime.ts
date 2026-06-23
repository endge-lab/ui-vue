import type { VNode } from 'vue'
import { parseISO } from 'date-fns'
import { format as formatDate, utcToZonedTime } from 'date-fns-tz'
import { JSXRender_Base } from '@/ui/render/dsl-jsx/JSXRender_Base'
import type { JSXComponentProps } from '@endge/core'
import { createPropApplier, coerceString } from '../helpers//props-mapper'

/**
 * @module JSXRender_DateTime
 *
 * JSX-компонент <DateTime>: форматирует входную дату в указанной таймзоне и формате.
 *
 * Поддерживаемые пропсы (статические и динамические `v-bind`):
 *  - value:    string | Date | number - источник даты (ISO, timestamp, Date, либо парсибельная строка)
 *  - timezone: string - IANA-таймзона (например, "Europe/Moscow"), по умолчанию "UTC"
 *  - format:   string - шаблон формата date-fns (например, "dd MMM yyyy, HH:mm"), по умолчанию "yyyy-MM-dd HH:mm"
 *
 * Примеры:
 *  <DateTime value="2024-10-01T12:00:00Z" format="dd.MM.yyyy HH:mm" timezone="Europe/Helsinki" />
 *  <DateTime :value="row.createdAt" :format="fmt" :timezone="user.tz" />
 *  <DateTime :="{ value: item.ts, format: 'HH:mm', timezone: 'UTC' }" />
 */

/** Внутренняя целевая структура, куда маппятся пропсы */
type DateTimeTarget = {
  value?: unknown
  timezone?: string
  format?: string
}

/** Спецификация пропсов для DateTime */
const DateTimeSpec = {
  value: {
    // value поддерживает любые типы, коэрс не навязываем
    apply: (v: unknown, t: DateTimeTarget) => {
      t.value = v
    },
  },
  timezone: {
    coerce: coerceString,
    apply: (v: string | undefined, t: DateTimeTarget) => {
      if (v) t.timezone = v
    },
  },
  format: {
    coerce: coerceString,
    apply: (v: string | undefined, t: DateTimeTarget) => {
      if (v) t.format = v
    },
  },
} as const

const applyDateTimeProps = createPropApplier<DateTimeTarget>(DateTimeSpec)

/** Надёжное приведение к Date:
 *  - Date -> как есть
 *  - number -> new Date(number)
 *  - string -> сначала parseISO, если невалидно - new Date(s)
 */
function toDate(input: unknown): Date | null {
  if (input == null) return null
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input
  }
  if (typeof input === 'number') {
    const d = new Date(input)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof input === 'string') {
    // пробуем ISO
    let d = parseISO(input)
    if (!isNaN(d.getTime())) return d
    // fallback на Date(...)
    d = new Date(input)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

const fn = (h: (...args: any[]) => VNode, props: JSXComponentProps): VNode => {
  // Значения по умолчанию
  const target: DateTimeTarget = {
    timezone: 'UTC',
    format: 'yyyy-MM-dd HH:mm',
  }

  // Применяем пропсы (статические и динамические)
  applyDateTimeProps(props.node.props as any, target, props)

  // Если value отсутствует - ничего не рендерим (пустой span для консистентности пайплайна)
  if (target.value == null || target.value === '') {
    return h('span', { ...props.handlers }, '')
  }

  // Преобразуем к дате
  const date = toDate(target.value)
  if (!date) {
    return h('span', { ...props.handlers }, '(invalid date)')
  }

  // Переводим в зону и форматируем
  let out = ''
  try {
    const zoned = utcToZonedTime(date, target.timezone!)
    out = formatDate(zoned, target.format!, { timeZone: target.timezone! })
  } catch (e) {
    console.warn('[DateTime]: Formatting error', e)
    out = '(invalid date)'
  }

  return h('span', { ...props.handlers }, out)
}

export default JSXRender_Base(fn)
