import type { EndgeRuntimeContextSnapshot } from '@endge/core'
import type { VNode } from 'vue'
import { Endge } from '@endge/core'
import { beforeEach, vi } from 'vitest'
import { isVNode } from 'vue'

const TEST_RUNTIME_CONTEXT: EndgeRuntimeContextSnapshot = {
  workspace: null,
  tenant: null,
  project: null,
  environment: null,
  user: null,
  locale: 'ru',
  theme: 'light',
  timezone: 'local',
  config: Object.freeze({}) as EndgeRuntimeContextSnapshot['config'],
  input: {
    keyboard: {
      platform: 'unknown',
      modifiers: {
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
        mod: false,
        altGraph: false,
      },
      held: {
        key: [],
        code: [],
      },
    },
  },
}

/** Изолирует unit-тесты render adapter от обязательного boot приложения. */
beforeEach(() => {
  vi.spyOn(Endge.context, 'runtimeSnapshot').mockReturnValue(TEST_RUNTIME_CONTEXT)
})

/** Возвращает фактическое содержимое локальной editable boundary. */
export function renderEditableBoundaryContent(rendered: unknown): VNode {
  if (!isVNode(rendered)) {
    throw new TypeError('Editable boundary did not render a VNode')
  }
  const slot = (rendered.children as { default?: () => unknown } | null)?.default
  if (!slot) {
    return rendered
  }
  const content = slot()
  const candidate = Array.isArray(content) ? content[0] : content
  if (!isVNode(candidate)) {
    throw new TypeError('Editable boundary did not render VNode content')
  }
  return candidate
}
