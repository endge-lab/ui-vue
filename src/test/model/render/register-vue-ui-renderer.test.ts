import { Endge } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { registerVueUIRenderer } from '@/model/render/register-vue-ui-renderer'

describe('регистрация Vue renderer', () => {
  /** Проверяет, что Vue component помечается raw до передачи в Core. */
  it('изолирует component от Vue reactivity на границе adapter', () => {
    const component = { name: 'TestRenderer' }
    const register = vi.spyOn(Endge.uiRegistry, 'registerRenderer').mockImplementation(() => {})

    registerVueUIRenderer({
      ref: 'test.renderer',
      definitionRef: 'ui.text',
      surface: 'runtime',
      role: 'main',
      component,
    })

    expect(register).toHaveBeenCalledOnce()
    expect(register.mock.calls[0][0].component).toBe(component)
    expect(reactive(register.mock.calls[0][0].component as object)).toBe(component)
    register.mockRestore()
  })
})
