<script setup lang="ts">
import type { RComponentSFC_IR_ElementNode, RComponentSFC_IR_Node, RComponentSFC_IR_Value, RuntimeBoundaryPatch, RuntimeTimelineCollection, TimelineTaskSelectedEvent } from '@endge/core'
import type { TimelineChartHandle, TimelineChartMountConfig } from '@nova-lab/timeline'
import type { TimelinePresetContext, TimelinePresetEntry, TimelinePresetProvider } from './timeline-presets'
import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadVueModuleTimeline } from '@/services/modules/vue-module'
import { SFCVueBoundaryRegistryKey } from '@/ui/render/sfc/SFCRender_BoundaryRegistry'
import { timelineGroupKey, timelinePreviewGroupsHiddenKey } from './timeline-group-context'
import { compactTimelineData, EMPTY_TIMELINE_DATA, inferTimelineRange, isTimelineRecord, mergeTimelineOptions, nextTimelineId, readTimelineColumnNodes, readTimelineColumns, readTimelineData, readTimelineRange, sameTimelineRange, timelineCollections, timelinePixels } from './timeline-input'
import { resolveTimelinePreset } from './timeline-presets'
import { createTimelineRecipeProfiles, inheritedTimelineProfile, timelineRecipePreviewKey } from './timeline-task-recipes'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  input: Record<string, unknown>
  sourceStart?: number
  sourceChildren?: readonly RComponentSFC_IR_Node[]
  recipeContext?: SFCVueRenderContext
  chartKey: string
  boundaryId?: string
  modulePreset?: TimelinePresetEntry
  readonly?: boolean
  theme?: 'light' | 'dark'
  splitAfter?: boolean
  selected: (payload: TimelineTaskSelectedEvent, focusTask: (id: string) => boolean) => void
  registerFocus?: (focus: (id: string) => boolean) => () => void
}>()
const timelineId = nextTimelineId()
const group = inject(timelineGroupKey, null)
const previewGroupsHidden = inject(timelinePreviewGroupsHiddenKey, null)
const observePreview = inject(timelineRecipePreviewKey, null)
const boundaries = inject(SFCVueBoundaryRegistryKey, null)
const renderVersion = computed(() => boundaries ? props.recipeContext?.renderVersion : undefined)
type TimelineData = NonNullable<TimelineChartMountConfig['data']>
type TimelineUpdates = Parameters<TimelineChartHandle['update']>[0]
const externalDataChange = { source: 'external', history: 'skip' } as const
let clearRecipePreview: (() => void) | undefined
let recipeData: NonNullable<TimelineChartMountConfig['data']> = EMPTY_TIMELINE_DATA
let appliedRecipes: readonly RComponentSFC_IR_ElementNode[] | undefined
let localProfiles: ReturnType<typeof createTimelineRecipeProfiles>
let appliedProfileSelection: NonNullable<TimelineChartMountConfig['options']>['profiles']
let appliedRecipeContext: SFCVueRenderContext | undefined
let appliedSourceStart: number | undefined
let appliedRecipeTimezone: string | null | undefined
const target = ref<HTMLElement>()
const title = computed(() => typeof props.input.title === 'string' ? props.input.title : '')
const columnNodes = computed(() => childElements('Column'))
const taskRecipes = computed(() => childElements('TimelineTaskRecipe'))
const recipeExpressions = computed(() => taskRecipes.value.flatMap(node => Object.values(node.props))
  .filter(value => value.kind === 'expression'))
const recipesReadGroup = computed(() => recipeExpressions.value.some(value => value.reads.some(read => read.path[0] === '$group')))
const columnTimezone = computed(() => columnNodes.value.some(node => Object.values(node.props).some(readsContext))
  ? props.recipeContext?.context.timezone
  : undefined)
const recipeTimezone = computed(() => recipeExpressions.value.some(readsContext)
  ? props.recipeContext?.context.timezone
  : undefined)
const sourceColumns = computed(() => {
  void columnTimezone.value
  return columnNodes.value.length && props.recipeContext
    ? readTimelineColumnNodes(columnNodes.value, props.recipeContext)
    : undefined
})
const collapsed = ref(false)
const error = ref('')
const loading = ref(true)
const presetHeight = ref<number | string>()
const minimum = computed(() => timelinePixels(props.input['min-height'], 80, 32))
const maximum = computed(() => Math.max(minimum.value, timelinePixels(props.input['max-height'], 2400)))
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

