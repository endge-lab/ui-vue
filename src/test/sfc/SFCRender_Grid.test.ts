import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import { Endge } from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h, isVNode } from 'vue'

import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { SFCRender_Grid } from '@/ui/render/sfc/SFCRender_Grid'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

describe('SFCRender_Grid', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate(NativeVueSFCAdapter.id)
  })

  afterEach(() => {
    Endge.uiRegistry.adapters.reset()
  })

  it('renders explicit tracks and gaps', () => {
    const rendered = SFCRender_Grid({
      h,
      props: {
        columns: '12',
        gap: '2',
        autoRows: '28px',
      },
      attrs: {},
      children: [],
    })

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.props?.style).toMatchObject({
      display: 'grid',
      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      gridAutoRows: '28px',
      gap: '8px',
    })
  })

  it('applies Grid placement props to every visual child through base attrs', () => {
    const node: RComponentSFC_IR_ElementNode = {
      id: 'grid-text',
      kind: 'element',
      tag: 'Text',
      props: {
        colStart: { kind: 'literal', value: '2' },
        colSpan: { kind: 'literal', value: '5' },
        rowStart: { kind: 'literal', value: '3' },
        rowSpan: { kind: 'literal', value: '2' },
      },
      directives: {},
      children: [{ id: 'grid-text-value', kind: 'text', value: 'Text' }],
    }

    const rendered = renderSFCNode(h, node, createSFCVueRenderContext({}))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.props?.style).toMatchObject({
      gridColumn: '2 / span 5',
      gridRow: '3 / span 2',
    })
  })
})
