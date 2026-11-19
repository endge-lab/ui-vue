import type { ModuleArtifact, ScopedModuleContext } from '@endge/core'
import type { VueModuleHost } from '@/services/modules/vue-module'
import type { TimelinePresetEntry } from '@/ui/timeline/timeline-presets'
import { createLocalModuleLoader, Endge, EndgeModule, RuntimeScope } from '@endge/core'
import { expect, it } from 'vitest'
import { createVueModuleArtifact, registerScopedTimelinePreset, registerScopedVueRenderer, VUE_MODULE_RENDERERS, VUE_MODULE_TIMELINE_PRESETS } from '@/services/modules/vue-module'
import { listTimelinePresets, registerTimelinePreset, resolveTimelinePreset } from '@/ui/timeline/timeline-presets'

it('resolves a module renderer and Timeline provider in the owning scope', async () => {
  const first = { identity: 'module-fixture', version: '1.0.0' }
  const second = { ...first, version: '1.0.1' }
  const createArtifact = (value: string): ModuleArtifact => ({
    create: () => new class extends EndgeModule<ScopedModuleContext> {
      override setup(ctx: ScopedModuleContext) {
        registerScopedVueRenderer(ctx, 'Table', () => value)
        registerScopedTimelinePreset(ctx, { name: 'lane', fields: { height: { type: 'number', label: 'Height', default: 20 } }, label: value }, {
          configure: () => ({ height: value === 'first' ? 100 : 200 }),
        })
      }
    }(),
  })
  const modules = Endge.runtime.modules
  modules.setup(createLocalModuleLoader([{ reference: first, artifact: createArtifact('first') }, { reference: second, artifact: createArtifact('second') }]))
  const builtIn = registerTimelinePreset({ name: 'built-in-fixture', fields: {} }, {})
  const scopeA: RuntimeScope = new RuntimeScope({ id: 'a', path: 'a', hooks: { activate: () => modules.attach(scopeA, 'visual', first) } })
  const scopeB: RuntimeScope = new RuntimeScope({ id: 'b', path: 'b', parent: scopeA, hooks: { activate: () => modules.attach(scopeB, 'visual', second) } })
  try {
    await scopeB.activate()
    expect(listTimelinePresets(scopeA).map(item => item.label ?? item.name)).toEqual(['built-in-fixture', 'first'])
    expect(listTimelinePresets(scopeB).map(item => item.label ?? item.name)).toEqual(['built-in-fixture', 'second'])
    expect(modules.resolve(scopeA, VUE_MODULE_RENDERERS, 'Table')?.value).not.toBe(modules.resolve(scopeB, VUE_MODULE_RENDERERS, 'Table')?.value)
    const resolve = () => resolveTimelinePreset('lane', {}, modules.resolve<TimelinePresetEntry>(scopeB, VUE_MODULE_TIMELINE_PRESETS, 'lane')?.value)!
    const previous = resolve()
    expect(previous.provider.configure?.({ settings: previous.settings, collapsed: false })).toEqual({ height: 200 })
    await modules.replace(scopeB, 'visual', first)
    expect(resolve().provider).not.toBe(previous.provider)
    expect(resolve().settings).toEqual({ height: 20 })
  }
  finally {
    await scopeA.dispose()
    modules.setup(undefined)
    builtIn()
  }
  expect(listTimelinePresets()).toEqual([])
})

it('uses the same factory and host dependencies for a local module artifact', () => {
  const host = {} as VueModuleHost
  const instance = new class extends EndgeModule<ScopedModuleContext> {}()
  const artifact = createVueModuleArtifact({
    default: (dependencies) => {
      expect(dependencies).toBe(host)
      return instance
    },
  }, host, ':scope { color: blue }')
  expect(artifact.create()).toBe(instance)
})