let timeline: Awaited<ReturnType<typeof loadVueModuleTimeline>> | undefined
let chart: TimelineChartHandle | undefined
const cleanup: Array<() => void> = []
let generation = 0
let active = false
let mountedPreset: { name: unknown, settings: unknown, compact: boolean } | undefined
let mountedProvider: TimelinePresetProvider | undefined
let appliedOptions: TimelineChartMountConfig['options']
let appliedData: TimelineChartMountConfig['data']
let appliedRenderVersion: number | undefined
let sourceSnapshot: { input: unknown, version: number | undefined, data: TimelineData } | undefined
let entityIds: Partial<Record<RuntimeTimelineCollection, Set<string>>> = {}
let presetConfig: Partial<TimelineChartMountConfig> = {}
let inferredRange: ReturnType<typeof inferTimelineRange>
let appliedTheme: string | undefined
let columnSource: unknown
let authoredColumns: ReturnType<typeof readTimelineColumns> | undefined
const blankColumnLabel = () => ''
let resizeStart: { pointer: number, y: number, height: number } | undefined

function childElements(tag: 'Column' | 'TimelineTaskRecipe'): RComponentSFC_IR_ElementNode[] {
  return props.sourceChildren?.filter((node): node is RComponentSFC_IR_ElementNode => node.kind === 'element' && node.tag === tag) ?? []
}

