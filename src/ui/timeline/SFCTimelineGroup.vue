<script setup lang="ts">
import type { TimelineRangeChangedEvent } from '@endge/core'
import type { TimelineChart, TimelineChartHandle, TimelineViewportConnection } from '@nova-lab/timeline'
import type { TimelineViewportRange } from './timeline-input'
import { computed, onBeforeUnmount, provide, ref, shallowReactive, watch } from 'vue'
import { timelineGroupKey } from './timeline-group-context'
import { readTimelineRange, sameTimelineRange, timelinePixels } from './timeline-input'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ input: Record<string, unknown>, order: string[], changed: (payload: TimelineRangeChangedEvent) => void }>()
const heights = shallowReactive(new Map<string, number>())
const handles = new Map<string, { chart: TimelineChartHandle, stop: () => void }>()
const syncTime = computed(() => props.input.sync === 'time')
const resizedLabelWidth = ref<number>()
const labelWidth = computed(() => resizedLabelWidth.value ?? timelinePixels(props.input['label-width'], 160, 0))
watch(() => props.input['label-width'], () => {
  resizedLabelWidth.value = undefined
})
const range = computed(() => readTimelineRange(props.input.range))
const invalidRange = computed(() => props.input.range != null && !range.value)

let api: typeof TimelineChart | undefined
let connection: TimelineViewportConnection | undefined
let viewport: TimelineViewportRange | undefined
let linkingQueued = false
let rebuilding = false
let disposed = false

function detachConnection(): void {
  connection?.dispose()
  connection = undefined
}

function orderedCharts(): TimelineChartHandle[] {
  return props.order.flatMap((key) => {
    const chart = handles.get(key)?.chart
    return chart ? [chart] : []
  })
}

function leader(): TimelineChartHandle | undefined {
  return typeof props.input.leader === 'string' ? handles.get(props.input.leader)?.chart : undefined
}

function queueRelink(): void {
  if (disposed || linkingQueued) {
    return
  }
  linkingQueued = true
  queueMicrotask(() => {
    linkingQueued = false
    if (disposed) {
      return
    }
    detachConnection()
    const charts = orderedCharts()
    const primary = leader() ?? charts[0]
    if (!primary || !api) {
      return
    }
    rebuilding = true
    try {
      const current = viewport ?? range.value ?? primary.getViewport().timeRange
      if (syncTime.value || range.value) {
        for (const chart of charts) {
          if (!sameTimelineRange(chart.getViewport().timeRange, current)) {
            chart.setViewport({ timeRange: current }, { source: 'timeline-sync' })
          }
        }
      }
      viewport = primary.getViewport().timeRange
      if (syncTime.value && charts.length > 1) {
        const leadingChart = leader()
        connection = api.linkViewports(charts, {
          direction: leadingChart ? { leader: leadingChart } : 'any',
          time: { position: 'same-center', zoom: 'same-duration' },
          vertical: 'independent',
        })
      }
    }
    finally {
      rebuilding = false
    }
  })
}

provide(timelineGroupKey, {
  labelWidth,
  resizeLabels: (width) => {
    if (Number.isFinite(width) && width >= 0) {
      resizedLabelWidth.value = width
    }
  },
  height: key => heights.get(key),
  resize: (key, height) => { heights.set(key, height) },
  viewport: () => syncTime.value ? (viewport ?? range.value) : range.value,
  attach(key, chart, library) {
    if (handles.has(key)) {
      throw new Error(`Два графика TimelineGroup имеют одинаковый key "${key}".`)
    }
    api = library
    const unsubscribe = chart.on('viewport.changed', (event) => {
      if (disposed || rebuilding || event.origin === 'sync'
        || (syncTime.value && leader() && leader() !== chart)
        || sameTimelineRange(event.current.timeRange, event.previous.timeRange)) {
        return
      }
      if (syncTime.value) {
        viewport = event.current.timeRange
      }
      if (event.origin === 'user') {
        props.changed({ ...event.current.timeRange })
      }
    })
    handles.set(key, { chart, stop: unsubscribe })
    queueRelink()
    return () => {
      if (handles.get(key)?.chart !== chart) {
        return
      }
      detachConnection()
      handles.delete(key)
      unsubscribe()
      queueRelink()
    }
  },
})

watch(range, (next, previous) => {
  if (next && !sameTimelineRange(next, previous)) {
    viewport = next
    queueRelink()
  }
})
watch([syncTime, () => props.input.leader, () => JSON.stringify(props.order)], queueRelink)
onBeforeUnmount(() => {
  disposed = true
  detachConnection()
  for (const member of handles.values()) {
    member.stop()
  }
  handles.clear()
  heights.clear()
})
</script>

<template>
  <section v-bind="$attrs" class="endge-timeline-group">
    <p v-if="invalidRange" role="alert">
      Диапазон TimelineGroup должен содержать start и end в миллисекундах, end больше start.
    </p>
    <slot />
  </section>
</template>

<style scoped>
.endge-timeline-group { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; }
</style>
