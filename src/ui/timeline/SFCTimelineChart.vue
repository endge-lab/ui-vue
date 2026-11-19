<script setup lang="ts">
import type { TimelineTaskSelectedEvent } from '@endge/core'
import type { TimelineChartHandle, TimelineChartMountConfig } from '@nova-lab/timeline'
import type { TimelinePresetContext, TimelinePresetEntry, TimelinePresetProvider } from './timeline-presets'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { timelineGroupKey } from './timeline-group-context'
import { EMPTY_TIMELINE_DATA, inferTimelineRange, isTimelineRecord, mergeTimelineOptions, nextTimelineId, readTimelineColumns, readTimelineData, readTimelineRange, sameTimelineRange, timelinePixels } from './timeline-input'
import { resolveTimelinePreset } from './timeline-presets'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  input: Record<string, unknown>
  chartKey: string
  modulePreset?: TimelinePresetEntry
  readonly?: boolean
  theme?: 'light' | 'dark'
  splitAfter?: boolean
  selected: (payload: TimelineTaskSelectedEvent, focusTask: (id: string) => boolean) => void
  registerFocus?: (focus: (id: string) => boolean) => () => void
}>()
const timelineId = nextTimelineId()
const group = inject(timelineGroupKey, null)
const target = ref<HTMLElement>()
const collapsed = ref(false)
const error = ref('')
const loading = ref(true)
const presetHeight = ref<number | string>()
const minimum = computed(() => timelinePixels(props.input['min-height'], 80, 32))
const maximum = computed(() => Math.max(minimum.value, timelinePixels(props.input['max-height'], 2400)))
const title = computed(() => typeof props.input.title === 'string' ? props.input.title : '')
const baseHeight = computed(() => timelinePixels(props.input.height, timelinePixels(presetHeight.value, 320)))
const panelHeight = computed(() => clampHeight(group?.height(props.chartKey) ?? baseHeight.value))
const viewportHeight = computed(() => collapsed.value ? 32 : panelHeight.value)
const preset = computed(() => {
  try {
    return { value: resolveTimelinePreset(props.input.preset, props.input.settings, props.modulePreset), error: '' }
  }
  catch (cause) {
    return { value: undefined, error: errorMessage(cause) }
  }
})
const compact = computed(() => collapsed.value && preset.value.value?.compact === true)
const showCanvas = computed(() => !collapsed.value || compact.value)
const showSplitter = computed(() => group && props.splitAfter && !collapsed.value)

let timeline: typeof import('@nova-lab/timeline') | undefined
let chart: TimelineChartHandle | undefined
const cleanup: Array<() => void> = []
let generation = 0
let active = false
let mountedPreset: { name: unknown, settings: unknown, compact: boolean } | undefined
let mountedProvider: TimelinePresetProvider | undefined
let appliedOptions: TimelineChartMountConfig['options']
let appliedData: TimelineChartMountConfig['data']
let presetConfig: Partial<TimelineChartMountConfig> = {}
let inferredRange: ReturnType<typeof inferTimelineRange>
let appliedTheme: string | undefined
let columnSource: unknown
let authoredColumns: ReturnType<typeof readTimelineColumns> | undefined
const blankColumnLabel = () => ''
let resizeStart: { pointer: number, y: number, height: number } | undefined

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function clampHeight(value: number): number {
  return Math.min(maximum.value, Math.max(minimum.value, Math.round(value)))
}

function focusTask(id: string): boolean {
  return chart?.focusOnTask(id) ?? false
}

function configuration(base: Partial<TimelineChartMountConfig>) {
  const options = mergeTimelineOptions(base.options, props.input.options)
  if (props.input.columns != null) {
    if (!authoredColumns || !sameValue(columnSource, props.input.columns)) {
      authoredColumns = readTimelineColumns(props.input.columns)
      columnSource = props.input.columns
    }
    options.groups = { ...options.groups, columns: authoredColumns }
  }
  const labelWidth = group?.labelWidth.value
  if (labelWidth !== undefined) {
    const columns = options.groups?.visible === false ? [] : options.groups?.columns ?? []
    const authored = columns.length ? columns : [{ id: 'endge-label', title: '', width: labelWidth, data: blankColumnLabel }]
    const total = authored.reduce((sum, column) => sum + (column.width ?? 160), 0)
    let used = 0
    options.groups = {
      ...options.groups,
      visible: labelWidth > 0,
      columns: labelWidth <= 0
        ? []
        : authored.map((column, index) => {
            const width = index === authored.length - 1 ? labelWidth - used : labelWidth * (column.width ?? 160) / total
            used += width
            return { ...column, width }
          }),
    }
    options.resize = { ...options.resize, groupColumns: 'lazy' }
  }
  if (props.readonly || !preset.value.value) {
    options.interaction = mergeTimelineOptions(options, {
      interaction: {
        tasks: { drag: { moveGroup: { enabled: false }, moveTime: { enabled: false }, resizeStart: { enabled: false }, resizeEnd: { enabled: false } } },
        points: { drag: { moveTime: { enabled: false }, moveGroup: { enabled: false } } },
        links: { drag: { move: { enabled: false } } },
      },
    }).interaction
  }
  const data = props.input.data == null ? (base.data ?? EMPTY_TIMELINE_DATA) : readTimelineData(props.input.data)
  if (options.timeRange == null) {
    inferredRange ??= inferTimelineRange(data ?? EMPTY_TIMELINE_DATA)
    if (inferredRange) {
      options.timeRange = inferredRange
    }
  }
  return { data, options }
}

