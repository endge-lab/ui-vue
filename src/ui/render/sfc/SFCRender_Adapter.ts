import type {
  SFCVueRenderAdapterKey,
  SFCVueRenderFunction,
} from '@/model/render/sfc/sfc-vue-render.type'

import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/model/render/sfc/sfc-vue-render.type'

/** Resolves one renderer from the active Vue adapter without coupling structural renderers to it. */
export function requireSFCAdapterRenderer(tag: SFCVueRenderAdapterKey): SFCVueRenderFunction {
  const adapter = Endge.uiRegistry.adapters.requireActive<SFCVueRenderFunction>({
    protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
    protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
    renderer: 'vue',
    requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
  })
  const renderFn = adapter.renderers[tag]
  if (!renderFn) {
    throw new Error(`[SFCRender_Adapter] adapter "${adapter.id}" has no renderer for "${tag}"`)
  }
  return renderFn
}
