import type {
  SFCVueRenderAdapterKey,
  SFCVueRenderContext,
  SFCVueRenderElementInput,
  SFCVueRenderFunction,
  SFCVueRenderResult,
} from '@/services/render/sfc/sfc-vue-render.type'

import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { cloneVNode, isVNode } from 'vue'
import { MODULE_VISUAL_ATTRIBUTE, VUE_MODULE_RENDERERS } from '@/services/modules/vue-module'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-vue-render.type'

// Получает один renderer из активного Vue-адаптера без привязки к нему структурных renderers.
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

export function resolveSFCModuleScope(context: SFCVueRenderContext) {
  if (context.host) {
    const scope = Endge.runtime.getRuntimeScopeByHost(context.host.id)
    if (scope) {
      return scope
    }
  }
  for (const id of [...context.runtimeScopeIds].reverse()) {
    const scope = Endge.runtime.scopes.get(id)
    if (scope) {
      return scope
    }
  }
  return null
}

export function renderWithSFCAdapter(tag: SFCVueRenderAdapterKey, input: SFCVueRenderElementInput): SFCVueRenderResult {
  const entry = Endge.runtime.modules.resolve<SFCVueRenderFunction>(resolveSFCModuleScope(input.context), VUE_MODULE_RENDERERS, tag)
  if (!entry) {
    return requireSFCAdapterRenderer(tag)(input)
  }
  const node = entry.value(input)
  return isVNode(node) ? cloneVNode(node, { [MODULE_VISUAL_ATTRIBUTE]: entry.visualToken }) : node
}
