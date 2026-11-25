import type { ModuleArtifact, ScopedModule, ScopedModuleContext } from '@endge/core'
import type { NovaAssets } from '@nova-lab/core'
import type { SFCVueRenderAdapterKey, SFCVueRenderFunction } from '@/services/render/sfc/sfc-vue-render.type'
import type { TimelinePresetDescriptor, TimelinePresetEntry, TimelinePresetProvider } from '@/ui/timeline/timeline-presets'
import { isModuleRendererId } from '@endge/core'

export const MODULE_VISUAL_ATTRIBUTE = 'data-endge-module-visual'
export const VUE_MODULE_RENDERERS = 'endge.vue.renderers'
export const VUE_MODULE_TIMELINE_PRESETS = 'endge.vue.timeline.presets'

export function registerScopedVueRenderer(
  context: ScopedModuleContext,
  tag: SFCVueRenderAdapterKey,
  renderer: SFCVueRenderFunction,
): () => void {
  return context.register(VUE_MODULE_RENDERERS, tag, renderer)
}

export function registerNamedScopedVueRenderer(
  context: ScopedModuleContext,
  primitive: SFCVueRenderAdapterKey,
  id: string,
  renderer: SFCVueRenderFunction,
): () => void {
  if (!isModuleRendererId(id)) {
    throw new Error(`Invalid renderer ID "${id}".`)
  }
  return context.register(VUE_MODULE_RENDERERS, `${primitive}/${id}`, renderer)
}

export function registerScopedTimelinePreset(
  context: ScopedModuleContext,
  descriptor: TimelinePresetDescriptor,
  provider: TimelinePresetProvider,
): () => void {
  if (!descriptor.name.trim()) {
    throw new Error('A scoped Timeline preset requires a name.')
  }
  const entry: TimelinePresetEntry = { descriptor: structuredClone(descriptor), provider }
  return context.register(VUE_MODULE_TIMELINE_PRESETS, descriptor.name, entry)
}

export interface VueModuleHost {
  core: typeof import('@endge/core')
  vue: typeof import('vue')
  uiVue: typeof import('@/main')
  timeline: typeof import('@nova-lab/timeline') & { TimelineAssets: typeof NovaAssets }
}

export interface VueModuleExports {
  default: (host: VueModuleHost) => ScopedModule
}

export function createVueModuleArtifact(module: VueModuleExports, host: VueModuleHost, css?: string): ModuleArtifact {
  if (typeof module?.default !== 'function') {
    throw new TypeError('module.js must export a default module factory.')
  }
  return {
    create: () => module.default(host),
    installStyle: css && typeof document !== 'undefined' ? token => installVueModuleStyle(token, css) : undefined,
  }
}

function installVueModuleStyle(token: string, css: string): () => void {
  const style = document.createElement('style')
  style.setAttribute('data-endge-module-style', token)
  style.textContent = `@scope ([${MODULE_VISUAL_ATTRIBUTE}~="${token}"]) {\n${css}\n}`
  document.head.append(style)
  return () => style.remove()
}

let timelineModule: Promise<VueModuleHost['timeline']> | undefined
export function loadVueModuleTimeline(): Promise<VueModuleHost['timeline']> {
  return timelineModule ??= Promise.all([import('@nova-lab/timeline'), import('@nova-lab/core')])
    .then(([timeline, { NovaAssets }]) => ({ ...timeline, TimelineAssets: NovaAssets }))
}
