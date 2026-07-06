import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

/** Рендерит placeholder вложенного компонента до подключения core runtime. */
export const SFCRender_Component: SFCVueRenderFunction = SFCRender_Base((input) => {
  const identity = input.props.is ?? input.props.identity ?? 'unknown'

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-component-placeholder', input.props.class],
    'data-component': String(identity),
  }, `component:${String(identity)}`)
})
