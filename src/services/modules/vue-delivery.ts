import type { EndgeBootContext, ModuleArtifactLoader } from '@endge/core'
import type { VueModuleExports, VueModuleHost } from './vue-module'
import { Endge, moduleReferenceKey, readEndgeBundle } from '@endge/core'
import { createVueModuleArtifact } from './vue-module'

export async function bootVueDelivery(
  input: unknown,
  facets: Readonly<Record<string, string>>,
  context: EndgeBootContext,
  host: () => Promise<VueModuleHost>,
): Promise<void> {
  const container = readEndgeBundle(input)
  const embedded = container.delivery?.modules
  const modules = new Map(embedded?.map(module => [moduleReferenceKey(module.manifest), module]))
  const loader: ModuleArtifactLoader = async (reference, signal) => {
    const module = modules.get(moduleReferenceKey(reference))
    if (!module) {
      throw new Error(`[Bundle] Missing embedded module "${moduleReferenceKey(reference)}"`)
    }
    const dependencies = await host()
    signal.throwIfAborted()
    const url = URL.createObjectURL(new Blob([module.js], { type: 'text/javascript' }))
    try {
      const imported = await import(/* @vite-ignore */ url) as VueModuleExports
      signal.throwIfAborted()
      return createVueModuleArtifact(imported, dependencies, module.css)
    }
    finally {
      URL.revokeObjectURL(url)
    }
  }
  await Endge.bootDelivery(container, facets, { ...context, moduleLoader: embedded ? loader : context.moduleLoader })
}
