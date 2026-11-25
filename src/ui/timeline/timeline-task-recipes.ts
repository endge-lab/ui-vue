import type { RComponentSFC_IR_ElementNode, TimelineRecipeBounds, TimelineRecipeGeometry, TimelineRecipeLayout } from '@endge/core'
import type { TimelineChartMountConfig, TimelineGroupInput, TimelineTaskInput, TimelineTaskRecipe, TimelineTaskRecipeContext } from '@nova-lab/timeline'
import type { InjectionKey } from 'vue'
import type { TimelinePresetProvider } from './timeline-presets'
import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'
import { measureTimelineRecipe, timelineRecipeField, timelineRecipeRects, validateTimelineRecipeLayout } from '@endge/core'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

type ChartOptions = NonNullable<TimelineChartMountConfig['options']>
type ChartData = NonNullable<TimelineChartMountConfig['data']>
type TaskProfiles = NonNullable<TimelineChartMountConfig['taskProfiles']>
type TaskProfileSelector = NonNullable<NonNullable<ChartOptions['profiles']>['tasks']>['by']
type RecipeContext = TimelineTaskRecipeContext<TimelineGroupInput, TimelineTaskInput, TimelineRecipeGeometry>

export interface TimelineRecipeChartPreview {
  sourceStart: number
  chartKey: string
  data: ChartData
  presetName?: string
  presetResolved: boolean
  presetError?: string
  profiles: readonly string[]
  editableRecipes?: TimelinePresetProvider['editableRecipes']
  defaultProfile?: string
  profileByTask: ReadonlyMap<string, string>
  taskHeight?: number
  expressionBindings?: Readonly<Record<string, unknown>>
}

export const timelineRecipePreviewKey: InjectionKey<(preview: TimelineRecipeChartPreview) => () => void>
  = Symbol('endge-timeline-recipe-preview')

const emptyBounds: TimelineRecipeBounds = { x: 0, y: 0, width: 0, height: 0 }
const iconAssets = new Map<string, HTMLCanvasElement>()

function iconAsset(icon: string): HTMLCanvasElement | undefined {
  const existing = iconAssets.get(icon)
  if (existing || !icon || typeof document === 'undefined') {
    return existing
  }
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d')
  if (!context) {
    return undefined
  }
  context.font = 'bold 26px sans-serif'
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(Array.from(icon).slice(0, 2).join(''), 16, 17, 30)
  if (iconAssets.size >= 64) {
    iconAssets.clear()
  }
  iconAssets.set(icon, canvas)
  return canvas
}

export function createTimelineTaskRenderRecipe(layout: TimelineRecipeLayout): TimelineTaskRecipe<TimelineGroupInput, TimelineTaskInput> {
  validateTimelineRecipeLayout(layout)
  const layers = new Set(layout.overlays?.map(item => item.id))
  const rects = timelineRecipeRects(layout).map((item) => {
    const box = (ctx: RecipeContext) => ctx.prepared.rectangles[item.id] ?? emptyBounds
    const active = (ctx: RecipeContext) => box(ctx).width > 0 && box(ctx).height > 0
    return {
      item,
      primitive: {
        id: item.id,
        active,
        x: (ctx: RecipeContext) => box(ctx).x,
        y: (ctx: RecipeContext) => box(ctx).y,
        width: (ctx: RecipeContext) => box(ctx).width,
        height: (ctx: RecipeContext) => box(ctx).height,
      },
      box,
    }
  })
  const recipe: TimelineTaskRecipe<TimelineGroupInput, TimelineTaskInput, TimelineRecipeGeometry> = {
    prepare: ctx => measureTimelineRecipe(layout, {
      bounds: { x: ctx.x, y: ctx.y, width: ctx.width, height: ctx.height },
      task: ctx.item,
      timeToPx: time => ctx.api.timeToPx(time),
    }),
    rects: rects.map(({ item, primitive }) => ({
      ...primitive,
      color: item.fill,
      layer: layers.has(item.id) ? 'overlay' : 'base',
    })),
    labels: rects.flatMap(({ item, primitive }) => {
      const content = item.content
      if (content?.type !== 'text') {
        return []
      }
      return [{
        ...primitive,
        text: (ctx: RecipeContext) => String((content.field ? timelineRecipeField(ctx.item, content.field) : null) ?? content.value),
        font: { size: 11, family: 'sans-serif' },
        color: '#fff',
        align: { horizontal: content.align, vertical: 'middle' },
        minWidthPx: 12,
        padding: { left: 3, right: 3 },
        ellipsis: true,
        clip: true,
      }]
    }),
    icons: rects.flatMap(({ item, primitive, box }) => {
      const content = item.content
      if (content?.type !== 'icon') {
        return []
      }
      const size = (ctx: RecipeContext) => Math.min(12, Math.max(0, box(ctx).width - 2), Math.max(0, box(ctx).height - 2))
      return [{
        ...primitive,
        asset: () => iconAsset(content.value),
        x: (ctx: RecipeContext) => {
          const { x, width } = box(ctx)
          if (content.align === 'left') {
            return x + 1
          }
          if (content.align === 'right') {
            return x + width - size(ctx) - 1
          }
          return x + (width - size(ctx)) / 2
        },
        y: (ctx: RecipeContext) => box(ctx).y + (box(ctx).height - size(ctx)) / 2,
        width: size,
        height: size,
      }]
    }),
  }
  return recipe as unknown as TimelineTaskRecipe<TimelineGroupInput, TimelineTaskInput>
}

