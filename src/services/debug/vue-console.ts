import type { App } from 'vue'

/**
 * Не позволяет стандартному форматтеру предупреждений Vue передавать экземпляры
 * компонентов в Console. Иначе DevTools удерживает весь runtime-граф из props
 * и состояния setup до очистки консоли.
 */
export function installEndgeVueWarnHandler(app: App): void {
  app.config.warnHandler = (message, _instance, trace) => {
    const suffix = trace ? `\n${trace}` : ''
    console.warn(`[Vue warn] ${message}${suffix}`)
  }
}
