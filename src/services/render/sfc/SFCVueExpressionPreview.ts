import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'
import { compileComponentSFCExpression } from '@endge/core'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

/**
 * Preview несохранённого Source для редактора; сохраняет публичный authoring API.
 * Render готового artifact использует evaluateSFCValue и не вызывает этот compiler path.
 */
export function evaluateSFCExpression(source: string, context: SFCVueRenderContext): unknown {
  if (!source.trim()) {
    return undefined
  }
  const compiled = compileComponentSFCExpression(source, {
    props: Object.keys(context.props),
    locals: Object.keys(context.locals),
  })
  return evaluateSFCValue(compiled.value, context)
}