function dispose(): void {
  const current = chart
  chart = undefined
  for (const release of cleanup.splice(0)) {
    try {
      release()
    }
    catch (cause) {
      error.value = errorMessage(cause)
    }
  }
  try {
    current?.destroy()
  }
  catch (cause) {
    error.value = errorMessage(cause)
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => sameValue(value, b[index]))
  }
  return isTimelineRecord(a) && isTimelineRecord(b)
    && Object.keys(a).length === Object.keys(b).length
    && Object.keys(a).every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
}

function removedOptions(previous: unknown, next: unknown): boolean {
  return isTimelineRecord(previous) && (!isTimelineRecord(next)
    || Object.keys(previous).some(key => !Object.hasOwn(next, key) || removedOptions(previous[key], next[key])))
}

async function reconcile(): Promise<void> {
  const currentGeneration = ++generation
  if (!active || !showCanvas.value) {
    dispose()
    return
  }
  try {
    if (preset.value.error) {
      throw new Error(preset.value.error)
    }
    timeline ??= await import('@nova-lab/timeline')
    if (currentGeneration !== generation || !active || !target.value) {
      return
    }
    const nextPreset = { name: props.input.preset, settings: props.input.settings, compact: compact.value }
    const selectedPreset = preset.value.value
    const presetChanged = selectedPreset?.provider !== mountedProvider || !sameValue(nextPreset, mountedPreset)
    const context: TimelinePresetContext = { settings: selectedPreset?.settings ?? {}, collapsed: collapsed.value }
    const base = presetChanged ? selectedPreset?.provider.configure?.(context) ?? {} : presetConfig
    const { data, options } = configuration(base)
    const theme = base.theme ?? props.theme ?? 'light'
    const old = chart?.getViewport()
    const authoredRange = readTimelineRange(options.timeRange)
    const rangeChanged = !sameTimelineRange(readTimelineRange(appliedOptions?.timeRange), authoredRange)
    const desiredRange = group?.viewport() ?? (rangeChanged ? authoredRange : old?.timeRange)

    if (!chart || presetChanged || removedOptions(appliedOptions, options)) {
      dispose()
      const mountOptions = desiredRange ? { ...options, timeRange: { ...options.timeRange, ...desiredRange } } : options
      const handle = timeline.TimelineChart.mount(target.value, {
        renderer: 'web2d',
        ...base,
        id: timelineId,
        theme,
        data,
        options: mountOptions,
        width: group ? '100%' : base.width ?? '100%',
        height: '100%',
      })
      chart = handle
      const detach = group?.attach(props.chartKey, handle, timeline.TimelineChart)
      if (detach) {
        cleanup.push(detach)
      }
      const unregister = props.registerFocus?.(focusTask)
      if (unregister) {
        cleanup.push(unregister)
      }
      cleanup.push(handle.on(timeline.TimelineEvents.SelectionChanged, ({ previous, next }) => {
        if (sameValue(previous.taskIds, next.taskIds)) {
          return
        }
        props.selected({ taskId: next.taskIds[0] ?? null, taskIds: [...next.taskIds] }, focusTask)
      }))
      if (group) {
        cleanup.push(handle.on(timeline.TimelineEvents.GroupColumnResizeEnd, () => {
          group.resizeLabels(handle.options().groups.columns.reduce((sum, column) => sum + column.width, 0))
        }))
      }
      const release = selectedPreset?.provider.mounted?.(handle, context)
      if (release) {
        cleanup.push(release)
      }
    }
    else {
      const live = chart
      if (theme !== appliedTheme) {
        live.setTheme(theme)
      }
      const range = live.getViewport().timeRange
      if (appliedData !== data) {
        live.data(data ?? {})
      }
      const previous = (appliedOptions ?? {}) as Record<string, unknown>
      const patch = Object.fromEntries(Object.entries(options).filter(([key, value]) => !sameValue(previous[key], value)))
      if (Object.keys(patch).length) {
        if (patch.timeRange && !rangeChanged) {
          patch.timeRange = { ...options.timeRange, ...range }
        }
        live.options(patch)
      }
      const preserved = desiredRange ?? range
      if (!sameTimelineRange(live.getViewport().timeRange, preserved)) {
        live.setViewport({ timeRange: preserved }, { source: 'timeline-sync' })
      }
    }
    mountedPreset = nextPreset
    mountedProvider = selectedPreset?.provider
    presetConfig = base
    presetHeight.value = base.height
    appliedOptions = options
    appliedTheme = theme
    appliedData = data
    error.value = ''
  }
  catch (cause) {
    dispose()
    mountedPreset = undefined
    error.value = errorMessage(cause)
  }
  finally {
    if (generation === currentGeneration) {
      loading.value = false
    }
  }
}

