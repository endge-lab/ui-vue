import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

/** Рендерит базовый блочный контейнер SFC. */
export const SFCRender_Box: SFCVueRenderFunction = SFCRender_Base((input) => {
  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-box', input.props.class],
  }, input.children)
})
