import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

/** Рендерит разделитель SFC primitive. */
export const SFCRender_Divider: SFCVueRenderFunction = SFCRender_Base((input) => {
  const vertical = input.props.vertical === true || input.props.orientation === 'vertical'

  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-divider', input.props.class],
    role: 'separator',
    'aria-orientation': vertical ? 'vertical' : 'horizontal',
    style: {
      ...(input.attrs.style as Record<string, string> | undefined),
      alignSelf: vertical ? 'stretch' : undefined,
      borderLeft: vertical ? '1px solid currentColor' : undefined,
      borderTop: vertical ? undefined : '1px solid currentColor',
      opacity: '0.16',
    },
  })
})
