import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

/** Рендерит badge primitive с нейтральным tone metadata. */
export const SFCRender_Badge: SFCVueRenderFunction = SFCRender_Base((input) => {
  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-badge', input.props.class],
    'data-tone': input.props.tone == null ? undefined : String(input.props.tone),
  }, input.children)
})
