import type { ContextMenuDescriptor, RuntimeActionContext } from '@endge/core'
import { Endge } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  closeEndgeContextMenu,
  executeEndgeContextMenuItem,
  getExecutableContextMenuItems,
  openEndgeContextMenu,
} from '@/ui/overlay/context-menu-manager'

const menu: ContextMenuDescriptor = {
  kind: 'context-menu',
  items: [{ kind: 'item', id: 'test.run', action: 'test.run', label: 'Run', input: { rowId: '42' } }],
}

let disposeDefinition: VoidFunction | null = null
let disposeProvider: VoidFunction | null = null

describe('выполнение Action контекстного меню', () => {
  afterEach(() => {
    disposeProvider?.()
    disposeDefinition?.()
    disposeProvider = null
    disposeDefinition = null
    closeEndgeContextMenu()
  })

  it('фильтрует и выполняет элементы через Endge.runtime.actions', async () => {
    const execute = vi.fn()
    const context: RuntimeActionContext = { surface: 'test' }
    disposeDefinition = Endge.actions.define({
      identity: 'test.run',
      origin: { kind: 'local', owner: 'test' },
      defaultProviderKey: 'test.run.provider',
    })
    disposeProvider = Endge.actions.provide({
      identity: 'test.run',
      key: 'test.run.provider',
      origin: { kind: 'local', owner: 'test' },
      execute: invocation => execute(invocation.context, invocation.input),
    })
    openEndgeContextMenu({ ownerId: 'owner', x: 0, y: 0, menu, context })

    expect(getExecutableContextMenuItems()).toEqual(menu.items)
    await executeEndgeContextMenuItem(menu.items[0] as Extract<typeof menu.items[number], { kind: 'item' }>)

    expect(execute).toHaveBeenCalledWith(context, { rowId: '42' })
  })
})
