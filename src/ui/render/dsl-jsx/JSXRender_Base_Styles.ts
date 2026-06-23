import type { JSXRenderMiddlewareInput } from '@endge/core'
import type { VNode } from 'vue'
import { createPropApplier } from '../helpers/props-mapper'

/* ====================
 * Spacing (padding/margin)
 * ==================== */

/**
 * Коэрсер отступов:
 * - number -> `${n}rem`
 * - string без единиц -> `${val}rem`
 * - string с единицами (px|rem|em|%|vh|vw|ch|ex и т.п.) -> как есть
 * - null/undefined/пусто -> '1rem'
 */
function coerceSpace(v: unknown): string {
  if (v == null || v === '') return '1rem'
  if (typeof v === 'number' && !Number.isNaN(v)) return `${v}rem`
  const s = String(v).trim()
  if (!s) return '1rem'
  if (/[a-z%]+$/i.test(s)) return s
  if (/^-?\d+(\.\d+)?$/.test(s)) return `${s}rem`
  return s
}

/** Цель - объект style */
type StyleTarget = Record<string, string>

const BoxSpacingSpec = {
  // Padding
  p: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.padding = v),
  },
  px: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => {
      t.paddingLeft = v
      t.paddingRight = v
    },
  },
  py: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => {
      t.paddingTop = v
      t.paddingBottom = v
    },
  },
  pt: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.paddingTop = v),
  },
  pb: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.paddingBottom = v),
  },
  pl: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.paddingLeft = v),
  },
  pr: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.paddingRight = v),
  },

  // Margin
  m: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.margin = v),
  },
  mx: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => {
      t.marginLeft = v
      t.marginRight = v
    },
  },
  my: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => {
      t.marginTop = v
      t.marginBottom = v
    },
  },
  mt: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.marginTop = v),
  },
  mb: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.marginBottom = v),
  },
  ml: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.marginLeft = v),
  },
  mr: {
    coerce: coerceSpace,
    apply: (v: string, t: StyleTarget) => (t.marginRight = v),
  },
} as const

const applyBoxSpacingProps = createPropApplier<StyleTarget>(BoxSpacingSpec)

/* ====================
 * Borders
 * ==================== */

/** Стандартные стили рамок */
const BORDER_STYLES = new Set([
  'none',
  'hidden',
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
])

/** width: number -> px; строка без единиц -> px; иначе как есть */
function coerceBorderWidth(v: unknown): string {
  if (v == null || v === '') return '0'
  if (typeof v === 'number' && !Number.isNaN(v)) return `${v}px`
  const s = String(v).trim()
  if (!s) return '0'
  if (/^-?\d+(\.\d+)?$/.test(s)) return `${s}px`
  return s
}
function coerceBorderStyle(v: unknown): string {
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  return BORDER_STYLES.has(s) ? s : 'solid'
}
function coerceColor(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return String(v)
}

/** Парсинг шорткатов b/bx/by/bt/bb/bl/br
 * Поддерживает:
 *  - "1" -> 1px solid currentColor
 *  - "0.5rem" -> 0.5rem solid currentColor
 *  - "1 #ddd" -> 1px solid #ddd
 *  - "2 dashed #999" -> 2px dashed #999
 */
function parseBorderShorthand(input: unknown): {
  w: string
  s: string
  c?: string
} {
  if (input == null || input === '') return { w: '0', s: 'solid' }
  const raw = String(input).trim()
  if (!raw) return { w: '0', s: 'solid' }

  const parts = raw.split(/\s+/)
  // один токен -> ширина
  if (parts.length === 1) {
    return { w: coerceBorderWidth(parts[0]), s: 'solid' }
  }
  if (parts.length === 2) {
    const w = coerceBorderWidth(parts[0])
    const maybeStyle = parts[1].toLowerCase()
    if (BORDER_STYLES.has(maybeStyle)) {
      return { w, s: maybeStyle }
    }
    return { w, s: 'solid', c: parts[1] }
  }
  // 3+ токена -> width style color (остальные объединяем как цвет, на случай пробелов в var(...))
  const w = coerceBorderWidth(parts[0])
  const s = coerceBorderStyle(parts[1])
  const c = parts.slice(2).join(' ')
  return { w, s, c }
}

