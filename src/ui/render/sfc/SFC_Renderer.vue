<script setup lang="ts">
import type { SFCVueRenderAdapterProps } from '@/services/render/sfc/sfc-vue-render.type'
import { Endge, moduleReferenceKey } from '@endge/core'
import { computed, defineComponent, Fragment, getCurrentInstance, h, inject, onScopeDispose, ref, watch } from 'vue'
import { useCurrentLocale } from '@/reactive/use-current-locale'
import { useCurrentTimezone } from '@/reactive/use-current-timezone'
import { registerSFCInspectionRoot } from '@/services/render/sfc/SFCVueRenderInspection'
import { EndgeVueTooltipManagerKey } from '@/ui/overlay/tooltip/endge-tooltip-manager'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

const props = defineProps<SFCVueRenderAdapterProps>()
const adapterVersion = ref(0)
const { current: currentLocale } = useCurrentLocale()
const { current: currentTimezone } = useCurrentTimezone()
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
onScopeDispose(Endge.configuration.subscribe(() => {
  workspaceRevision.value += 1
}))
const workspaceModuleKeys = computed(() => {
  void workspaceRevision.value
  if (!Endge.configuration.isResolved || Endge.mode === 'debugger') {
    return ''
  }
  const { defaultRenderers, timelinePresets } = Endge.configuration.current
  const references = [...Object.values(defaultRenderers ?? {}), ...timelinePresets ?? []]
  return [...new Set(references.map(moduleReferenceKey))].sort().join('\n')
})
const loadingRenderers = ref(false)
watch([() => Boolean(props.ir), workspaceModuleKeys], async ([hasIR, keys], _previous, onCleanup) => {
  loadingRenderers.value = hasIR && keys.length > 0
  if (!loadingRenderers.value) {
    return
  }
  let active = true
  onCleanup(() => {
    active = false
  })
  try {
    await Endge.runtime.prepareWorkspaceModules()
  }
  finally {
    if (active) {
      loadingRenderers.value = false
    }
  }
}, { immediate: true })

const context = computed(() => {
  void currentLocale.value
  const runtimeContext = Object.freeze({
    ...Endge.context.runtimeSnapshot(),
    // Only effects that actually read the timezone depend on its Vue ref.
    get timezone() { return currentTimezone.value },
  })
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
    undefined,
    { context: runtimeContext },
  )
  context.translate = props.translate
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
