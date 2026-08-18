// @vitest-environment jsdom

import {
  ComponentSFCRuntimeHost,
  compileComponentSFC,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  Endge,
  RComponentSFC,
} from '@endge/core'
import type { ComponentSFCProgramPayload, ProgramArtifact } from '@endge/core'
import { Raph } from '@endge/raph'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, isVNode } from 'vue'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/domain/types/sfc-render.type'
import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode, renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

describe('SFC Editable renderer', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  afterEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.program.clear()
    Raph.app.reset()
  })

  it('enters on dblclick, keeps a draft and commits normalized edited payload', async () => {
    const compiled = compileComponentSFC(`<script setup lang="ts">defineProps<{ status: string }>()</script>
<template><Text :value="status" editable edit-on="dblclick" /></template>`)
    const node = compiled.ir!.template.roots[0]!
    const sessions = new Map<string, any>()
    const host = {
      id: 'editable-host',
      entityIdentity: 'editable',
      getArtifact: () => null,
      getEditSession: (key: string) => sessions.get(key) ?? null,
      beginEditSession: (key: string, value: unknown, baseVariant: string) => {
        const session = { key, originalValue: value, draftValue: value, baseVariant }
        sessions.clear()
        sessions.set(key, session)
        return session
      },
      updateEditDraft: (key: string, value: unknown) => { sessions.get(key).draftValue = value },
      commitEditSession: (key: string, value: unknown) => {
        const session = sessions.get(key)
        sessions.delete(key)
        return { value, previousValue: session.originalValue }
      },
      cancelEditSession: (key: string) => sessions.delete(key),
    }
    const boundary = { observesChild: () => false, routeChild: vi.fn(async () => undefined) }
    const context = createSFCVueRenderContext({ status: 'RUN' }, 0, host as any, compiled.ir)
    context.eventBoundary = boundary as any

    const display = renderSFCNode(h, node, context)
    if (!isVNode(display)) throw new Error('Editable display did not render')
    display.props?.onDblclick({ target: display, currentTarget: display, cancelable: true })

    const editor = renderSFCNode(h, node, context)
    if (!isVNode(editor)) throw new Error('Editable input did not render')
    expect(editor.type).toBe('input')
    editor.props?.onInput({ target: { value: 'STOP' } })
    await editor.props?.onChange({ target: { value: 'STOP' } })

    expect(boundary.routeChild).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: expect.any(String), componentTag: 'Text' }),
      'edited',
      { value: 'STOP', previousValue: 'RUN' },
      expect.any(Array),
      [],
      0,
      expect.objectContaining({ status: 'RUN' }),
    )
    expect(sessions.size).toBe(0)
  })

  it('renders only the active explicit Variant', () => {
    const compiled = compileComponentSFC(`<template>
      <Variant name="default"><Text>View</Text></Variant>
      <Variant name="edit"><Text>Edit</Text></Variant>
    </template>`)
    const context = createSFCVueRenderContext({}, 0, null, compiled.ir)
    expect(renderSFCNodes(h, compiled.ir!.template.roots, context).flatMap(node => isVNode(node) ? node.children as any[] : node)).toEqual(['View'])
    context.variant = 'edit'
    expect(renderSFCNodes(h, compiled.ir!.template.roots, context).flatMap(node => isVNode(node) ? node.children as any[] : node)).toEqual(['Edit'])
  })

  it('publishes the authored row patch through the real event boundary', async () => {
    const source = `<script setup lang="ts">defineProps<{ status: string }>()</script>
<template>
  <Text
    :value="status"
    editable
    @edited="emit('edited', { id: rowKey, patch: { [columnKey]: event('value') } })"
  />
</template>`
    const compiled = compileComponentSFC(source)
    const model = RComponentSFC.fromPlain({ id: 90, identity: 'editable-patch', name: 'Editable patch', source })
    const payload: ComponentSFCProgramPayload = {
      sourceParts: compiled.sourceParts,
      sections: compiled.sections,
      contract: compiled.contract,
      dependencies: compiled.dependencies,
      runtimeDependencies: compiled.runtimeDependencies,
      previewProps: compiled.previewProps,
      previewOptions: compiled.previewOptions,
      ast: compiled.ast,
      ir: compiled.ir,
    }
    const artifact: ProgramArtifact<ComponentSFCProgramPayload> = {
      ref: { entityType: 'component-sfc', id: 90, identity: model.identity },
      sourceHash: 'test', compilerVersion: 'test', status: 'valid', diagnostics: [], dependencies: [],
      capabilities: ['compilable', 'executable', 'renderable'], metadata: { self: {}, nodes: [] }, payload,
    }
    const host = ComponentSFCRuntimeHost.createRuntime({
      id: 'editable-patch-runtime', model,
      artifactReader: { getArtifact: <T>() => artifact as unknown as ProgramArtifact<T> },
    })
    const received: unknown[] = []
    host.onEventPort('edited', occurrence => received.push(occurrence.payload))
    const context = createSFCVueRenderContext({ status: 'RUN' }, 0, host, compiled.ir)
    context.locals = { rowKey: 15, columnKey: 'status' }
    const node = compiled.ir!.template.roots[0]!

    const display = renderSFCNode(h, node, context)
    if (!isVNode(display)) throw new Error('Editable display did not render')
    display.props?.onClick({ target: display, currentTarget: display, cancelable: true })
    const editor = renderSFCNode(h, node, context)
    if (!isVNode(editor)) throw new Error('Editable input did not render')
    await editor.props?.onChange({ target: { value: 'STOP' } })
    await Promise.resolve()

    expect(received).toEqual([{ id: 15, patch: { status: 'STOP' } }])
    host.destroy()
  })

  it('supports keyboard trigger filters and cancels the active draft on Escape', () => {
    const compiled = compileComponentSFC(`<script setup lang="ts">defineProps<{ status: string }>()</script>
<template>
  <Text
    :value="status"
    editable
    :edit-on="[{ event: 'keydown', key: ['Enter', 'F2'], stop: true, prevent: true, self: true }]"
  />
</template>`)
    const node = compiled.ir!.template.roots[0]!
    const sessions = new Map<string, any>()
    const host = {
      getArtifact: () => null,
      getEditSession: (key: string) => sessions.get(key) ?? null,
      beginEditSession: (key: string, value: unknown, baseVariant: string) => {
        const session = { key, originalValue: value, draftValue: value, baseVariant }
        sessions.clear()
        sessions.set(key, session)
        return session
      },
      updateEditDraft: vi.fn(),
      commitEditSession: vi.fn(),
      cancelEditSession: (key: string) => sessions.delete(key),
    }
    const context = createSFCVueRenderContext({ status: 'RUN' }, 0, host as any, compiled.ir)
    context.eventBoundary = null
    const display = renderSFCNode(h, node, context)
    if (!isVNode(display)) throw new Error('Editable display did not render')
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const target = {}

    display.props?.onKeydown({
      key: 'Enter', target, currentTarget: {}, cancelable: true, preventDefault, stopPropagation,
    })
    expect(sessions.size).toBe(0)

    display.props?.onKeydown({
      key: 'Space', target, currentTarget: target, cancelable: true, preventDefault, stopPropagation,
    })
    expect(sessions.size).toBe(0)

    display.props?.onKeydown({
      key: 'F2', target, currentTarget: target, cancelable: true, preventDefault, stopPropagation,
    })
    expect(sessions.size).toBe(1)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()

    const editor = renderSFCNode(h, node, context)
    if (!isVNode(editor)) throw new Error('Editable input did not render')
    editor.props?.onKeydown({ key: 'Escape', preventDefault, stopPropagation })
    expect(sessions.size).toBe(0)
  })

  it('starts editing from a pointer trigger while ordinary keys are held', () => {
    const compiled = compileComponentSFC(`<template>
  <Text
    value="RUN"
    editable
    :edit-on="[{
      event: 'contextmenu',
      button: 2,
      held: { code: ['KeyW'], exact: true },
      modifiers: { shift: true, meta: true, exact: true },
    }]"
  />
</template>`)
    const node = compiled.ir!.template.roots[0]!
    const sessions = new Map<string, any>()
    const host = {
      getArtifact: () => null,
      getEditSession: (key: string) => sessions.get(key) ?? null,
      beginEditSession: (key: string, value: unknown, baseVariant: string) => {
        sessions.set(key, { key, originalValue: value, draftValue: value, baseVariant })
      },
    }
    const context = createSFCVueRenderContext({}, 0, host as any, compiled.ir)
    const display = renderSFCNode(h, node, context)
    if (!isVNode(display)) throw new Error('Editable display did not render')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }))
    display.props?.onContextmenu({
      button: 2,
      shiftKey: true,
      metaKey: true,
      target: display,
      currentTarget: display,
      cancelable: true,
    })
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }))

    expect(sessions.size).toBe(1)
  })

  it.each([
    ['Number', 12, '17', 'number', 17],
    ['DateTime', '2026-08-01T10:30:00.000Z', '2026-08-01T12:00', 'datetime-local', '2026-08-01T12:00'],
  ])('uses the adapter Input for editable %s values', async (tag, initial, next, nativeType, committed) => {
    const compiled = compileComponentSFC(`<template><${tag} :value="initial" editable /></template>`)
    const node = compiled.ir!.template.roots[0]!
    const sessions = new Map<string, any>()
    const commitEditSession = vi.fn((key: string, value: unknown) => {
      const session = sessions.get(key)
      sessions.delete(key)
      return { value, previousValue: session.originalValue }
    })
    const host = {
      getArtifact: () => null,
      getEditSession: (key: string) => sessions.get(key) ?? null,
      beginEditSession: (key: string, value: unknown, baseVariant: string) => {
        const session = { key, originalValue: value, draftValue: value, baseVariant }
        sessions.set(key, session)
        return session
      },
      updateEditDraft: (key: string, value: unknown) => { sessions.get(key).draftValue = value },
      commitEditSession,
      cancelEditSession: (key: string) => sessions.delete(key),
    }
    const context = createSFCVueRenderContext({ initial }, 0, host as any, compiled.ir)
    context.eventBoundary = null
    const display = renderSFCNode(h, node, context)
    if (!isVNode(display)) throw new Error('Editable display did not render')
    display.props?.onClick({ target: display, currentTarget: display, cancelable: true })

    const editor = renderSFCNode(h, node, context)
    if (!isVNode(editor)) throw new Error('Editable input did not render')
    expect(editor.type).toBe('input')
    expect(editor.props?.type).toBe(nativeType)
    await editor.props?.onChange({ target: { value: next } })
    expect(commitEditSession).toHaveBeenCalledWith(expect.any(String), committed)
  })

  it('focuses the native root exposed by an adapter Input component', () => {
    const compiled = compileComponentSFC('<template><Text value="RUN" editable /></template>')
    const node = compiled.ir!.template.roots[0]!
    const sessions = new Map<string, any>()
    const host = {
      getArtifact: () => null,
      getEditSession: (key: string) => sessions.get(key) ?? null,
      beginEditSession: (key: string, value: unknown, baseVariant: string) => {
        sessions.set(key, { key, originalValue: value, draftValue: value, baseVariant })
      },
    }
    const context = createSFCVueRenderContext({}, 0, host as any, compiled.ir)
    const display = renderSFCNode(h, node, context)
    if (!isVNode(display)) throw new Error('Editable display did not render')
    display.props?.onClick({ target: display, currentTarget: display, cancelable: true })

    const editor = renderSFCNode(h, node, context)
    if (!isVNode(editor)) throw new Error('Editable input did not render')
    const focus = vi.fn()
    const elementRef = editor.props?.ref

    expect(typeof elementRef).toBe('function')
    expect(() => {
      if (typeof elementRef === 'function') elementRef({ $el: { focus } } as any, {})
    }).not.toThrow()
    expect(focus).toHaveBeenCalledOnce()
  })
})