/** Установка рамки для стороны */
function setBorder(
  t: StyleTarget,
  side: 'all' | 'top' | 'right' | 'bottom' | 'left',
  sh: { w: string; s: string; c?: string },
) {
  const value = `${sh.w} ${sh.s}${sh.c ? ` ${sh.c}` : ''}`.trim()
  switch (side) {
    case 'all':
      t.border = value
      break
    case 'top':
      t.borderTop = value
      break
    case 'right':
      t.borderRight = value
      break
    case 'bottom':
      t.borderBottom = value
      break
    case 'left':
      t.borderLeft = value
      break
  }
}

/** Атомарные сеттеры по стороне */
function setBorderWidth(
  t: StyleTarget,
  side: 'all' | 'top' | 'right' | 'bottom' | 'left',
  w: string,
) {
  switch (side) {
    case 'all':
      t.borderWidth = w
      break
    case 'top':
      t.borderTopWidth = w
      break
    case 'right':
      t.borderRightWidth = w
      break
    case 'bottom':
      t.borderBottomWidth = w
      break
    case 'left':
      t.borderLeftWidth = w
      break
  }
}
function setBorderStyle(
  t: StyleTarget,
  side: 'all' | 'top' | 'right' | 'bottom' | 'left',
  s: string,
) {
  switch (side) {
    case 'all':
      t.borderStyle = s
      break
    case 'top':
      t.borderTopStyle = s
      break
    case 'right':
      t.borderRightStyle = s
      break
    case 'bottom':
      t.borderBottomStyle = s
      break
    case 'left':
      t.borderLeftStyle = s
      break
  }
}
function setBorderColor(
  t: StyleTarget,
  side: 'all' | 'top' | 'right' | 'bottom' | 'left',
  c?: string,
) {
  if (!c) return
  switch (side) {
    case 'all':
      t.borderColor = c
      break
    case 'top':
      t.borderTopColor = c
      break
    case 'right':
      t.borderRightColor = c
      break
    case 'bottom':
      t.borderBottomColor = c
      break
    case 'left':
      t.borderLeftColor = c
      break
  }
}

/** Радиусы */
function coerceRadius(v: unknown): string {
  if (v == null || v === '') return '0'
  if (typeof v === 'number' && !Number.isNaN(v)) return `${v}px`
  const s = String(v).trim()
  if (!s) return '0'
  if (/^-?\d+(\.\d+)?$/.test(s)) return `${s}px`
  return s
}
function setCornerRadius(
  t: StyleTarget,
  corner: 'TL' | 'TR' | 'BR' | 'BL',
  r: string,
) {
  const map = {
    TL: 'borderTopLeftRadius',
    TR: 'borderTopRightRadius',
    BR: 'borderBottomRightRadius',
    BL: 'borderBottomLeftRadius',
  } as const
  // @ts-expect-error index ok
  t[map[corner]] = r
}

/**
 * Спецификация рамок:
 *  - Шорткаты: b, bx, by, bt, bb, bl, br
 *  - Атомы: bw/bs/bc (+ T/R/B/L)
 *  - Радиусы: r, rTL, rTR, rBR, rBL
 *
 * Приоритеты (за счёт порядка применения ключей в applier):
 *   более конкретные ключи (bt/bb/bl/br) должны применяться ПОСЛЕ bx/by и ПОСЛЕ b.
 *   Для этого мы внесём их в объект в порядке: b -> bx/by -> bt/bb/bl/br -> атомы -> радиусы
 */
