// @vitest-environment jsdom
import type {
  TableRuntimeActionTarget,
  TableViewportChangedEvent,
} from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, shallowRef } from 'vue'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { createSFCTableStyleContract } from '@/ui/render/sfc/SFCRender_TableStyle'
import TanStackSfcDataTable from '@/ui/table/TanStackSfcDataTable.vue'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('table owns viewport, anchor and loaded-row positioning', () => {
  it('coalesces real viewport events, restores keys and releases RAF/observers', async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let frameId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    const observers: {
      callback: ResizeObserverCallback
      disconnect: ReturnType<typeof vi.fn>
      targets: Element[]
    }[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        public disconnect = vi.fn()
        public targets: Element[] = []
        public observe = vi.fn((target: Element) => this.targets.push(target))
        public unobserve = vi.fn()
        constructor(callback: ResizeObserverCallback) {
          observers.push({ callback, disconnect: this.disconnect, targets: this.targets })
        }
      },
    )
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(160)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return {
          height: this.tagName === 'THEAD' ? 32 : 160,
          width: 600,
          top: 0,
          left: 0,
          bottom: 160,
          right: 600,
          x: 0,
          y: 0,
          toJSON() {},
        }
      },
    )
    const rows = shallowRef(
      Array.from({ length: 30 }, (_, index) => ({ id: String(index) })),
    )
    const revision = shallowRef(1)
    const preserve = shallowRef(true)
    const events: TableViewportChangedEvent[] = []
    let target: TableRuntimeActionTarget | null = null
    const boundary = {
      routeChild(
        source: any,
        name: string,
        payload: TableViewportChangedEvent,
      ) {
        if (name === 'viewportChanged') {
          events.push(payload)
          target = source.target.value
        }
      },
    } as any
    const app = createApp({
      render: () =>
        h(TanStackSfcDataTable, {
          boundaryId: 'table-viewport',
          tableId: 'table-viewport',
          eventBoundary: boundary,
          runtimeState: null,
          columns: [],
          source: rows.value,
          rowsRevision: revision.value,
          preserveScrollAnchor: preserve.value,
          styleContract: createSFCTableStyleContract(
            createSFCVueRenderContext({}),
          ),
          rowKey: 'id',
          sortMode: 'disabled',
          pinMode: 'disabled',
          columnMenu: { mode: 'disabled', menu: null, diagnostics: [] },
          defaultSort: [],
          defaultPin: [],
          defaultHidden: [],
          rowSize: 20,
          paging: 'virtual',
          renderVersion: revision.value,
          renderCell: () => '',
        }),
    })
    let mounted = false
    const element = document.createElement('div')
    document.body.append(element)
    const flush = async () => {
      await nextTick()
      await nextTick()
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(performance.now()))
      await nextTick()
    }
    try {
      app.mount(element)
      mounted = true
      await flush()
      expect(events[0]).toMatchObject({
        reason: 'mount',
        rowsRevision: 1,
        firstVisible: { key: '0', index: 0 },
        lastVisible: { key: '6', index: 6 },
        rowCount: 30,
      })
      const root = element.querySelector<HTMLElement>(
        '.endge-tanstack-table__viewport',
      )!
      root.scrollTop = 45
      root.dispatchEvent(new Event('scroll'))
      root.dispatchEvent(new Event('scroll'))
      await flush()
      expect(events.at(-1)).toMatchObject({
        reason: 'scroll',
        firstVisible: { key: '2', index: 2 },
        lastVisible: { key: '8', index: 8 },
      })
      const count = events.length
      root.scrollTop = 46
      root.dispatchEvent(new Event('scroll'))
      await flush()
      expect(events).toHaveLength(count)
      rows.value = [{ id: '-2' }, { id: '-1' }, ...rows.value]
      revision.value += 1
      await flush()
      expect(root.scrollTop).toBe(86)
      expect(events.at(-1)).toMatchObject({
        reason: 'data',
        rowsRevision: 2,
        firstVisible: { key: '2', index: 4 },
      })
      // A value-only SWR update changes the revision while preserving the anchor and DOM bound.
      const renderedCount = element.querySelectorAll('[data-row-key]').length
      rows.value = rows.value.map(row => ({ ...row, label: 'revalidated' }))
      revision.value += 1
      await flush()
      expect(root.scrollTop).toBe(86)
      expect(events.at(-1)?.firstVisible).toEqual({ key: '2', index: 4 })
      expect(events.at(-1)?.rowsRevision).toBe(3)
      expect(element.querySelectorAll('[data-row-key]').length).toBe(renderedCount)
      await target!.scrollToRow!('10', 'center')
      await flush()
      expect(root.scrollTop).toBe(186)
      expect(events.at(-1)?.reason).toBe('position')
      await target!.scrollToRow!('10', 'end')
      await flush()
      expect(root.scrollTop).toBe(132)
      await target!.scrollToRow!('10', 'auto')
      await flush()
      expect(root.scrollTop).toBe(132)
      await expect(target!.scrollToRow!('missing')).rejects.toThrow(
        'not loaded',
      )
      // Missing-key fallback keeps a nearby ordinal and fractional row offset.
      root.scrollTop = 86
      rows.value = rows.value.filter(row => row.id !== '2')
      revision.value += 1
      await flush()
      expect(root.scrollTop).toBe(86)
      expect(events.at(-1)?.firstVisible).toEqual({ key: '3', index: 4 })
      observers.find(observer => observer.targets.some(target => target.tagName === 'THEAD'))!.callback([], {} as ResizeObserver)
      await flush()
      expect(events.at(-1)?.reason).toBe('resize')
      preserve.value = false
      rows.value = [...rows.value, { id: 'new' }]
      revision.value += 1
      await flush()
      expect(root.scrollTop).toBe(0)
      rows.value = []
      revision.value += 1
      await flush()
      expect(events.at(-1)).toMatchObject({ firstVisible: null, lastVisible: null, rowCount: 0 })
      root.dispatchEvent(new Event('scroll'))
      app.unmount()
      mounted = false
      expect(frames.size).toBe(0)
      expect(observers.find(observer => observer.targets.some(target => target.tagName === 'THEAD'))!.disconnect).toHaveBeenCalledOnce()
    }
    finally {
      if (mounted) {
        app.unmount()
      }
      element.remove()
    }
  })
})
