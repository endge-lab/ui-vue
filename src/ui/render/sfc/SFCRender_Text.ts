import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

/** Рендерит текстовый SFC primitive. */
export const SFCRender_Text: SFCVueRenderFunction = SFCRender_Base((input) => {
  const content = input.props.value == null
    ? input.children
    : String(input.props.value)

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-text', input.props.class],
  }, content)
})
