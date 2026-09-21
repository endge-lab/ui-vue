/** @vitest-environment jsdom */
import { compileEndgeCSS } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import { materializeEndgeCSSForDOM } from '@/services/style/endge-dom-style'
import { EndgeDOMStyleRuntime } from '@/services/style/EndgeDOMStyleRuntime'

describe('применение EndgeCSS к DOM', () => {
  afterEach(() => {
    document.head.querySelectorAll('[data-endge-test-style]').forEach(element => element.remove())
    document.body.replaceChildren()
  })

  it('применяет сгенерированный CSS и сохраняет приоритет important в CSSOM', () => {
    const artifact = compileEndgeCSS('Text { color: rgb(255, 0, 0) !important; }').artifact!
    const style = document.createElement('style')
    style.dataset.endgeTestStyle = ''
    style.textContent = materializeEndgeCSSForDOM([artifact]).css
    document.head.append(style)
    const element = document.createElement('span')
    element.dataset.endgeNode = 'text'
    element.dataset.endgeTag = 'Text'
    document.body.append(element)
    expect(getComputedStyle(element).color).toBe('rgb(255, 0, 0)')
    expect(style.sheet?.cssRules[0] && (style.sheet.cssRules[0] as CSSStyleRule).style.getPropertyPriority('color')).toBe('important')
  })

  it('позволяет DOM вычислять физическую позицию child без JS-поверхностей стилей', () => {
    const artifact = compileEndgeCSS('Flex > Text:nth-child(even):state(delayed) { color: rgb(255, 0, 0); }').artifact!
    const style = document.createElement('style')
    style.textContent = materializeEndgeCSSForDOM([artifact]).css
    document.head.append(style)
    const parent = document.createElement('div')
    parent.dataset.endgeNode = 'flex'
    parent.dataset.endgeTag = 'Flex'
    for (let index = 0; index < 3; index++) {
      const child = document.createElement('span')
      child.dataset.endgeNode = `text-${index}`
      child.dataset.endgeTag = 'Text'
      child.dataset.endgeState = 'delayed'
      parent.append(child)
    }
    document.body.append(parent)
    expect(getComputedStyle(parent.children[0]).color).not.toBe('rgb(255, 0, 0)')
    expect(getComputedStyle(parent.children[1]).color).toBe('rgb(255, 0, 0)')
  })

  it('атомарно повторно использует один управляемый fallback-элемент style', () => {
    const runtime = new EndgeDOMStyleRuntime()
    runtime.update([compileEndgeCSS('Text { color: red; }').artifact!], { renderer: 'dom' })
    runtime.update([compileEndgeCSS('Text { color: blue; }').artifact!], { renderer: 'dom' })
    const styles = document.head.querySelectorAll('style[data-endge-styles]')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toContain('blue')
    runtime.reset()
    expect(document.head.querySelector('style[data-endge-styles]')).toBeNull()
  })
})