function readSelector(selector: TaskProfileSelector, task: TimelineTaskInput): string | null | undefined {
  if (typeof selector === 'function') {
    return selector(task)
  }
  const value = selector && task[selector as keyof TimelineTaskInput]
  return value == null || !selector ? undefined : String(value)
}

export function inheritedTimelineProfile(base: Partial<TimelineChartMountConfig>, options: ChartOptions, task: TimelineTaskInput): string | undefined {
  const selection = options.profiles?.tasks
  const baseResolver = base.resolveTaskProfile
    ?? (base.taskProfileBy ? (task: TimelineTaskInput) => readSelector(base.taskProfileBy, task) : base.taskProfiles?.resolveProfile)
  return (selection ? readSelector(selection.by, task) ?? task.profile ?? task.kind ?? selection.default : undefined)
    ?? baseResolver?.(task)
    ?? selection?.default ?? base.defaultTaskProfile ?? base.taskProfiles?.defaultProfileId
}

export function createTimelineRecipeProfiles(
  base: Partial<TimelineChartMountConfig>,
  options: ChartOptions,
  nodes: readonly RComponentSFC_IR_ElementNode[],
  current: () => { data: ChartData, context?: SFCVueRenderContext },
): { taskProfiles: TaskProfiles, select: NonNullable<TaskProfileSelector> } | undefined {
  if (!nodes.length) {
    return undefined
  }
  const profiles = { ...base.taskProfiles?.profiles }
  const entries = nodes.flatMap((node) => {
    const layout = node.props.recipe
    if (layout?.kind !== 'literal') {
      return []
    }
    let id = `endge:recipe:${node.id}`
    while (Object.hasOwn(profiles, id)) {
      id += ':local'
    }
    profiles[id] = { recipe: createTimelineTaskRenderRecipe(layout.value as TimelineRecipeLayout) }
    const kind = node.props.kind?.kind === 'literal' ? node.props.kind.value : undefined
    return [{ id, kind, when: node.props.when }]
  })
  const defaultProfileId = options.profiles?.tasks?.default ?? base.defaultTaskProfile ?? base.taskProfiles?.defaultProfileId ?? 'default'
  let previousGroups: ChartData['groups']
  let groups = new Map<string, TimelineGroupInput>()
  return {
    taskProfiles: { ...base.taskProfiles, profiles, defaultProfileId },
    select: (task) => {
      const { data, context } = current()
      for (const entry of entries) {
        if (entry.kind && entry.kind !== task.kind) {
          continue
        }
        if (entry.when) {
          if (!context) {
            continue
          }
          try {
            if (previousGroups !== data.groups) {
              previousGroups = data.groups
              groups = new Map(previousGroups?.map(group => [group.id, group]))
            }
            const group = task.groupId == null ? null : groups.get(task.groupId) ?? null
            const recipeContext = { ...context, locals: { ...context.locals, $task: task, $group: group } }
            if (!evaluateSFCValue(entry.when, recipeContext)) {
              continue
            }
          }
          catch {
            continue
          }
        }
        return entry.id
      }
      return inheritedTimelineProfile(base, options, task) ?? defaultProfileId
    },
  }
}
