import { describe, expect, it } from 'vitest'
import type { RComponentSFC_IR_Value } from '@endge/core'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCExpression, evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

describe('SFCRender_Evaluator', () => {
  it('returns literal prop values', () => {
    const value: RComponentSFC_IR_Value = {
      kind: 'literal',
      value: 'Boarding',
    }

    expect(evaluateSFCValue(value, createSFCVueRenderContext({}))).toBe('Boarding')
  })

  it('evaluates dotted prop expressions', () => {
    const context = createSFCVueRenderContext({
      flight: {
        number: 'SU 1402',
      },
    })

    expect(evaluateSFCExpression('flight.number', context)).toBe('SU 1402')
  })

  it('evaluates boolean negation', () => {
    const context = createSFCVueRenderContext({
      compact: false,
    })

    expect(evaluateSFCExpression('!compact', context)).toBe(true)
  })

  it('returns undefined for missing props', () => {
    const context = createSFCVueRenderContext({})

    expect(evaluateSFCExpression('flight.number', context)).toBeUndefined()
  })
})
