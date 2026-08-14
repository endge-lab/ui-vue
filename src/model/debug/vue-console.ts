import type { App } from 'vue'

/**
 * Prevents Vue's default warning formatter from passing component instances
 * to Console. DevTools otherwise retains the full runtime graph referenced by
 * props and setup state until the console is cleared.
 */
export function installEndgeVueWarnHandler(app: App): void {
  app.config.warnHandler = (message, _instance, trace) => {
    const suffix = trace ? `\n${trace}` : ''
    console.warn(`[Vue warn] ${message}${suffix}`)
  }
}
