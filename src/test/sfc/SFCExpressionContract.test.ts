import { compileComponentSFCExpression } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'
import { evaluateSFCExpression } from '@/services/render/sfc/SFCVueExpressionPreview'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

describe('compiler → renderer expression contract', () => {
  const props = { count: 2, zero: 0, empty: '', absent: null, flag: false, text: ' READY ', rows: [{ id: 7, name: 'SU' }] }
  it.each([
    ['count + 3 * 2', 8],
    ['zero ?? 9', 0],
    ['empty || "fallback"', 'fallback'],
    ['absent?.value ?? "fallback"', 'fallback'],
    ['flag ? 1 : count', 2],
    ['text.trim().toLowerCase()', 'ready'],
    ['rows[id=7]?.name', 'SU'],
    ['rows[0].name', 'SU'],
    ['Math.max(count, 5)', 5],
    ['Array.isArray(rows)', true],
    ['({ count, value: [zero, absent] })', { count: 2, value: [0, null] }],
    [`\`flight-\${count}\``, 'flight-2'],
    ['(count as number) + 1', 3],
    ['count === 2 && !flag', true],
  ])('сохраняет семантику %s после сериализации', (source, expected) => {
    const compiled = compileComponentSFCExpression(source as string, { props: Object.keys(props) })
    expect(compiled.diagnostics).toEqual([])
    const value = JSON.parse(JSON.stringify(compiled.value))
    delete value.source
    expect(evaluateSFCValue(value, createSFCVueRenderContext(props))).toEqual(expected)
  })

  it('сохраняет editor preview API для несохранённого Source', () => {
    const context = createSFCVueRenderContext(props)
    expect(evaluateSFCExpression('count + 1', context)).toBe(3)
    expect(evaluateSFCExpression('count +', context)).toBeUndefined()
    expect(evaluateSFCExpression('', context)).toBeUndefined()
  })

  it('требует пересборку старого expression вместо runtime parsing', () => {
    const old = JSON.parse(JSON.stringify({ kind: 'expression', source: 'count + 1', reads: [] }))
    expect(() => evaluateSFCValue(old, createSFCVueRenderContext(props))).toThrow('Rebuild')
  })

  it('игнорирует исходный текст при наличии IR', () => {
    const value = JSON.parse(JSON.stringify(compileComponentSFCExpression('count + 1').value))
    value.source = 'invalid source !!!'
    expect(evaluateSFCValue(value, createSFCVueRenderContext(props))).toBe(3)
  })

  it('читает актуальные значения и соблюдает короткое замыкание', () => {
    const read = vi.fn(() => 7)
    const context = createSFCVueRenderContext({ flag: false, object: Object.defineProperty({}, 'value', { get: read }) })
    const compiled = compileComponentSFCExpression('flag && object.value')
    expect(evaluateSFCValue(compiled.value, context)).toBe(false)
    expect(read).not.toHaveBeenCalled()
    context.props.flag = true
    expect(evaluateSFCValue(compiled.value, context)).toBe(7)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('не исполняет пользовательские функции и не изменяет props', () => {
    const dangerous = vi.fn()
    const context = createSFCVueRenderContext({ count: 2, dangerous, object: {} })
    for (const source of ['dangerous()', 'count = 8', 'object.constructor.constructor("return globalThis")()']) {
      const compiled = compileComponentSFCExpression(source)
      expect(evaluateSFCValue(compiled.value, context)).toBeUndefined()
    }
    expect(dangerous).not.toHaveBeenCalled()
    expect(context.props.count).toBe(2)
  })
})
