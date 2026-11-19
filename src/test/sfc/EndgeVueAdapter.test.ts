import type { EndgeWorkspaceDefinition, RComponentSFC_IR_ElementNode, ScopedModuleContext } from '@endge/core'
import type { SFCVueRenderAdapter } from '@/services/render/sfc/sfc-vue-render.type'
import { createLocalModuleLoader, Endge, EndgeModule, RuntimeScope } from '@endge/core'
import { Raph } from '@raphy-js/raph'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { h, isVNode } from 'vue'
import { createEndgeVuePlugin, EndgeVue_Module } from '@/modules/EndgeVue_Module'
import { registerNamedScopedVueRenderer } from '@/services/modules/vue-module'
import { NativeVueSFCAdapter } from '@/services/render/sfc/native-vue-sfc-adapter'
import { workspaceRendererAttachment } from '@/ui/render/sfc/SFCRender_Adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

const TEST_WORKSPACE: EndgeWorkspaceDefinition = {
  identity: 'workspace-test',
  displayName: 'Test Workspace',
  startupCompositionIdentity: null,
  dataMode: 'live',
  managedBy: 'user',
  managedById: null,
  installedIntegrations: [],
  configuration: {
    vars: [],
    values: {},
    locales: [{ code: 'en', displayName: 'English', shortLabel: 'EN', direction: 'ltr' }],
    defaultLocale: 'en',
    fallbackLocale: 'en',
    themes: [
      { identity: 'light', displayName: 'Light' },
      { identity: 'dark', displayName: 'Dark' },
    ],
    defaultTheme: 'light',
    timezones: [
      { identity: 'local', displayName: 'Local time' },
      { identity: 'UTC', displayName: 'UTC' },
    ],
    defaultTimezone: 'local',
    defaultAuthProfileIdentity: null,
    sfcAdapterIds: ['vue-native'],
    defaultSfcAdapterId: 'vue-native',
    sfcEditing: {
      cancelOn: [{ event: 'keydown', key: ['Escape'] }, { event: 'focusout' }],
      commitOn: [{ event: 'keydown', key: ['Enter'] }],
    },
    tooltips: { side: 'right', align: 'start', openDelay: 250, closeDelay: 100 },
    diagnostics: {
      telemetry: {
        collection: {
          enabled: false,
          signals: ['log'],
          minSeverity: 9,
          maxRecords: 2_000,
        },
        outputs: [],
        routes: [],
      },
      snapshots: {
        content: { telemetry: true, problems: true, configuration: false },
        shortcut: {
          triggerSet: [],
          content: { telemetry: true, problems: true, configuration: false },
        },
        automatic: {
          enabled: false,
          errorCount: 10,
          windowSeconds: 60,
          cooldownSeconds: 300,
          outputIds: [],
        },
      },
    },
  },
}

describe('проверка SFC-адаптер модуля Endge Vue', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
  })

  afterEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
  })

  it('регистрирует и активирует vue для выбранного Workspace', () => {
    const module = new EndgeVue_Module()

    module.setup()
    module.build()

    expect(Endge.uiRegistry.adapters.active?.id).toBe(NativeVueSFCAdapter.id)
  })

  it('использует штатный рендерер приложения, пока workspace не закрепил версию из каталога', async () => {
    const plugin = createEndgeVuePlugin({ defaultRenderers: { Input: () => 'app default' } })
    const module = plugin.modules![0]!.create({ getModule: vi.fn(), createDiagnosticsSnapshot: vi.fn() }) as EndgeVue_Module
    module.setup()
    module.build()
    expect(Endge.uiRegistry.adapters.active?.id).toBe('vue')

    const node: RComponentSFC_IR_ElementNode = {
      id: 'input',
      kind: 'element',
      tag: 'Input',
      props: {},
      directives: {},
      children: [],
    }
    const render = () => renderSFCNode(h, node, createSFCVueRenderContext({}))
    expect(render()).toBe('app default')

    const reference = { identity: 'catalog-fixture', version: '1.0.1', rendererId: 'preview' }
    const scope = new RuntimeScope({ id: 'renderer-workspace', path: 'renderer-workspace' })
    const workspaceScope = vi.spyOn(Endge.runtime, 'workspaceModuleScope', 'get').mockReturnValue(scope)
    const modules = Endge.runtime.modules
    modules.setup(createLocalModuleLoader([{
      reference,
      artifact: {
        create: () => new class extends EndgeModule<ScopedModuleContext> {
          override setup(context: ScopedModuleContext): void {
            registerNamedScopedVueRenderer(context, 'Input', 'preview', () => 'catalog version')
          }
        }(),
      },
    }]))
    try {
      await scope.activate()
      await modules.attach(scope, workspaceRendererAttachment(reference), reference)
      Endge.workspace.apply({
        ...TEST_WORKSPACE,
        configuration: { ...TEST_WORKSPACE.configuration, defaultRenderers: { Input: reference } },
      })
      expect(render()).toBe('catalog version')

      Endge.workspace.apply(TEST_WORKSPACE)
      expect(render()).toBe('app default')
    }
    finally {
      workspaceScope.mockRestore()
      await scope.dispose()
      modules.setup(undefined)
    }
  })

  it('повторный start после reset не объявляет фазу watch заново (смена фасета)', () => {
    const module = new EndgeVue_Module()
    module.setup()
    module.build()
    module.start()
    const watchPhases = () => Raph.phases.filter(phase => phase.name === 'watch').length
    expect(watchPhases()).toBe(1)
    // switchContext: reset + start; после первого кадра Raph запрещает definePhases.
    Raph.flush()
    module.reset()
    expect(() => module.start()).not.toThrow()
    expect(watchPhases()).toBe(1)
    module.reset()
  })

  it('завершается ошибкой до запуска runtime, если выбранный адаптер не зарегистрирован', () => {
    const module = new EndgeVue_Module()
    module.setup()
    Endge.workspace.apply({
      ...TEST_WORKSPACE,
      configuration: {
        ...TEST_WORKSPACE.configuration,
        sfcAdapterIds: ['customer-aodb'],
        defaultSfcAdapterId: 'customer-aodb',
      },
    })

    expect(() => module.build()).toThrow(
      'adapter "customer-aodb" is not registered. Registered adapters: vue',
    )
  })

  it('направляет визуальные примитивы через выбранный адаптер', () => {
    const module = new EndgeVue_Module()
    const customerAdapter: SFCVueRenderAdapter = {
      ...NativeVueSFCAdapter,
      id: 'customer-aodb',
      renderers: {
        ...NativeVueSFCAdapter.renderers,
        Input: input => input.h('customer-input', {
          ...input.attrs,
          value: input.props.value,
        }),
      },
    }
    module.setup()
    Endge.uiRegistry.adapters.register(customerAdapter)
    Endge.workspace.apply({
      ...TEST_WORKSPACE,
      configuration: {
        ...TEST_WORKSPACE.configuration,
        sfcAdapterIds: ['vue-native', 'customer-aodb'],
        defaultSfcAdapterId: 'customer-aodb',
      },
    })
    module.build()

    const node: RComponentSFC_IR_ElementNode = {
      id: 'custom-input',
      kind: 'element',
      tag: 'Input',
      props: {
        value: { kind: 'literal', value: 'SU 1402' },
      },
      directives: {},
      children: [],
    }
    const rendered = renderSFCNode(h, node, createSFCVueRenderContext({}))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) {
      return
    }
    expect(rendered.type).toBe('customer-input')
    expect(rendered.props?.value).toBe('SU 1402')
  })
})
