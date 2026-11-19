import type { ComponentSFCEventRuntimeSource } from '@endge/core'
import type { VNode } from 'vue'
import type { SFCVueRenderElementInput, SFCVueRenderFunction } from '@/services/render/sfc/sfc-vue-render.type'
import type { TimelinePresetEntry } from '@/ui/timeline/timeline-presets'
import { Endge } from '@endge/core'
import { cloneVNode, isVNode } from 'vue'
import { MODULE_VISUAL_ATTRIBUTE, VUE_MODULE_TIMELINE_PRESETS } from '@/services/modules/vue-module'
import { resolveSFCModuleScope } from '@/ui/render/sfc/SFCRender_Adapter'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import SFCTimelineChart from '@/ui/timeline/SFCTimelineChart.vue'
import SFCTimelineGroup from '@/ui/timeline/SFCTimelineGroup.vue'

export const SFCRender_TimelineChart: SFCVueRenderFunction = (input) => {
  if (input.props.hidden === true) {
    return null
  }
  const declaredKey = input.node.directives.key
    ? evaluateSFCValue(input.node.directives.key, input.context)
    : input.props.id
  const key = String(declaredKey ?? input.context.iteration?.key ?? input.node.id)
  const presetName = input.props.preset
  const entry = typeof presetName === 'string'
    ? Endge.runtime.modules.resolve<TimelinePresetEntry>(resolveSFCModuleScope(input.context), VUE_MODULE_TIMELINE_PRESETS, presetName)
    : undefined
  return input.h(SFCTimelineChart, {
    ...input.attrs,
    [MODULE_VISUAL_ATTRIBUTE]: entry?.visualToken,
    modulePreset: entry?.value,
    key,
    chartKey: key,
    input: input.props,
    readonly: input.context.host?.readonly ?? false,
    theme: input.context.context.theme === 'dark' ? 'dark' : 'light',
    registerFocus: (focusTask) => {
      const ref = input.props.ref
      return typeof ref === 'string' && ref && input.context.host?.registerNodeActionTarget
        ? input.context.host.registerNodeActionTarget(ref, { type: 'component.timeline', identity: ref, value: { focusTask } })
        : () => {}
    },
    selected: (payload, focusTask) => {
      routeTimelineEvent(input, 'taskSelected', payload, { focusTask })
    },
  })
}

export const SFCRender_TimelineGroup: SFCVueRenderFunction = (input) => {
  const charts = input.children.flatMap(collectCharts)
  const order = charts.map(node => String(node.props?.chartKey))
  return input.h(SFCTimelineGroup, {
    ...input.attrs,
    input: input.props,
    order,
    changed: payload => routeTimelineEvent(input, 'rangeChanged', payload),
  }, {
    default: () => charts.map((node, index) => cloneVNode(node, {
      key: order[index],
      splitAfter: input.props.splitter === true && index < charts.length - 1,
    })),
  })
}

function collectCharts(node: string | VNode): VNode[] {
  if (typeof node === 'string') {
    return []
  }
  if (node.type === SFCTimelineChart) {
    return [node]
  }
  return Array.isArray(node.children) ? node.children.filter(isVNode).flatMap(collectCharts) : []
}

function routeTimelineEvent(
  input: SFCVueRenderElementInput,
  name: string,
  payload: unknown,
  target?: { focusTask: (id: string) => boolean },
): void {
  const source: ComponentSFCEventRuntimeSource = {
    nodeId: input.node.id,
    componentTag: input.node.tag,
    ref: typeof input.props.ref === 'string' ? input.props.ref : undefined,
    target: target
      ? {
          type: 'component.timeline',
          identity: String(input.props.ref ?? input.props.id ?? input.node.id),
          value: target,
        }
      : undefined,
  }
  void input.context.eventBoundary?.routeChild(source, name, payload, input.node.events ?? [], [], 0, {
    ...input.context.props,
    ...input.context.locals,
  })
}
