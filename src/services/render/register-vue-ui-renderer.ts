import type { UIComponentRendererRegistration } from '@endge/core'
import type { Component } from 'vue'

import { Endge } from '@endge/core'
import { markRaw } from 'vue'

export interface VueUIComponentRendererRegistration extends Omit<UIComponentRendererRegistration, 'component'> {
  component: Component
}

/** Регистрирует Vue renderer, не передавая Vue-реактивность в Core registry. */
export function registerVueUIRenderer(input: VueUIComponentRendererRegistration): void {
  Endge.uiRegistry.registerRenderer({
    ...input,
    component: markRaw(input.component),
  })
}
