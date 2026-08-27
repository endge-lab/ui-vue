import { Subscribable } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, watch } from 'vue'

import { useSubscribableRef, useSubscribableRefAuto } from '@/reactive/use-subscribable-ref'

describe('vue adapter для Subscribable', () => {
  /** Проверяет преобразование core-уведомления в обновление shallow ref. */
  it('обновляет ref после notify владельца', () => {
    const owner = new Subscribable()
    const { refObj, unsubscribe } = useSubscribableRef(owner)
    const listener = vi.fn()
    watch(refObj, listener, { flush: 'sync' })

    owner.notify()

    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  /** Проверяет освобождение подписки при завершении Vue scope. */
  it('отписывается вместе с Vue scope', () => {
    const owner = new Subscribable()
    const scope = effectScope()
    const refObj = scope.run(() => useSubscribableRefAuto(owner))!
    const listener = vi.fn()
    watch(refObj, listener, { flush: 'sync' })

    owner.notify()
    scope.stop()
    owner.notify()

    expect(listener).toHaveBeenCalledOnce()
  })
})
