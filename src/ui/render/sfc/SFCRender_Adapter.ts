import type { ModuleContribution, ModuleReference } from '@endge/core'

import type {
  SFCVueRenderAdapterKey,
  SFCVueRenderContext,
  SFCVueRenderElementInput,
  SFCVueRenderFunction,
  SFCVueRenderResult,
} from '@/services/render/sfc/sfc-vue-render.type'
import {
  ADAPTER_RENDERER_SELECTION,
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  moduleReferenceKey,
  parseModuleRendererSelection,
} from '@endge/core'
import { cloneVNode, isVNode } from 'vue'
import { MODULE_VISUAL_ATTRIBUTE, VUE_MODULE_RENDERERS } from '@/services/modules/vue-module'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-vue-render.type'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

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

function renderModuleRenderer(entry: ModuleContribution<SFCVueRenderFunction>, input: SFCVueRenderElementInput): SFCVueRenderResult {
  const node = entry.value(input)
  return isVNode(node) ? cloneVNode(node, { [MODULE_VISUAL_ATTRIBUTE]: entry.visualToken }) : node
}

export function readWorkspaceRendererReferences() {
  return Endge.configuration.isResolved && Endge.mode !== 'debugger'
    ? Endge.configuration.current.defaultRenderers
    : undefined
}

export function workspaceRendererAttachment(reference: ModuleReference): string {
  return `workspace-renderer:${moduleReferenceKey(reference)}`
}

export function renderWithSFCAdapter(tag: SFCVueRenderAdapterKey, input: SFCVueRenderElementInput): SFCVueRenderResult {
  const scope = resolveSFCModuleScope(input.context)
  const selection = input.context.host?.rendererSelections?.[tag]
    ?? evaluateSFCValue(input.node.props.renderer, input.context)
  if (selection === ADAPTER_RENDERER_SELECTION) {
    return requireSFCAdapterRenderer(tag)(input)
  }
  if (selection != null && selection !== '') {
    const named = parseModuleRendererSelection(selection)
    const entry = named && Endge.runtime.modules.resolveAttachment<SFCVueRenderFunction>(
      scope,
      named.attachment,
      VUE_MODULE_RENDERERS,
      `${tag}/${named.rendererId}`,
    )
    if (!entry) {
      throw new Error(`Рендерер ${tag} «${String(selection)}» недоступен в текущей композиции.`)
    }
    return renderModuleRenderer(entry, input)
  }
  const reference = readWorkspaceRendererReferences()?.[tag]
  if (reference) {
    const entry = Endge.runtime.modules.resolveAttachment<SFCVueRenderFunction>(
      Endge.runtime.workspaceModuleScope,
      workspaceRendererAttachment(reference),
      VUE_MODULE_RENDERERS,
      `${tag}/${reference.rendererId}`,
    )
    if (!entry) {
      throw new Error(`Рендерер ${tag} «${moduleReferenceKey(reference)}:${reference.rendererId}» недоступен в рабочем пространстве.`)
    }
    return renderModuleRenderer(entry, input)
  }
  const entry = Endge.runtime.modules.resolve<SFCVueRenderFunction>(scope, VUE_MODULE_RENDERERS, tag)
  if (!entry) {
    return requireSFCAdapterRenderer(tag)(input)
  }
  return renderModuleRenderer(entry, input)
}