const BoxBorderSpec = {
  // --- ALL ---
  b: {
    // "1", "1 #ddd", "2 dashed #888"
    apply: (v: unknown, t: StyleTarget) =>
      setBorder(t, 'all', parseBorderShorthand(v)),
  },

  // --- AXIS ---
  bx: {
    apply: (v: unknown, t: StyleTarget) => {
      const sh = parseBorderShorthand(v)
      setBorder(t, 'left', sh)
      setBorder(t, 'right', sh)
    },
  },
  by: {
    apply: (v: unknown, t: StyleTarget) => {
      const sh = parseBorderShorthand(v)
      setBorder(t, 'top', sh)
      setBorder(t, 'bottom', sh)
    },
  },

  // --- SIDES (перекрывают всё выше) ---
  bt: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorder(t, 'top', parseBorderShorthand(v)),
  },
  br: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorder(t, 'right', parseBorderShorthand(v)),
  },
  bb: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorder(t, 'bottom', parseBorderShorthand(v)),
  },
  bl: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorder(t, 'left', parseBorderShorthand(v)),
  },

  // --- ATOMS (в т.ч. по сторонам) ---
  bw: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderWidth(t, 'all', coerceBorderWidth(v)),
  },
  bwT: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderWidth(t, 'top', coerceBorderWidth(v)),
  },
  bwR: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderWidth(t, 'right', coerceBorderWidth(v)),
  },
  bwB: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderWidth(t, 'bottom', coerceBorderWidth(v)),
  },
  bwL: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderWidth(t, 'left', coerceBorderWidth(v)),
  },

  bs: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderStyle(t, 'all', coerceBorderStyle(v)),
  },
  bsT: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderStyle(t, 'top', coerceBorderStyle(v)),
  },
  bsR: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderStyle(t, 'right', coerceBorderStyle(v)),
  },
  bsB: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderStyle(t, 'bottom', coerceBorderStyle(v)),
  },
  bsL: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderStyle(t, 'left', coerceBorderStyle(v)),
  },

  bc: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderColor(t, 'all', coerceColor(v)),
  },
  bcT: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderColor(t, 'top', coerceColor(v)),
  },
  bcR: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderColor(t, 'right', coerceColor(v)),
  },
  bcB: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderColor(t, 'bottom', coerceColor(v)),
  },
  bcL: {
    apply: (v: unknown, t: StyleTarget) =>
      setBorderColor(t, 'left', coerceColor(v)),
  },

  // --- RADII ---
  r: {
    apply: (v: unknown, t: StyleTarget) => (t.borderRadius = coerceRadius(v)),
  },
  rTL: {
    apply: (v: unknown, t: StyleTarget) =>
      setCornerRadius(t, 'TL', coerceRadius(v)),
  },
  rTR: {
    apply: (v: unknown, t: StyleTarget) =>
      setCornerRadius(t, 'TR', coerceRadius(v)),
  },
  rBR: {
    apply: (v: unknown, t: StyleTarget) =>
      setCornerRadius(t, 'BR', coerceRadius(v)),
  },
  rBL: {
    apply: (v: unknown, t: StyleTarget) =>
      setCornerRadius(t, 'BL', coerceRadius(v)),
  },
} as const

const applyBoxBorderProps = createPropApplier<StyleTarget>(BoxBorderSpec)

/* ====================
 * Middleware
 * ==================== */

/**
 * Middleware для общих стилей контейнера:
 *  - отступы (padding/margin): p, px, py, pt, pb, pl, pr, m, mx, my, mt, mb, ml, mr
 *  - рамки (border): b, bx, by, bt, bb, bl, br, bw/bs/bc (+ T/R/B/L), r, rTL/TR/BR/BL
 *  - поддержка динамики (:prop, v-bind="{...}")
 *
 * Примеры:
 *  <Box b="1 #ddd" r="8" px="0.5rem" :py="gapY" />
 *  <Row :="{ bwL: 3, bcL: 'red', bs: 'dashed' }" />
 *  <Card bx="2 dashed #999" :bb="'0'" />
 */
export function JSXRender_Base_Styles(
  input: JSXRenderMiddlewareInput,
): VNode | null {
  const { node, props, vnode } = input

  const computedStyles: StyleTarget = {}

  // 1) Spacing
  applyBoxSpacingProps(node.props as any, computedStyles, props)

  // 2) Borders
  applyBoxBorderProps(node.props as any, computedStyles, props)

  // Мердж в существующие стили. Внешние стили (props.styles) имеют МЕНЬШИЙ приоритет,
  // если хотим, чтобы spacing/border из DSL были главнее - оставляем порядок как ниже:
  props.styles = {
    ...props.styles,
    ...computedStyles,
  }

  return vnode
}
