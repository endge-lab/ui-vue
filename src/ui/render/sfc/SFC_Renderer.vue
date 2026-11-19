<script setup lang="ts">
import type { SFCVueRenderAdapterProps } from '@/services/render/sfc/sfc-vue-render.type'
import { Endge } from '@endge/core'
import { computed, defineComponent, Fragment, getCurrentInstance, h, inject, onScopeDispose, ref, watch } from 'vue'
import { registerSFCInspectionRoot } from '@/services/render/sfc/SFCVueRenderInspection'
import { EndgeVueTooltipManagerKey } from '@/ui/overlay/tooltip/endge-tooltip-manager'
import { readWorkspaceRendererReferences, workspaceRendererAttachment } from '@/ui/render/sfc/SFCRender_Adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

const props = defineProps<SFCVueRenderAdapterProps>()
const adapterVersion = ref(0)
const consumerScope = `renderer:${getCurrentInstance()!.uid}`
watch(() => [props.host, props.ir] as const, (_next, previous) => {
  previous?.[0]?.releaseComputationResources(consumerScope)
}, { flush: 'sync' })
onScopeDispose(() => props.host?.releaseComputationResources(consumerScope))
const tooltipManager = inject(EndgeVueTooltipManagerKey, null)

const unsubscribeUIRegistry = Endge.uiRegistry.subscribe(() => {
  adapterVersion.value += 1
})
onScopeDispose(unsubscribeUIRegistry)
onScopeDispose(Endge.runtime.modules.subscribe(() => {
  adapterVersion.value += 1
}))
const workspaceRevision = ref(0)
onScopeDispose(Endge.workspace.subscribe(() => {
  workspaceRevision.value += 1
}))
const workspaceReferences = computed(() => {
  void workspaceRevision.value
  return new Map(Object.values(readWorkspaceRendererReferences() ?? {}).map(reference => [
    workspaceRendererAttachment(reference),
    reference,
  ]))
})
const workspaceModuleKeys = computed(() => [...workspaceReferences.value.keys()].sort().join('\n'))
const loadingRenderers = ref(false)
watch([() => Boolean(props.ir), workspaceModuleKeys], async ([hasIR], _previous, onCleanup) => {
  const references = workspaceReferences.value
  loadingRenderers.value = hasIR && references.size > 0
  if (!loadingRenderers.value) {
    return
  }
  let active = true
  onCleanup(() => {
    active = false
  })
  try {
    const scope = await Endge.runtime.activateWorkspaceModuleScope()
    if (active) {
      await Promise.allSettled(Array.from(references, ([key, reference]) => Endge.runtime.modules.attach(scope, key, reference)))
    }
  }
  finally {
    if (active) {
      loadingRenderers.value = false
    }
  }
}, { immediate: true })

const context = computed(() => {
  const context = createSFCVueRenderContext(
    props.props,
    props.renderVersion ?? 0,
    props.host ?? null,
    props.ir,
    undefined,
    consumerScope,
    undefined,
    undefined,
    props.inspection ?? null,
    undefined,
    'default',
    tooltipManager,
  )
  return props.runtimeScopeId
    ? { ...context, runtimeScopeIds: [...context.runtimeScopeIds, props.runtimeScopeId] }
    : context
})

const RenderRoot = defineComponent({
  name: 'SFCRenderRoot',
  setup() {
    return () => {
      void adapterVersion.value
      void workspaceRevision.value
      if (!props.ir || loadingRenderers.value) {
        return null
      }

      const renderContext = context.value
      renderContext.inspectionParentId = renderContext.inspection
        ? registerSFCInspectionRoot(renderContext)
        : null
      return h(Fragment, null, renderSFCNodes(
        h,
        props.ir.template.roots,
        renderContext,
      ))
    }
  },
})
</script>

<template>
  <RenderRoot />
</template>
