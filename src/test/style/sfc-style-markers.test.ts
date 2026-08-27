import type { SFCTableMarkers } from '@/ui/render/sfc/SFCRender_TableStyle'
import {
  compileComponentSFC,
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
} from '@endge/core'
import { beforeAll, describe, expect, it } from 'vitest'

import { h, isVNode } from 'vue'
import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'
import { normalizeSFCTableRows } from '@/ui/render/sfc/SFCRender_Table'

describe('sFC EndgeCSS runtime markers', () => {
  beforeAll(() => {
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  it('normalizes id, class, state and part without generated matching classes', () => {
    const compiled = compileComponentSFC(`<template>
      <Text id="status" class="flight-card" state="delayed selected" part="status">Delayed</Text>
    </template>
    <style scoped lang="endgecss">
      #status.flight-card:state(delayed)::part(status) { color: red; }
    </style>`, { identity: 'flight-board' })
    const ir = compiled.ir!
    const rendered = renderSFCNode(h, ir.template.roots[0], createSFCVueRenderContext({}, 0, null, ir))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) {
      return
    }
    expect(rendered.props?.['data-endge-id']).toBe('status')
    expect(rendered.props?.['data-endge-state']).toBe('delayed selected')
    expect(rendered.props?.part).toBe('status')
    expect(rendered.props?.['data-endge-scope-root']).toBe(ir.style?.scopeId)
    expect(String(rendered.props?.class)).toContain('flight-card')
    expect(String(rendered.props?.class)).not.toContain('endge-es-')
  })

  it('exposes the complete Table structural style contract', () => {
    const compiled = compileComponentSFC(`<template>
      <Table id="groundhandling-control" :rows="[]">
        <Column key="aircraft" title="ВС"><Text>RA-00001</Text></Column>
      </Table>
    </template>
    <style scoped lang="endgecss">
      #groundhandling-control::part(grid) { background-color: white; }
      #groundhandling-control::part(header) { background-color: #1e3a5f; }
      #groundhandling-control::part(header-cell) { border-right: 1px solid gray; }
      #groundhandling-control::part(header-content) { color: white; }
      #groundhandling-control::part(body) { background-color: white; }
      #groundhandling-control:nth-child(even)::part(row) { background-color: #eee; }
      #groundhandling-control::part(cell) { border-bottom: 1px solid gray; }
      #groundhandling-control::part(cell-content) { color: #222; }
      #groundhandling-control::part(group-row) { font-weight: 700; }
    </style>`, { identity: 'ground-handling-table' })
    const ir = compiled.ir!
    const rendered = renderSFCNode(h, ir.template.roots[0], createSFCVueRenderContext({}, 0, null, ir))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered) || !Array.isArray(rendered.children)) {
      return
    }

    const grid = rendered.children[0]
    expect(isVNode(grid)).toBe(true)
    if (!isVNode(grid)) {
      return
    }

    const markers = grid.props?.styleMarkers as SFCTableMarkers
    const column = (grid.props?.columns as any[])[0]
    expect(markers.grid).toMatchObject({ 'part': 'grid', 'data-endge-part': 'grid' })
    expect(markers.grid['data-endge-id']).toBe('groundhandling-control')
    expect(markers.grid.id).toBeUndefined()
    expect(markers.header).toMatchObject({ 'part': 'header', 'data-endge-part': 'header' })
    expect(markers.body).toMatchObject({ 'part': 'body', 'data-endge-part': 'body' })
    expect(markers.groupRow).toMatchObject({ 'part': 'group-row', 'data-endge-part': 'group-row' })
    expect(column.markers.headerCell).toMatchObject({
      'part': 'header-cell',
      'data-endge-part': 'header-cell',
    })
    expect(column.markers.headerContent).toMatchObject({
      'part': 'header-content',
      'data-endge-part': 'header-content',
    })

    expect(column.markers.cell).toMatchObject({
      'part': 'cell',
      'data-endge-part': 'cell',
    })
    expect(column.markers.cellContent).toMatchObject({
      'part': 'cell-content',
      'data-endge-part': 'cell-content',
    })
    expect(markers.grid.class).toEqual([])
    expect(markers.header.class).toEqual([])
    expect(markers.body.class).toEqual([])
    expect(markers.groupRow.class).toEqual([])
    expect(column.markers.headerCell.class).toEqual([])
    expect(column.markers.headerContent.class).toEqual([])
  })

  it('keeps 10k-row objects untouched and creates no cell style cache', () => {
    const compiled = compileComponentSFC(`<template>
      <Table id="large-schedule" :rows="[]">
        <Column key="flight" title="Flight"><Text>GH0967</Text></Column>
      </Table>
    </template>
    <style scoped lang="endgecss">
      #large-schedule:nth-child(even)::part(row) { background-color: #eee; }
      #large-schedule::part(cell) { border-bottom: 1px solid gray; }
      #large-schedule::part(cell-content) { color: #222; }
    </style>`, { identity: 'large-schedule' })
    const ir = compiled.ir!
    const rendered = renderSFCNode(h, ir.template.roots[0], createSFCVueRenderContext({}, 0, null, ir))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered) || !Array.isArray(rendered.children)) {
      return
    }
    const grid = rendered.children[0]
    expect(isVNode(grid)).toBe(true)
    if (!isVNode(grid)) {
      return
    }

    const source = Array.from({ length: 10_000 }, (_, index) => ({ id: index }))
    const rows = normalizeSFCTableRows(source)
    expect(rows).toHaveLength(10_000)
    expect(rows[9_999]).toBe(source[9_999])
    expect(Object.getOwnPropertySymbols(rows[0])).toHaveLength(0)
  })

  it('wraps primitive rows without creating style metadata', () => {
    const rows = normalizeSFCTableRows(['first', 2])
    expect(rows).toEqual([{ id: 0, value: 'first' }, { id: 1, value: 2 }])
    expect(Object.getOwnPropertySymbols(rows[0])).toHaveLength(0)
  })
})
