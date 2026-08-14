import { describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'

import { installEndgeVueWarnHandler } from '@/model/debug/vue-console'
import SFC_RuntimeRenderer from '@/ui/render/sfc/SFC_RuntimeRenderer.vue'

describe('Vue console memory safety', () => {
  it('does not inherit DOM attributes through the fragment runtime renderer', () => {
    expect((SFC_RuntimeRenderer as { inheritAttrs?: boolean }).inheritAttrs).toBe(false)
  })

  it('formats warnings without forwarding the component instance', () => {
    const app = { config: {} } as App
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    installEndgeVueWarnHandler(app)
    const instance = { props: { rows: Array.from({ length: 100 }, () => ({ value: 'large' })) } }

    app.config.warnHandler?.('broken attrs', instance as never, 'at <HeavyTable>')

    expect(warn).toHaveBeenCalledWith('[Vue warn] broken attrs\nat <HeavyTable>')
    expect(warn.mock.calls.flat()).not.toContain(instance)
    warn.mockRestore()
  })
})
