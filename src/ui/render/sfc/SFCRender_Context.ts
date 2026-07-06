import type { SFCVueRenderContext, SFCVueRenderIteration } from '@/domain/types/sfc-render.type'

/** Создает root context для одного render pass SFC renderer adapter. */
export function createSFCVueRenderContext(
  props: Record<string, unknown> | undefined,
  renderVersion = 0,
): SFCVueRenderContext {
  return {
    props: props ?? {},
    locals: {},
    iteration: null,
    renderVersion,
  }
}

/** Создает дочерний context с дополнительными локальными значениями. */
export function extendSFCVueRenderContext(
  context: SFCVueRenderContext,
  locals: Record<string, unknown>,
  iteration: SFCVueRenderIteration | null = context.iteration,
): SFCVueRenderContext {
  return {
    props: context.props,
    locals: {
      ...context.locals,
      ...locals,
    },
    iteration,
    renderVersion: context.renderVersion,
  }
}
