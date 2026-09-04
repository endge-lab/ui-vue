import type { EndgeStylePlacement } from '@endge/core'
import { compileEndgeCSS } from '@endge/core'
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { materializeEndgeCSSForDOM } from '@/services/style/endge-dom-style'
import { EndgeDOMStyleRuntime } from '@/services/style/EndgeDOMStyleRuntime'

describe('проверка Runtime-размещения DOM-стилей', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-endge-styles]').forEach(element => element.remove())
    document.body.replaceChildren()
  })

  it('изолирует полученный артефакт границей scope runtime', () => {
    const artifact = compileEndgeCSS('.cell { color: red; }', { identity: 'theme' }).artifact!
    const placement: EndgeStylePlacement = {
      id: 'placement',
      artifactIdentity: 'theme',
      artifact,
      ownerScopeIds: ['scope:a'],
      boundaryId: 'scope:a',
      orderKey: '0001:theme',
      state: 'active',
      referenceCount: 1,
    }
    const css = materializeEndgeCSSForDOM([placement]).css
    expect(css).toContain('[data-endge-runtime-scope~="scope:a"]')
    expect(css).toContain('color:red')
  })

  it('сохраняет порядок Source независимым от порядка input активации через предварительную сортировку orderKey', () => {
    const first = compileEndgeCSS('.cell { color: red; }', { identity: 'first' }).artifact!
    const second = compileEndgeCSS('.cell { color: blue; }', { identity: 'second' }).artifact!
    const placement = (artifact: typeof first, orderKey: string): EndgeStylePlacement => ({
      id: `${artifact.identity}:${orderKey}`,
      artifactIdentity: artifact.identity,
      artifact,
      ownerScopeIds: ['scope'],
      boundaryId: 'scope',
      orderKey,
      state: 'active',
      referenceCount: 1,
    })
    const css = materializeEndgeCSSForDOM([placement(first, '01'), placement(second, '02')]).css
    expect(css.indexOf('color:red')).toBeLessThan(css.indexOf('color:blue'))
  })

  it('скрывает приостановленные границы runtime без уничтожения DOM', () => {
    const runtime = new EndgeDOMStyleRuntime()
    runtime.update([], { renderer: 'dom', capabilities: [] }, ['scope:paused'])
    expect(document.querySelector('style[data-endge-styles]')?.textContent).toContain(
      '[data-endge-runtime-scope~="scope:paused"]{display:none!important;}',
    )
    runtime.reset()
    expect(document.querySelector('style[data-endge-styles]')).toBeNull()
  })

  it('применяет, приостанавливает и удаляет полученный стиль через управляемый stylesheet', () => {
    const artifact = compileEndgeCSS('.cell { color: rgb(255, 0, 0); }', { identity: 'theme' }).artifact!
    const placement: EndgeStylePlacement = {
      id: 'placement',
      artifactIdentity: 'theme',
      artifact,
      ownerScopeIds: ['scope:page'],
      boundaryId: 'scope:page',
      orderKey: '0001:theme',
      state: 'active',
      referenceCount: 1,
    }
    const boundary = document.createElement('section')
    boundary.dataset.endgeRuntimeScope = 'scope:page'
    const cell = document.createElement('div')
    cell.className = 'cell'
    cell.dataset.endgeNode = 'cell'
    boundary.append(cell)
    document.body.append(boundary)
    const runtime = new EndgeDOMStyleRuntime()

    runtime.update([placement], { renderer: 'dom', capabilities: [] })
    expect(getComputedStyle(cell).color).toBe('rgb(255, 0, 0)')

    runtime.update([placement], { renderer: 'dom', capabilities: [] }, ['scope:page'])
    expect(getComputedStyle(boundary).display).toBe('none')

    runtime.update([], { renderer: 'dom', capabilities: [] })
    expect(getComputedStyle(cell).color).not.toBe('rgb(255, 0, 0)')
    runtime.reset()
  })
})
