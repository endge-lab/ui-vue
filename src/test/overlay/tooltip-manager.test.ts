// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EndgeVueTooltipManager } from '@/ui/overlay/tooltip/endge-tooltip-manager'

describe('менеджер tooltip Endge Vue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('создаёт содержимое только после openDelay и освобождает после closeDelay', () => {
    const anchor = document.createElement('button')
    document.body.append(anchor)
    const renderContent = vi.fn(() => 'Lazy content')
    const manager = new EndgeVueTooltipManager('vue-native', {
      side: 'right',
      align: 'start',
      openDelay: 50,
      closeDelay: 20,
    })
    const request = {
      ownerId: 'row-1:status',
      domId: 'tooltip-1',
      anchor,
      kind: 'text' as const,
      renderContent,
    }

    manager.activate(request, 'pointer')
    expect(manager.state.phase).toBe('pending')
    expect(renderContent).not.toHaveBeenCalled()
    vi.advanceTimersByTime(49)
    expect(renderContent).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(manager.state.content).toBe('Lazy content')
    expect(anchor.getAttribute('aria-describedby')).toBe('tooltip-1')

    manager.deactivate(request.ownerId, 'pointer')
    vi.advanceTimersByTime(19)
    expect(manager.state.phase).toBe('visible')
    vi.advanceTimersByTime(1)
    expect(manager.state.phase).toBe('idle')
    expect(manager.state.content).toBeNull()
    expect(anchor.hasAttribute('aria-describedby')).toBe(false)
  })

  it('отменяет ожидающую работу и не удерживает содержимое после dispose', () => {
    const anchor = document.createElement('span')
    document.body.append(anchor)
    const renderContent = vi.fn(() => 'never')
    const manager = new EndgeVueTooltipManager('ramax-aodb', {
      side: 'bottom',
      align: 'center',
      openDelay: 100,
      closeDelay: 0,
    })

    manager.activate({ ownerId: 'owner', domId: 'tooltip', anchor, kind: 'rich', renderContent }, 'focus')
    manager.dispose()
    vi.runAllTimers()

    expect(renderContent).not.toHaveBeenCalled()
    expect(manager.state).toMatchObject({ phase: 'idle', content: null, anchor: null })
  })
})
