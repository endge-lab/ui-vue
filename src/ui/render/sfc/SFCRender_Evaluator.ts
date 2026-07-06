import type { RComponentSFC_IR_Value } from '@endge/core'
import type { SFCVueRenderBinding, SFCVueRenderContext } from '@/domain/types/sfc-render.type'

/** Вычисляет безопасное подмножество SFC IR value без eval и runtime зависимостей. */
export function evaluateSFCValue(
  value: RComponentSFC_IR_Value | undefined,
  context: SFCVueRenderContext,
): unknown {
  if (!value) return undefined
  if (value.kind === 'literal') return value.value

  return evaluateSFCExpression(value.source, context)
}

/** Вычисляет будущий binding-контракт renderer adapter. */
export function evaluateSFCBinding(
  binding: SFCVueRenderBinding,
  context: SFCVueRenderContext,
): unknown {
  if (binding.kind === 'literal') return binding.value
  return readSFCPath(binding.path, context)
}

/** Вычисляет props object из IR props map. */
export function evaluateSFCProps(
  props: Record<string, RComponentSFC_IR_Value> | undefined,
  context: SFCVueRenderContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props ?? {})) {
    result[key] = evaluateSFCValue(value, context)
  }

  return result
}

/** Приводит любое значение к условию control-flow. */
export function isTruthySFCValue(value: unknown): boolean {
  return Boolean(value)
}

/** Читает путь из locals, затем из props. Отсутствующие поля возвращают undefined. */
export function readSFCPath(path: string, context: SFCVueRenderContext): unknown {
  const segments = normalizePath(path)
  if (segments.length === 0) return undefined

  const [head, ...tail] = segments
  const root = Object.prototype.hasOwnProperty.call(context.locals, head)
    ? context.locals[head]
    : context.props[head]

  return tail.reduce<unknown>((current, segment) => {
    if (current == null) return undefined
    if (typeof current !== 'object' && typeof current !== 'function') return undefined

    return (current as Record<string, unknown>)[segment]
  }, root)
}

/** Вычисляет ограниченные expression-значения: literals, path, !path, !!path. */
export function evaluateSFCExpression(
  expression: string,
  context: SFCVueRenderContext,
): unknown {
  const source = expression.trim()
  if (source === '') return undefined
  if (source === 'true') return true
  if (source === 'false') return false
  if (source === 'null') return null
  if (source === 'undefined') return undefined

  if (isQuotedString(source)) return source.slice(1, -1)
  if (/^-?\d+(\.\d+)?$/.test(source)) return Number(source)

  if (source.startsWith('!!')) {
    return Boolean(evaluateSFCExpression(source.slice(2), context))
  }

  if (source.startsWith('!')) {
    return !isTruthySFCValue(evaluateSFCExpression(source.slice(1), context))
  }

  if (!isSupportedPath(source)) return undefined

  return readSFCPath(source, context)
}

function isQuotedString(source: string): boolean {
  return (source.startsWith('"') && source.endsWith('"'))
    || (source.startsWith('\'') && source.endsWith('\''))
}

function isSupportedPath(source: string): boolean {
  return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(source)
}

function normalizePath(path: string): string[] {
  const source = path.trim()
  if (!isSupportedPath(source)) return []

  return source.split('.').filter(Boolean)
}
