import { describe, expect, it } from 'vitest'

import {
  createInitialTableVisibility,
  filterVisibleTableColumns,
} from '@/ui/render/sfc/SFCRender_Table'

describe('видимость таблицы RevoGrid SFC', () => {
  const columns = [
    { key: 'flight' },
    { key: 'gate' },
    { key: 'status' },
  ]

  it('создаёт разреженную map видимости из ключей default-hidden', () => {
    expect(createInitialTableVisibility(['gate', 'missing'], columns)).toEqual({
      gate: false,
    })
  })

  it('сохраняет видимые столбцы в исходном порядке', () => {
    expect(filterVisibleTableColumns(columns, { gate: false })).toEqual([
      { key: 'flight' },
      { key: 'status' },
    ])
  })
})
