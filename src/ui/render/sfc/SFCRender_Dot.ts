import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

/** Рендерит status dot primitive. */
export const SFCRender_Dot: SFCVueRenderFunction = SFCRender_Base((input) => {
  const size = Number(input.props.size ?? 8)

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-dot', input.props.class],
    'data-tone': input.props.tone == null ? undefined : String(input.props.tone),
    style: {
      ...(input.attrs.style as Record<string, string> | undefined),
      display: 'inline-block',
      width: `${Number.isFinite(size) ? size : 8}px`,
      height: `${Number.isFinite(size) ? size : 8}px`,
      borderRadius: '999px',
    },
  })
})