function readsContext(value: RComponentSFC_IR_Value | undefined): boolean {
  return value?.kind === 'expression' && value.reads.some(read => read.source === 'context')
}

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
  const timezone = typeof props.input.timezone === 'string' && props.input.timezone
    ? props.input.timezone
    : options.timezone || 'UTC'
  options.timezone = timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone
  if (sourceColumns.value) {
    options.groups = { ...options.groups, columns: sourceColumns.value }
  }
  else if (props.input.columns != null) {
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
  if (previewGroupsHidden) {
    options.groups = { ...options.groups, visible: !previewGroupsHidden.value && (options.groups?.visible ?? true) }
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
  if (sourceSnapshot && (sourceSnapshot.input !== props.input.data || sourceSnapshot.version !== renderVersion.value)) {
    sourceSnapshot = undefined
  }
  const data: TimelineData = sourceSnapshot?.data ?? (props.input.data == null
    ? (base.data ?? EMPTY_TIMELINE_DATA)
    : readTimelineData(props.input.data))
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

function indexEntities(data: TimelineData): void {
  entityIds = {}
  if (!props.boundaryId) {
    return
  }
  for (const collection of timelineCollections) {
    const ids = new Set<string>()
    const rows = data[collection] ?? []
    for (const row of rows) {
      if (typeof row?.id === 'string') {
        ids.add(row.id)
      }
    }
    if (ids.size === rows.length) {
      entityIds[collection] = ids
    }
  }
}

function applyDataPatch(patch: RuntimeBoundaryPatch): boolean {
  const live = chart
  if (!live || patch.kind !== 'timeline-data-update' || patch.boundaryId !== props.boundaryId || patch.dataSnapshot == null) {
    return false
  }

  try {
    const data = readTimelineData(patch.dataSnapshot)
    // A group can change the selected recipe of any task in that group.
    const replace = !patch.updates || (recipesReadGroup.value && patch.updates.some(update => update.collection === 'groups'))
      || patch.updates.some(update => !entityIds[update.collection]?.has(update.id))
    recipeData = replace && recipesReadGroup.value ? { ...data, groups: data.groups?.slice() } : data
    if (replace) {
      const range = live.getViewport().timeRange
      const snapshot = compactTimelineData(recipeData)
      live.data(snapshot, externalDataChange)
      indexEntities(snapshot)
      if (!sameTimelineRange(live.getViewport().timeRange, range)) {
        live.setViewport({ timeRange: range }, { source: 'timeline-sync' })
      }
    }
    else if (patch.updates?.length) {
      const updates: TimelineUpdates = {}
      for (const { collection, id, fields } of patch.updates) {
        (updates[collection] ??= []).push({ ...fields, id })
      }
      live.update(updates, externalDataChange)
    }
    sourceSnapshot = { input: props.input.data, version: renderVersion.value, data }
    appliedData = data
    if (observePreview && appliedOptions) {
      publishRecipePreview(presetConfig, { ...appliedOptions, profiles: appliedProfileSelection })
    }
    return true
  }
  catch {
    // Reconcile via the renderer if the native chart cannot apply the change.
    return false
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

function publishRecipePreview(base: Partial<TimelineChartMountConfig>, options: NonNullable<TimelineChartMountConfig['options']>) {
  if (!observePreview || props.sourceStart === undefined) {
    return
  }
  const profiles = Object.keys(base.taskProfiles?.profiles ?? {})
  const ids = new Set(profiles)
  const defaultProfile = options.profiles?.tasks?.default ?? base.defaultTaskProfile ?? base.taskProfiles?.defaultProfileId
  const profileByTask = new Map<string, string>()
  if (ids.size) {
    for (const task of recipeData.tasks ?? []) {
      if (!task) {
        continue
      }
      const profile = inheritedTimelineProfile(base, options, task)
      if (profile && ids.has(profile)) {
        profileByTask.set(task.id, profile)
      }
      else if (defaultProfile && ids.has(defaultProfile)) {
        profileByTask.set(task.id, defaultProfile)
      }
    }
  }
  const previous = clearRecipePreview
  clearRecipePreview = observePreview({
    sourceStart: props.sourceStart,
    chartKey: props.chartKey,
    data: recipeData,
    presetName: typeof props.input.preset === 'string' ? props.input.preset : undefined,
    presetResolved: Boolean(preset.value.value),
    presetError: preset.value.error || undefined,
    profiles,
    editableRecipes: preset.value.value?.provider.editableRecipes,
    defaultProfile,
    profileByTask,
    taskHeight: options.tasks?.height,
    expressionBindings: props.recipeContext
      ? { ...props.recipeContext.props, ...props.recipeContext.locals, props: props.recipeContext.props }
      : undefined,
    expressionContext: props.recipeContext,
  })
  previous?.()
}

async function reconcile(): Promise<void> {
  const currentGeneration = ++generation
  if (!active || !showCanvas.value) {
    dispose()
    return
  }
  try {
    // The visual editor can inspect authored recipes using the standard Timeline.
    if (preset.value.error && !observePreview) {
      throw new Error(preset.value.error)
    }
    timeline ??= await loadVueModuleTimeline()
    if (currentGeneration !== generation || !active || !target.value) {
      return
    }
    const nextPreset = { name: props.input.preset, settings: props.input.settings, compact: compact.value }
    const selectedPreset = preset.value.value
    const presetChanged = selectedPreset?.provider !== mountedProvider || !sameValue(nextPreset, mountedPreset)
    const context: TimelinePresetContext = { settings: selectedPreset?.settings ?? {}, collapsed: collapsed.value }
    const base = presetChanged ? selectedPreset?.provider.configure?.(context) ?? {} : presetConfig
    const { data, options } = configuration(base)
    const dataChanged = appliedData !== data || appliedRenderVersion !== renderVersion.value
    if (dataChanged || !chart) {
      recipeData = dataChanged && recipesReadGroup.value && data.groups ? { ...data, groups: data.groups.slice() } : data
    }
    const selection = options.profiles
    const recipes = taskRecipes.value
    const recipesChanged = appliedRecipes !== recipes && (appliedRecipes?.length !== recipes.length
      || recipes.some((node, index) => {
        const previous = appliedRecipes?.[index]
        return node.id !== previous?.id || !sameValue(node.props, previous?.props)
      }))
    const selectionChanged = !sameValue(appliedProfileSelection, selection)
    const bindingsChanged = appliedRecipeContext?.props !== props.recipeContext?.props
      || !sameValue(appliedRecipeContext?.locals, props.recipeContext?.locals)
    const recipeContextChanged = recipeExpressions.value.length > 0 && (bindingsChanged
      || appliedRecipeContext?.context !== props.recipeContext?.context
      || appliedRecipeTimezone !== recipeTimezone.value)
    if (recipesChanged || selectionChanged || presetChanged) {
      localProfiles = createTimelineRecipeProfiles(base, { profiles: selection }, recipes, () => ({
        data: recipeData,
        context: props.recipeContext,
      }), timeline.TimelineAssets, `${timelineId}-recipes`)
    }
    if (localProfiles) {
      options.profiles = { ...selection, tasks: { ...selection?.tasks, by: localProfiles.select } }
    }
    const theme = base.theme ?? props.theme ?? 'light'
    const old = chart?.getViewport()
    const authoredRange = readTimelineRange(options.timeRange)
    const rangeChanged = !sameTimelineRange(readTimelineRange(appliedOptions?.timeRange), authoredRange)
    const desiredRange = group?.viewport() ?? (rangeChanged ? authoredRange : old?.timeRange)

    if (!chart || presetChanged || recipesChanged || (localProfiles && selectionChanged) || removedOptions(appliedOptions, options)) {
      dispose()
      const mountOptions = desiredRange ? { ...options, timeRange: { ...options.timeRange, ...desiredRange } } : options
      const snapshot = compactTimelineData(recipeData)
      const handle = timeline.TimelineChart.mount(target.value, {
        ...base,
        ...(localProfiles ? { taskProfiles: localProfiles.taskProfiles } : {}),
        ...(localProfiles?.assets ? { assets: [...(base.assets ?? []), localProfiles.assets] } : {}),
        id: timelineId,
        theme,
        data: snapshot,
        options: mountOptions,
        width: group ? '100%' : base.width ?? '100%',
        height: '100%',
      })
      chart = handle
      indexEntities(snapshot)
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
      if (dataChanged) {
        const snapshot = compactTimelineData(recipeData)
        live.data(snapshot, externalDataChange)
        indexEntities(snapshot)
      }
      const previous = (appliedOptions ?? {}) as Record<string, unknown>
      const patch = Object.fromEntries(Object.entries(options).filter(([key, value]) => !sameValue(previous[key], value)))
      if (previewGroupsHidden && patch.groups && appliedOptions?.groups && options.groups) {
        const { visible: previousVisibility, ...previousGroups } = appliedOptions.groups
        const { visible, ...groups } = options.groups
        if (visible !== previousVisibility && sameValue(previousGroups, groups)) {
          patch.groups = { visible }
        }
      }
      // The store merges options, while the renderer reads profiles from the latest patch.
      if (options.profiles && ((localProfiles && recipeContextChanged) || Object.keys(patch).length)) {
        patch.profiles = options.profiles
      }
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
    if (observePreview && (!clearRecipePreview || appliedSourceStart !== props.sourceStart || dataChanged
      || presetChanged || selectionChanged || bindingsChanged || appliedRecipeContext?.context !== props.recipeContext?.context
      || appliedOptions?.tasks?.height !== options.tasks?.height)) {
      publishRecipePreview(base, { ...options, profiles: selection })
    }
    appliedOptions = options
    appliedTheme = theme
    appliedData = data
    appliedRenderVersion = renderVersion.value
    appliedRecipes = recipes
    appliedProfileSelection = selection
    appliedRecipeContext = props.recipeContext
    appliedSourceStart = props.sourceStart
    appliedRecipeTimezone = recipeTimezone.value
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
watch(() => props.boundaryId, (id, _previous, onCleanup) => {
  if (boundaries && id) {
    onCleanup(boundaries.register(id, { applyPatch: applyDataPatch }))
  }
}, { immediate: true })
watch([
  () => props.input,
  renderVersion,
  columnNodes,
  taskRecipes,
  columnTimezone,
  recipeTimezone,
  () => observePreview || columnNodes.value.length || recipeExpressions.value.length ? props.recipeContext : undefined,
  () => props.modulePreset,
  () => props.readonly,
  () => props.theme,
  showCanvas,
  compact,
  () => group?.labelWidth.value,
  () => previewGroupsHidden?.value,
], () => {
  void reconcile()
}, { flush: 'post' })
onMounted(() => {
  active = true
  void reconcile()
})
onBeforeUnmount(() => {
  active = false
  generation++
  clearRecipePreview?.()
  dispose()
})
</script>

<template>
  <section v-bind="$attrs" class="endge-timeline-chart" :aria-label="title || undefined" :class="{ 'endge-timeline-chart--collapsed': collapsed }">
    <header v-if="title" class="endge-timeline-chart__title">
      {{ title }}
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
    <button
      v-if="group || collapsed"
      type="button"
      class="endge-timeline-chart__collapse"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? 'Развернуть диаграмму Timeline' : 'Свернуть диаграмму Timeline'"
      @click="collapsed = !collapsed"
    >
      <ChevronDown v-if="collapsed" :size="16" aria-hidden="true" />
      <ChevronUp v-else :size="16" aria-hidden="true" />
    </button>
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
.endge-timeline-chart { position: relative; min-width: 0; flex-shrink: 0; }
.endge-timeline-chart__title {
  min-height: 1.875rem;
  padding: .375rem 3rem .375rem .625rem;
  color: inherit;
  font-size: .875rem;
  font-weight: 600;
}
.endge-timeline-chart--collapsed { min-height: 32px; }
.endge-timeline-chart__collapse {
  position: absolute;
  top: 4px;
  inset-inline-end: 20px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--endge-border, GrayText);
  border-radius: 4px;
  background: var(--endge-surface, Canvas);
  color: inherit;
  cursor: pointer;
}
@media (hover: hover) {
  .endge-timeline-chart:not(.endge-timeline-chart--collapsed):not(:hover) > .endge-timeline-chart__collapse:not(:focus-visible) {
    opacity: 0;
    pointer-events: none;
  }
}
.endge-timeline-chart__surface { position: relative; width: 100%; }
.endge-timeline-chart__canvas { width: 100%; height: 100%; overflow: hidden; }
.endge-timeline-chart__status { position: absolute; inset: 0; display: grid; place-content: center; padding: 12px; background: var(--endge-surface, Canvas); }
.endge-timeline-chart__splitter { position: relative; height: 8px; cursor: row-resize; touch-action: none; }
.endge-timeline-chart__splitter::after { content: ''; position: absolute; inset: 3px 0; background: currentColor; opacity: .18; }
.endge-timeline-chart__splitter:hover::after, .endge-timeline-chart__splitter:focus-visible::after { opacity: .6; }
</style>
