import type { EndgeWorkspaceDefinition, RComponentSFC_IR_ElementNode } from '@endge/core'
import type { SFCVueRenderAdapter } from '@/services/render/sfc/sfc-vue-render.type'
import { Endge } from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { h, isVNode } from 'vue'
import { EndgeVue_Module } from '@/modules/EndgeVue_Module'
import { NativeVueSFCAdapter } from '@/services/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

const TEST_WORKSPACE: EndgeWorkspaceDefinition = {
  identity: 'workspace-test',
  displayName: 'Test Workspace',
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

describe('endgeVueModule SFC adapter', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
  })

  afterEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
  })

  it('registers and activates vue-native for the selected workspace', () => {
    const module = new EndgeVue_Module()

    module.setup()
    module.build()

    expect(Endge.uiRegistry.adapters.active?.id).toBe(NativeVueSFCAdapter.id)
  })

  it('fails before runtime start when selected adapter is not registered', () => {
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
      'adapter "customer-aodb" is not registered. Registered adapters: vue-native',
    )
  })

  it('dispatches visual primitives through the selected adapter', () => {
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
