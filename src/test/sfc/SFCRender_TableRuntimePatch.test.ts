import { describe, expect, it } from 'vitest'

import { applyRowSnapshots } from '@/ui/render/sfc/SFCRender_Table'

describe('проверка Runtime-изменения строк Table SFC', () => {
  it('применяет обновление по ключу, удаление и упорядоченную вставку в одном клоне коллекции', () => {
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
