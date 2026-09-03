import type { RComponentSFC_IR_ElementNode, RComponentSFC_IR_Value } from '@endge/core'
import type { VNode } from 'vue'
import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h, isVNode } from 'vue'

import { NativeVueSFCAdapter } from '@/services/render/sfc/native-vue-sfc-adapter'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-vue-render.type'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

describe('sFC Table layout', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  afterEach(() => Endge.uiRegistry.adapters.reset())

  it('fills the available height by default', () => {
    const table = renderTable()

    expect(table.props?.['data-endge-layout-fill-height']).toBe('')
    expect(table.props?.style).toMatchObject({
      width: '100%',
      height: '100%',
      minHeight: '180px',
      flex: '1 1 0%',
      overflow: 'hidden',
    })
  })

  it('keeps an explicit height as an opt-out from fill layout', () => {
    const table = renderTable({ height: 420, minHeight: 120 })

    expect(table.props?.['data-endge-layout-fill-height']).toBeUndefined()
    expect(table.props?.style).toMatchObject({
      height: '420px',
      minHeight: '120px',
    })
    expect(table.props?.style?.flex).toBeUndefined()
  })

  it('enables paging by default and forwards the lazy marker', () => {
    const table = renderTable({ lazy: true })
    const grid = table.children as VNode[]

    expect(grid[0]?.props).toMatchObject({
      paging: 'pages',
      pageSize: 10,
      pageSizes: [10, 25, 50, 100],
      lazy: true,
    })
  })

  it('forwards virtual paging without changing the local data contract', () => {
    const table = renderTable({ paging: 'virtual' })
    const grid = table.children as VNode[]

    expect(grid[0]?.props).toMatchObject({
      paging: 'virtual',
      pageSize: 10,
      pageSizes: [10, 25, 50, 100],
      lazy: false,
    })
  })

  it('forwards Table Event boundary and selection mode to the native renderer', () => {
    const table = renderTable({ 'selection-mode': 'multiple', 'ref': 'table' })
    const grid = table.children as VNode[]

    expect(grid[0]?.props).toMatchObject({
      nodeId: 'test-table',
      tableRef: 'table',
      selectionMode: 'multiple',
    })
  })

  it('resolves Column metadata from the current component artifact when host metadata belongs to its owner', () => {
    const column: RComponentSFC_IR_ElementNode = {
      id: 'test-table-column',
      kind: 'element',
      tag: 'Column',
      props: {
        key: literal('fueling'),
      },
      directives: {},
      children: [],
    }
    const tableNode: RComponentSFC_IR_ElementNode = {
      id: 'test-table',
      kind: 'element',
      tag: 'Table',
      props: {
        rows: literal([]),
      },
      directives: {},
      children: [column],
    }
    const context = createSFCVueRenderContext({})
    context.componentStack = ['groundhandling-tgo-table']
    context.metadata = { self: {}, nodes: [] }
    context.host = {
      getArtifactReader: () => ({
        getArtifact: () => ({
          metadata: {
            self: {},
            nodes: [{
              nodeId: column.id,
              nodeKind: 'Column',
              key: 'fueling',
              values: {
                'groundhandling.process': {
                  version: 1,
                  critical: true,
                },
              },
            }],
          },
        }),
      }),
    } as any

    const rendered = renderSFCNode(h, tableNode, context)
    if (!isVNode(rendered)) {
      throw new Error('Table did not render a VNode')
    }

    const grid = (rendered.children as VNode[])[0]
    expect(grid?.props?.columns[0]?.metadata).toEqual({
      'groundhandling.process': {
        version: 1,
        critical: true,
      },
    })
  })
})

function renderTable(props: Record<string, unknown> = {}): VNode {
  const node: RComponentSFC_IR_ElementNode = {
    id: 'test-table',
    kind: 'element',
    tag: 'Table',
    props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, literal(value)])),
    directives: {},
    children: [],
  }
  const result = renderSFCNode(h, node, createSFCVueRenderContext({}))

  if (!isVNode(result)) {
    throw new Error('Table did not render a VNode')
  }
  return result
}

function literal(value: unknown): RComponentSFC_IR_Value {
  return { kind: 'literal', value }
}
