import type { PhaseName } from '@endge/raph'
import type { Ref } from 'vue'

import { ComponentType, Endge } from '@endge/core'
import { Raph, RaphNode } from '@endge/raph'
import { randomString } from '@endge/utils'
import { onBeforeUnmount, ref, watch } from 'vue'

import JSXRender_Box from '@/ui/render/dsl-jsx/JSXRender_Box'
import JSXRender_Component from '@/ui/render/dsl-jsx/JSXRender_Component'
import JSXRender_DateTime from '@/ui/render/dsl-jsx/JSXRender_DateTime'
import JSXRender_Flex from '@/ui/render/dsl-jsx/JSXRender_Flex'
import JSXRender_Icon from '@/ui/render/dsl-jsx/JSXRender_Icon'
import JSXRender_Layout from '@/ui/render/dsl-jsx/JSXRender_Layout'
import JSXRender_Text from '@/ui/render/dsl-jsx/JSXRender_Text'
import ComponentType_DSL from '@/ui/render/ts/ComponentType_DSL'
import ComponentType_Table from '@/ui/render/vue/ComponentType_TableV2.vue'

export class EndgeVue {
  /**
   * Регистрация системных данных ядра Vue
   */
  static init(): void {
    const registerLegacyViewRenderer = (
      componentIdentity: string,
      renderType: 'functional' | 'component',
      component: unknown,
      label?: string,
    ): void => {
      Endge.uiRegistry.registerLegacyComponentRenderer({
        ref: `legacy:${componentIdentity}:view`,
        componentIdentity,
        host: 'view',
        renderType,
        component,
        label,
      })
    }

    //
    // Регистрация компонентных рендеров - родительский контейнер (Vue)
    registerLegacyViewRenderer(
      ComponentType.Table,
      'component',
      ComponentType_Table,
      'ComponentType.Table:view',
    )
    registerLegacyViewRenderer(
      ComponentType.DSL,
      'functional',
      ComponentType_DSL,
      'ComponentType.DSL:view',
    )

    //
    // Регистрация JSX рендеров
    registerLegacyViewRenderer('Layout', 'functional', JSXRender_Layout, 'JSX:Layout')
    registerLegacyViewRenderer('Flex', 'functional', JSXRender_Flex, 'JSX:Flex')
    registerLegacyViewRenderer('Box', 'functional', JSXRender_Box, 'JSX:Box')
    registerLegacyViewRenderer('Component', 'functional', JSXRender_Component, 'JSX:Component')
    registerLegacyViewRenderer('Text', 'functional', JSXRender_Text, 'JSX:Text')
    registerLegacyViewRenderer('DateTime', 'functional', JSXRender_DateTime, 'JSX:DateTime')
    registerLegacyViewRenderer('Icon', 'functional', JSXRender_Icon, 'JSX:Icon')

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
          if (!ctx.node?.meta?.ref) {
            return
          }
          (ctx.node.meta.ref as Ref<unknown>).value = Raph.get(ctx.node.meta.path)
        })
      },
    })
    Raph.reinitPhases()
  }

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
