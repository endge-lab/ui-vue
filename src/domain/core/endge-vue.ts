import type { PhaseName } from '@endge/raph'
import type { Ref } from 'vue'

import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
  EndgeModule,
  type EndgePlugin,
} from '@endge/core'
import { Raph, RaphNode } from '@endge/raph'
import { randomString } from '@endge/utils'
import { onBeforeUnmount, ref, watch } from 'vue'

import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'

export class EndgeVueModule extends EndgeModule {
  private _started = false
  private _unsubscribeWorkspace: (() => void) | null = null

  public override setup(): void {
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
  }

  public override build(): void {
    this._activateWorkspaceAdapter()
  }

  private _activateWorkspaceAdapter(): void {
    Endge.uiRegistry.adapters.activate({
      id: Endge.workspace.defaultSfcAdapterId,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  }

  public override start(): void {
    if (this._started)
      return

    this._started = true

    Raph.addPhase({
      name: 'watch' as PhaseName,
      routes: ['*'],
      traversal: 'dirty-only',

      // берём только root-ноды таблицы (их ты сам track-ишь на `${basePath}.*`)
      nodes: (node: RaphNode) => node?.meta.type === 'watch',

      all: (ctxs) => {
        if (!ctxs.length)
          return

        ctxs.forEach((ctx) => {
          const path = ctx.node?.meta?.path

          if (!ctx.node?.meta?.ref || typeof path !== 'string') {
            return
          }

          (ctx.node.meta.ref as Ref<unknown>).value = Raph.get(path)
        })
      },
    })

    this._unsubscribeWorkspace = Endge.workspace.subscribe(() => {
      this._activateWorkspaceAdapter()
    })
  }

  public override reset(): void {
    this._unsubscribeWorkspace?.()
    this._unsubscribeWorkspace = null
    this._started = false
  }

}

export const EndgeVuePlugin: EndgePlugin = {
  id: '@endge/vue',
  install(): void {
    Endge.defineModule({
      key: 'vue',
      module: new EndgeVueModule(),
      before: 'runtime',
    })
  },
}

export class EndgeVue {
  static makeRaphRef<T>(path: string): Ref<T> {
    const newRef = ref<T>(Raph.get(path) as T)

    const raphNode = new RaphNode(Raph.app, {
      id: `watch:${randomString(5)}`,
      meta: {
        ref: newRef,
        type: 'watch',
        path,
      },
    })
    Raph.app.addNode(raphNode)
    Raph.app.track(raphNode, `${path}[*]`, {
      wildcardDynamic: true,
    })

    onBeforeUnmount(() => {
      Raph.app.untrack?.(raphNode)
      raphNode.remove?.()
    })

    watch(newRef, () => {
      Raph.set(path, newRef.value)
    })

    return newRef as Ref<T>
  }

  static makeVocabRef<T>(vocab: string): Ref<T> {
    return EndgeVue.makeRaphRef(`vocabs.${vocab}`)
  }
}
