import type { SFCVueRenderAdapterFunction } from '@/model/render/sfc/sfc-vue-render.type'

/** Рендерит badge primitive с нейтральным tone metadata. */
export const SFCRender_Badge: SFCVueRenderAdapterFunction = (input) => {
  return input.h('span', {
    ...input.attrs,
    'class': ['endge-sfc-badge', input.props.class],
    'data-tone': input.props.tone == null ? undefined : String(input.props.tone),
  }, input.children)
}
