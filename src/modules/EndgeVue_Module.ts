import type {
  EndgeBootContext,
  EndgeContextStateTransform,
  EndgeFederationContext,
  EndgePlugin,
  EndgeStylePlacement,
} from '@endge/core'
import type { PhaseName } from '@raphy-js/raph'

import type { Ref } from 'vue'
import { Endge, ENDGE_SFC_RENDER_ADAPTER_PROTOCOL, ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION, EndgeModule } from '@endge/core'
import { randomString } from '@endge/utils'
import { Raph, RaphNode } from '@raphy-js/raph'

import { onBeforeUnmount, ref, watch } from 'vue'
import { createContextStateRef } from '@/reactive/use-context-state'
import { NativeVueSFCAdapter } from '@/services/render/sfc/native-vue-sfc-adapter'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-vue-render.type'
import { EndgeDOMStyleRuntime } from '@/services/style/EndgeDOMStyleRuntime'

export class EndgeVue_Module extends EndgeModule {
  // В debugger участвует только регистрация renderer и отображение наблюдаемых стилей.
  public readonly debuggerCompatible = true
  private _started = false
  private _adapterFallbackIds: readonly string[] = []
  private _unsubscribeWorkspace: (() => void) | null = null
  private _unsubscribeStyles: (() => void) | null = null
  private _unsubscribeProgram: (() => void) | null = null
  private _unsubscribeUIRegistry: (() => void) | null = null
  private _unsubscribeRuntimeScopes: (() => void) | null = null
  private readonly _styleRuntime = new EndgeDOMStyleRuntime()

  public override setup(ctx?: EndgeFederationContext): void {
    this._adapterFallbackIds = (ctx as EndgeBootContext | undefined)?.ui?.adapterFallbackIds ?? []
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
  }

  public override build(): void {
    this._activateWorkspaceAdapter()
  }

  private _activateWorkspaceAdapter(): void {
    if (Endge.mode === 'debugger' && !Endge.configuration.isResolved) {
      return
    }
    const selectedId = Endge.workspace.defaultSfcAdapterId
    const selected = Endge.uiRegistry.adapters.resolveAvailable(
      selectedId,
      this._adapterFallbackIds,
    )
    if (!selected) {
      Endge.uiRegistry.adapters.require({ id: selectedId })
      return
    }
    if (selected.renderer !== 'vue') {
      return
    }
    Endge.uiRegistry.adapters.activate({
      id: selected.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
      requiredRootKeys: ['shell', 'sfc', 'sfc-runtime', 'filter-view'],
    })
  }

  public override start(): void {
    if (this._started) {
      return
    }

    this._started = true

    if (Endge.mode === 'debugger') {
      this._unsubscribeWorkspace = Endge.configuration.subscribe(() => {
        this._activateWorkspaceAdapter()
        this._refreshStyles()
      })
      this._unsubscribeRuntimeScopes = Endge.runtime.subscribe(() => this._refreshStyles())
      this._unsubscribeUIRegistry = Endge.uiRegistry.subscribe(() => this._refreshStyles())
      this._refreshStyles()
      return
    }

    Raph.addPhase({
      name: 'watch' as PhaseName,
      routes: ['*'],
      traversal: 'dirty-only',

      // берём только root-ноды таблицы (их ты сам track-ишь на `${basePath}.*`)
      nodes: (node: RaphNode) => node?.meta.type === 'watch',

      all: (ctxs) => {
        if (!ctxs.length) {
          return
        }

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
      this._refreshStyles()
    })
    this._unsubscribeStyles = Endge.styles.subscribe(() => this._refreshStyles())
    this._unsubscribeProgram = Endge.program.subscribe(() => this._refreshStyles())
    this._unsubscribeUIRegistry = Endge.uiRegistry.subscribe(() => this._refreshStyles())
    this._unsubscribeRuntimeScopes = Endge.runtime.scopes.subscribe(() => this._refreshStyles())
    this._refreshStyles()
  }

  public override reset(): void {
    this._unsubscribeWorkspace?.()
    this._unsubscribeWorkspace = null
    this._unsubscribeStyles?.()
    this._unsubscribeStyles = null
    this._unsubscribeProgram?.()
    this._unsubscribeProgram = null
    this._unsubscribeUIRegistry?.()
    this._unsubscribeUIRegistry = null
    this._unsubscribeRuntimeScopes?.()
    this._unsubscribeRuntimeScopes = null
    this._styleRuntime.reset()
    this._adapterFallbackIds = []
    this._started = false
  }

  /**
   * Связывает Vue ref с dynamic state текущего Endge context scope.
   */
  public useContextState<T>(
    key: string,
    defaultFactory: () => T,
    transform?: EndgeContextStateTransform<T>,
  ): Ref<T> {
    return createContextStateRef(key, defaultFactory, transform)
  }

  public makeRaphRef<T>(path: string): Ref<T> {
    const newRef = ref<T>(Raph.get(path) as T)

    const raphNode = new RaphNode(Raph.runtime, {
      id: `watch:${randomString(5)}`,
      meta: {
        ref: newRef,
        type: 'watch',
        path,
      },
    })
    const stopTracking = Raph.runtime.track(raphNode, `${path}[*]`, {
      wildcardDynamic: true,
    })

    onBeforeUnmount(() => {
      stopTracking()
      raphNode.dispose()
    })

    watch(newRef, () => {
      Raph.set(path, newRef.value)
    })

    return newRef as Ref<T>
  }

  public makeVocabRef<T>(vocab: string): Ref<T> {
    return this.makeRaphRef(`vocabs.${vocab}`)
  }

  private _refreshStyles(): void {
    if (Endge.uiRegistry.adapters.active?.renderer !== 'vue') {
      this._styleRuntime.reset()
      return
    }
    if (Endge.mode === 'debugger') {
      this._styleRuntime.update(Endge.runtime.inspection.render?.styles ?? [], { renderer: 'dom', capabilities: [] })
      return
    }
    const artifacts: EndgeStylePlacement[] = [...Endge.styles.getActivePlacements()]
    const hiddenScopeIds = Endge.runtime.scopes.getAll()
      .filter(scope => scope.state !== 'active' && scope.state !== 'inactive' && scope.state !== 'disposed')
      .map(scope => scope.id)
    this._styleRuntime.update(artifacts, { renderer: 'dom', capabilities: [] }, hiddenScopeIds)
  }
}

declare module '@endge/core' {
  interface EndgeExtensions {
    readonly vue: EndgeVue_Module
  }
}

export const EndgeVuePlugin: EndgePlugin = {
  id: '@endge/ui-vue',
  modules: [
    {
      key: 'vue',
      create: () => new EndgeVue_Module(),
      after: ['configuration', 'uiRegistry'],
      before: 'runtime',
    },
  ],
}
