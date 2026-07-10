import type { StorageLike } from '@vueuse/core'
import { useStorage } from '@vueuse/core'
import { ref, watch } from 'vue'

let safeLocalStorage: StorageLike | undefined

function getSafeLocalStorage(): StorageLike | undefined {
  if (typeof window === 'undefined')
    return undefined

  if (!safeLocalStorage) {
    const storage = window.localStorage

    safeLocalStorage = {
      getItem: key => storage.getItem(key),
      setItem: (key, value) => storage.setItem(key, value),
      removeItem: key => storage.removeItem(key),
    }
  }

  return safeLocalStorage
}

export function useLocalStorageMap(key: string) {
  const raw = useStorage<Array<[string, any]>>(key, [], getSafeLocalStorage())

  const internal = ref(new Map<string, any>(raw.value))

  // Обновляем localStorage при изменении internal Map
  watch(
    internal,
    (newMap) => {
      const serialized = JSON.stringify(Array.from(newMap.entries()))
      const current = JSON.stringify(raw.value)
      if (serialized !== current) {
        raw.value = Array.from(newMap.entries())
      }
    },
    { deep: true },
  )

  // Синхронизация с raw (если localStorage изменился извне)
  watch(raw, (newRaw) => {
    const current = Array.from(internal.value.entries())
    const next = newRaw
    const isEqual = JSON.stringify(current) === JSON.stringify(next)
    if (!isEqual) {
      internal.value = new Map(newRaw)
    }
  })

  // Прокси с защитой от циклов
  const proxy = new Proxy(internal.value, {
    get(target, prop, receiver) {
      if (['set', 'delete', 'clear'].includes(String(prop))) {
        return (...args: Array<any>) => {
          const result = (target as any)[prop](...args)

          // Только если что-то поменялось - триггерим обновление
          internal.value = new Map(target)
          return result
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  return ref(proxy)
}
