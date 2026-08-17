import { describe, expect, it } from 'vitest'

import { applyRowSnapshots } from '@/ui/render/sfc/SFCRender_Table'

describe('SFC Table runtime row patches', () => {
  it('applies a keyed update, removal and ordered insertion in one collection clone', () => {
    const source = [
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
    ]

    const result = applyRowSnapshots(source, [
      { itemIndex: 0, itemKey: 1, itemSnapshot: { id: 1, label: 'AA' } },
      { itemIndex: null, itemKey: 2, itemSnapshot: null },
      { itemIndex: 1, itemKey: 4, itemSnapshot: { id: 4, label: 'D' } },
    ], 'id')

    expect(result).toEqual([
      { id: 1, label: 'AA' },
      { id: 4, label: 'D' },
      { id: 3, label: 'C' },
    ])
    expect(source).toEqual([
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
    ])
  })
})
