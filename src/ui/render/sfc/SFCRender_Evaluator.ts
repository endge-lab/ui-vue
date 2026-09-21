import type { RComponentSFC_IR_Value } from '@endge/core'
import type { SFCVueRenderBinding, SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'
import { evaluateComponentSFCExpression } from '@endge/core'
import { DataPath } from '@endge/raph'

/** Вычисляет безопасное подмножество SFC IR value без eval и runtime зависимостей. */
export function evaluateSFCValue(
  value: RComponentSFC_IR_Value | undefined,
  context: SFCVueRenderContext,
): unknown {
  if (!value) {
    return undefined
  }
  if (value.kind === 'literal') {
    return value.value
  }

  if (!value.expression) {
    throw new Error('[SFC] Compiled expression is missing. Rebuild the component artifact.')
  }
  return evaluateComponentSFCExpression(value.expression, context)
}

/** Вычисляет будущий binding-контракт renderer adapter. */
export function evaluateSFCBinding(
  binding: SFCVueRenderBinding,
  context: SFCVueRenderContext,
): unknown {
  if (binding.kind === 'literal') {
    return binding.value
  }
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
  const segments = parseSFCPath(path)
  if (segments.length === 0) {
    return undefined
  }

  const [head, ...tail] = segments
  if (head.kind !== 'key') {
    return undefined
  }

  const root = head.key === 'props'
    ? context.props
    : head.key === '$context'
      ? context.context
      : Object.hasOwn(context.locals, head.key)
        ? context.locals[head.key]
        : context.props[head.key]

  return readSFCObjectPathSegments(root, tail)
}

/** Читает относительный DataPath, включая array selectors, из переданного объекта. */
export function readSFCObjectPath(path: string, source: unknown): unknown {
  return readSFCObjectPathSegments(source, parseSFCPath(path))
}

function readSFCObjectPathSegments(
  source: unknown,
  segments: ReturnType<DataPath['segments']>,
): unknown {
  return segments.reduce<unknown>((current, segment) => {
    if (current == null) {
      return undefined
    }

    if (segment.kind === 'key') {
      if (typeof current !== 'object' && typeof current !== 'function') {
        return undefined
      }
      return (current as Record<string, unknown>)[segment.key]
    }

    if (segment.kind === 'index') {
      return Array.isArray(current) ? current[segment.index] : undefined
    }

    if (segment.kind === 'selector') {
      if (!Array.isArray(current)) {
        return undefined
      }

      return current.find((item) => {
        if (item == null || typeof item !== 'object') {
          return false
        }
        return Object.is((item as Record<string, unknown>)[segment.key], segment.value)
      })
    }

    return undefined
  }, source)
}

function isSupportedPath(source: string): boolean {
  const identifier = String.raw`[A-Z_$][\w$]*`
  const selectorKey = String.raw`[A-Z_$][\w$-]*`
  const singleQuoted = String.raw`'(?:\\.|[^'\\])*'`
  const doubleQuoted = String.raw`"(?:\\.|[^"\\])*"`
  const selectorValue = String.raw`(?:${singleQuoted}|${doubleQuoted}|\d+)`
  const dotSegment = String.raw`\.${identifier}`
  const indexSegment = String.raw`\[\s*\d+\s*\]`
  const selectorSegment = String.raw`\[\s*${selectorKey}\s*=\s*${selectorValue}\s*\]`

  return new RegExp(
    String.raw`^${identifier}(?:${dotSegment}|${indexSegment}|${selectorSegment})*$`,
    'i',
  ).test(source)
}

function parseSFCPath(path: string): ReturnType<DataPath['segments']> {
  const source = path.trim()
  if (!isSupportedPath(source)) {
    return []
  }

  return DataPath.from(source).segments()
}