function startResize(event: PointerEvent): void {
  if (event.button !== 0 || !group) {
    return
  }
  event.preventDefault()
  const handle = event.currentTarget as HTMLElement
  handle.focus()
  handle.setPointerCapture(event.pointerId)
  resizeStart = { pointer: event.pointerId, y: event.clientY, height: panelHeight.value }
}

function moveResize(event: PointerEvent): void {
  if (resizeStart?.pointer === event.pointerId) {
    group?.resize(props.chartKey, clampHeight(resizeStart.height + event.clientY - resizeStart.y))
  }
}

function resizeWithKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? 40 : 10
  const value = event.key === 'ArrowUp'
    ? panelHeight.value - step
    : event.key === 'ArrowDown'
      ? panelHeight.value + step
      : event.key === 'Home' ? minimum.value : undefined
  if (value !== undefined) {
    event.preventDefault()
    group?.resize(props.chartKey, clampHeight(value))
  }
}

watch(() => props.input.collapsed, (value) => {
  collapsed.value = value === true
}, { immediate: true })
watch([() => props.input, () => props.modulePreset, () => props.readonly, () => props.theme, showCanvas, compact, () => group?.labelWidth.value], () => {
  void reconcile()
}, { flush: 'post' })
onMounted(() => {
  active = true
  void reconcile()
})
onBeforeUnmount(() => {
  active = false
  generation++
  dispose()
})
</script>

<template>
  <section v-bind="$attrs" class="endge-timeline-chart">
    <header v-if="title || collapsed" class="endge-timeline-chart__header">
      <button v-if="group" type="button" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
        {{ collapsed ? '▸' : '▾' }} {{ title || 'Timeline' }}
      </button>
      <span v-else>{{ title || 'Timeline' }}</span>
    </header>
    <div v-if="showCanvas" class="endge-timeline-chart__surface" :style="{ height: `${viewportHeight}px` }">
      <div ref="target" class="endge-timeline-chart__canvas" />
      <div v-if="error" class="endge-timeline-chart__status" role="alert">
        {{ error }}
      </div>
      <div v-else-if="loading" class="endge-timeline-chart__status" role="status">
        Загрузка Timeline…
      </div>
    </div>
    <div
      v-if="showSplitter"
      class="endge-timeline-chart__splitter"
      role="separator"
      tabindex="0"
      aria-orientation="horizontal"
      aria-label="Высота графика Timeline"
      :aria-valuenow="panelHeight"
      :aria-valuemin="minimum"
      :aria-valuemax="maximum"
      @pointerdown="startResize"
      @pointermove="moveResize"
      @lostpointercapture="resizeStart = undefined"
      @keydown="resizeWithKey"
    />
  </section>
</template>

<style scoped>
.endge-timeline-chart { min-width: 0; flex-shrink: 0; }
.endge-timeline-chart__header { min-height: 26px; display: flex; align-items: center; padding-inline: 8px; }
.endge-timeline-chart__surface { position: relative; width: 100%; }
.endge-timeline-chart__canvas { width: 100%; height: 100%; overflow: hidden; }
.endge-timeline-chart__status { position: absolute; inset: 0; display: grid; place-content: center; padding: 12px; background: var(--endge-surface, Canvas); }
.endge-timeline-chart__splitter { position: relative; height: 8px; cursor: row-resize; touch-action: none; }
.endge-timeline-chart__splitter::after { content: ''; position: absolute; inset: 3px 0; background: currentColor; opacity: .18; }
.endge-timeline-chart__splitter:hover::after, .endge-timeline-chart__splitter:focus-visible::after { opacity: .6; }
</style>
