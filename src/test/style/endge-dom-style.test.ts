import { compileEndgeCSS } from '@endge/core'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

import { materializeEndgeCSSForDOM } from '@/services/style/endge-dom-style'

describe('материализатор EndgeCSS для DOM', () => {
  it('выводит разбираемый CSS в нейтральном порядке каскада', () => {
    const artifact = compileEndgeCSS(`
      .status { color: blue; }
      Text { color: gray; }
      Text { color: red !important; }
      @theme dark { --surface: #111; .status { background: var(--surface); } }
    `).artifact!
    const result = materializeEndgeCSSForDOM([artifact])
    const parsed = postcss.parse(result.css)
    expect(parsed.nodes.length).toBeGreaterThan(0)
    expect(result.css).toContain(':root[data-endge-theme="dark"]')
    expect(result.css.lastIndexOf('!important')).toBeGreaterThan(result.css.lastIndexOf('color:blue'))
  })

  it('использует нативные семантические selectors с равномерной ненулевой специфичностью', () => {
    const artifact = compileEndgeCSS('Table::part(header-content) { color: white; }').artifact!
    const result = materializeEndgeCSSForDOM([artifact])

    expect(result.classes).toEqual([])
    expect(result.css).toContain('[data-endge-tag="Table"]')
    expect(result.css).toContain('[data-endge-part~="header-content"]')
    expect(result.css).toContain(':is([data-endge-node],[data-endge-part])')
  })

  it('включает DOM-правила, исключает canvas-правила и предупреждает о неизвестных возможностях', () => {
    const artifact = compileEndgeCSS(`
      @supports renderer(dom) { Text { color: green; } }
      @supports renderer(canvas) { Text { color: orange; } }
      @supports capability(print) { Text { color: black; } }
    `).artifact!
    const result = materializeEndgeCSSForDOM([artifact], { renderer: 'dom', capabilities: [] })
    expect(result.css).toContain('green')
    expect(result.css).not.toContain('orange')
    expect(result.css).not.toContain('black')
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ENDGECSS_CAPABILITY_UNAVAILABLE' }))
  })

  it('преобразует комбинаторы, структурные pseudo и markers состояния для браузера', () => {
    const artifact = compileEndgeCSS('Flex > Text:nth-child(even):state(delayed) { color: red; }').artifact!
    const css = materializeEndgeCSSForDOM([artifact]).css
    expect(css).toContain('[data-endge-tag="Flex"] > [data-endge-tag="Text"]:nth-child(even)[data-endge-state~="delayed"]')
  })
})
