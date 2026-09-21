import { describe, expect, it } from 'vitest'

import { normalizeSFCTableCellAlignment } from '@/ui/render/sfc/SFCRender_TableAlignment'

describe('выравнивание ячеек Table SFC', () => {
  it('нормализует явное выравнивание center и middle', () => {
    expect(normalizeSFCTableCellAlignment('center', 'middle')).toEqual({
      horizontal: 'center',
      vertical: 'middle',
    })
  })

  it('поддерживает все краевые выравнивания без DOM-специфичных значений', () => {
    expect(normalizeSFCTableCellAlignment('right', 'bottom')).toEqual({
      horizontal: 'right',
      vertical: 'bottom',
    })
    expect(normalizeSFCTableCellAlignment('left', 'top')).toEqual({
      horizontal: 'left',
      vertical: 'top',
    })
  })

  it('сохраняет обратно совместимые значения по умолчанию для отсутствующих или некорректных значений', () => {
    expect(normalizeSFCTableCellAlignment(undefined, undefined)).toEqual({
      horizontal: 'left',
      vertical: 'middle',
    })
    expect(normalizeSFCTableCellAlignment('wide', 'center')).toEqual({
      horizontal: 'left',
      vertical: 'middle',
    })
  })

  it('нормализует регистр и окружающие пробелы', () => {
    expect(normalizeSFCTableCellAlignment(' Center ', ' BOTTOM ')).toEqual({
      horizontal: 'center',
      vertical: 'bottom',
    })
  })
})
