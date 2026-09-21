import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import { SFCRenderInspectionSession } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  registerSFCInspectionDefinitionTree,
  registerSFCInspectionElement,
  registerSFCInspectionRoot,
} from '@/services/render/sfc/SFCVueRenderInspection'
import { createSFCVueRenderContext, extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'

describe('инспекция render SFC Vue', () => {
  it('сохраняет одну ветвь шаблона таблицы и изолирует конкретные экземпляры строк', () => {
    const session = new SFCRenderInspectionSession()
    const context = createSFCVueRenderContext(
      { rows: [{ id: 'SU-100', status: 'boarding' }] },
      0,
      null,
      null,
      ['flight-table'],
      'root',
      undefined,
      undefined,
      session,
    )
    context.inspectionParentId = registerSFCInspectionRoot(context)

    const table = element('table', 'Table', [
      element('column-status', 'Column', [
        element('cell-status', 'Cell', [element('status-badge', 'Badge')]),
      ]),
    ])
    const tableId = registerSFCInspectionElement(table, { rows: context.props.rows }, context)
    const templateContext = { ...context, inspectionParentId: tableId }
    const column = table.children[0] as RComponentSFC_IR_ElementNode
    const cell = column.children[0] as RComponentSFC_IR_ElementNode
    const badge = cell.children[0] as RComponentSFC_IR_ElementNode
    registerSFCInspectionDefinitionTree(column, templateContext)

    const firstCellContext = extendSFCVueRenderContext(context, {
      row: { id: 'SU-100', status: 'boarding' },
      rowKey: 'SU-100',
      columnKey: 'status',
      value: 'boarding',
    }, null, 'root/table:table/row:SU-100/column:status')
    firstCellContext.inspectionParentId = tableId
    const secondCellContext = extendSFCVueRenderContext(context, {
      row: { id: 'SU-200', status: 'departed' },
      rowKey: 'SU-200',
      columnKey: 'status',
      value: 'departed',
    }, null, 'root/table:table/row:SU-200/column:status')
    secondCellContext.inspectionParentId = tableId

    const firstId = registerSFCInspectionElement(badge, { value: 'boarding' }, firstCellContext)
    const secondId = registerSFCInspectionElement(badge, { value: 'departed' }, secondCellContext)

    expect(firstId).not.toBe(secondId)
    expect(session.getNode(firstId!)).toMatchObject({
      scope: expect.stringContaining('row:SU-100'),
      locals: { rowKey: 'SU-100', columnKey: 'status', value: 'boarding' },
    })
    const tree = session.getTree()
    expect(tree).toHaveLength(1)
    expect(tree[0]?.children[0]?.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ tag: 'Column', meta: { definition: true } }),
      expect.objectContaining({ id: firstId }),
      expect.objectContaining({ id: secondId }),
    ]))
  })
})

function element(
  id: string,
  tag: RComponentSFC_IR_ElementNode['tag'],
  children: RComponentSFC_IR_ElementNode[] = [],
): RComponentSFC_IR_ElementNode {
  return {
    id,
    kind: 'element',
    tag,
    props: {},
    directives: {},
    children,
  }
}
