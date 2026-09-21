import type { SubscribableLike } from '@endge/utils'
import type { ShallowRef } from 'vue'

import { onScopeDispose, shallowRef, triggerRef } from 'vue'

/** Создаёт shallow Vue ref и явную функцию отписки от framework-independent owner. */
export function useSubscribableRef<T extends SubscribableLike>(
  owner: T,
): { refObj: ShallowRef<T>, unsubscribe: () => void } {
  const refObj = shallowRef(owner) as ShallowRef<T>
  const unsubscribe = owner.subscribe(() => triggerRef(refObj))
  return { refObj, unsubscribe }
}

/** Создаёт shallow Vue ref и освобождает подписку вместе с текущим scope. */
export function useSubscribableRefAuto<T extends SubscribableLike>(owner: T): ShallowRef<T> {
  const { refObj, unsubscribe } = useSubscribableRef(owner)
  onScopeDispose(unsubscribe)
  return refObj
}
