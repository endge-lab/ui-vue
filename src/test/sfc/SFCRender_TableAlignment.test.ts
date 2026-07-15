import { describe, expect, it } from 'vitest'

import { normalizeSFCTableCellAlignment } from '@/ui/render/sfc/SFCRender_TableAlignment'

describe('SFC Table cell alignment', () => {
  it('normalizes explicit center and middle alignment', () => {
    expect(normalizeSFCTableCellAlignment('center', 'middle')).toEqual({
      horizontal: 'center',
      vertical: 'middle',
    })
  })

  it('supports all edge alignments without DOM-specific values', () => {
    expect(normalizeSFCTableCellAlignment('right', 'bottom')).toEqual({
      horizontal: 'right',
      vertical: 'bottom',
    })
    expect(normalizeSFCTableCellAlignment('left', 'top')).toEqual({
      horizontal: 'left',
      vertical: 'top',
    })
  })

  it('keeps backward-compatible defaults for missing or invalid values', () => {
    expect(normalizeSFCTableCellAlignment(undefined, undefined)).toEqual({
      horizontal: 'left',
      vertical: 'middle',
    })
    expect(normalizeSFCTableCellAlignment('wide', 'center')).toEqual({
      horizontal: 'left',
      vertical: 'middle',
    })
  })

  it('normalizes casing and surrounding whitespace', () => {
    expect(normalizeSFCTableCellAlignment(' Center ', ' BOTTOM ')).toEqual({
      horizontal: 'center',
      vertical: 'bottom',
    })
  })
})
