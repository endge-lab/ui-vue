import type { RComponentSFC_IR_ElementNode, SFCExpressionEvaluationContext, TimelineRecipeBounds, TimelineRecipeFill, TimelineRecipeGeometry, TimelineRecipeLayout, TimelineRecipeRect, TimelineRecipeStyle, TimelineRecipeStyleField, TimelineRecipeStyleValues } from '@endge/core'
import type { NovaAssets } from '@nova-lab/core'
import type { TimelineChartMountConfig, TimelineGroupInput, TimelineTaskInput, TimelineTaskRecipe, TimelineTaskRecipeContext } from '@nova-lab/timeline'
import type { InjectionKey } from 'vue'
import type { TimelinePresetProvider } from './timeline-presets'
import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'
import { applyTimelineRecipeStyle, isTimelineRecipeContentVisible, measureTimelineRecipe, readTimelineRecipeText, resolveTimelineRecipeStyle, TIMELINE_RECIPE_EXPRESSION_PREFIX, timelineRecipeRects, validateTimelineRecipeLayout } from '@endge/core'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import { timelineRecipeElementAsset } from './timeline-recipe-element'
import { timelineRecipeIconAsset } from './timeline-recipe-icon'

type ChartOptions = NonNullable<TimelineChartMountConfig['options']>
type ChartData = NonNullable<TimelineChartMountConfig['data']>
type TaskProfiles = NonNullable<TimelineChartMountConfig['taskProfiles']>
type TaskProfileSelector = NonNullable<NonNullable<ChartOptions['profiles']>['tasks']>['by']
interface PreparedRecipe extends TimelineRecipeGeometry {
  styles?: Record<string, { visible?: boolean, rect: TimelineRecipeRect }>
  hiddenContent?: ReadonlySet<string>
}
type RecipeContext = TimelineTaskRecipeContext<TimelineGroupInput, TimelineTaskInput, PreparedRecipe>

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
  expressionContext?: SFCExpressionEvaluationContext
}

export const timelineRecipePreviewKey: InjectionKey<(preview: TimelineRecipeChartPreview) => () => void>
  = Symbol('endge-timeline-recipe-preview')

const emptyBounds: TimelineRecipeBounds = { x: 0, y: 0, width: 0, height: 0 }

function solidCanvas(color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
  }
  return canvas
}

function createRecipeAssets(api: typeof NovaAssets, namespace: string) {
  const fills: NonNullable<Parameters<typeof api.define>[1]['fills']> = Object.create(null)
  const fillNames = new Map<string, string>()

  return {
    fill(fill: TimelineRecipeFill): string {
      const key = JSON.stringify(fill)
      let name = fillNames.get(key)
      if (!name) {
        name = `fill-${fillNames.size}`
        fillNames.set(key, name)
        if (typeof fill === 'string') {
          fills[name] = api.canvas(solidCanvas(fill))
        }
        else {
          fills[name] = fill.type === 'stripe'
            ? api.stripe({ bgColor: fill.background, stripeColor: fill.color, stripeWidth: fill.width, angle: fill.angle, sizeK: 16 })
            : api.linearGradient({ from: fill.from, to: fill.to, angle: fill.angle })
        }
      }
      return `${namespace}/fills/${name}`
    },
    bundle() {
      return fillNames.size ? api.define(namespace, { fills }) : undefined
    },
  }
}

function hasStyle(item: TimelineRecipeRect, key: TimelineRecipeStyleField): boolean {
  return Boolean(item.appearance?.expressions?.[key]
    || item.appearance?.colors?.[key as keyof NonNullable<TimelineRecipeStyle['colors']>]?.length
    || item.appearance?.rules?.some(rule => Object.hasOwn(rule.values, key)))
}

export function createTimelineTaskRenderRecipe(
  layout: TimelineRecipeLayout,
  assets?: Pick<ReturnType<typeof createRecipeAssets>, 'fill'>,
  evaluate?: (source: string, task: TimelineTaskInput) => unknown,
): TimelineTaskRecipe<TimelineGroupInput, TimelineTaskInput> {
  validateTimelineRecipeLayout(layout)
  const layers = new Set(layout.overlays?.map(item => item.id))
  const elements = new Map(layout.elements?.map(item => [item.id, item]))
  // The texture pass preserves authoring order when upper layers mix colors and textures.
  const texturedOverlays = Boolean(assets && layout.overlays?.some(item => typeof item.fill !== 'string'))
  const items = timelineRecipeRects(layout)
  const dynamicItems = evaluate ? items.filter(item => item.appearance) : []
  const conditionalContent = items.flatMap(({ id, content }) => content?.when === undefined ? [] : [{ id, content }])
  const solidTextures = new Map<string, HTMLCanvasElement>()
  const rects = items.map((item) => {
    const element = elements.get(item.id)
    const box = (ctx: RecipeContext) => (element ? ctx.prepared.elementClips?.[item.id] : ctx.prepared.rectangles[item.id]) ?? emptyBounds
    const appearance = (ctx: RecipeContext) => ctx.prepared.styles?.[item.id]
    const styled = (ctx: RecipeContext) => appearance(ctx)?.rect ?? item
    const sizeIsVisible = (ctx: RecipeContext) => box(ctx).width > 0 && box(ctx).height > 0
    const active = hasStyle(item, 'visible')
      ? (ctx: RecipeContext) => appearance(ctx)?.visible !== false && sizeIsVisible(ctx)
      : sizeIsVisible
    return {
      item,
      element,
      textured: Boolean(assets && (typeof item.fill !== 'string' || (texturedOverlays && layers.has(item.id)))),
      primitive: {
        id: item.id,
        active,
        x: (ctx: RecipeContext) => box(ctx).x,
        y: (ctx: RecipeContext) => box(ctx).y,
        width: (ctx: RecipeContext) => box(ctx).width,
        height: (ctx: RecipeContext) => box(ctx).height,
      },
      box,
      styled,
      contentActive: item.content?.when === undefined
        ? active
        : (ctx: RecipeContext) => active(ctx) && !ctx.prepared.hiddenContent?.has(item.id),
    }
  })
  const recipe: TimelineTaskRecipe<TimelineGroupInput, TimelineTaskInput, PreparedRecipe> = {
    prepare: (ctx) => {
      const read = evaluate && ((source: string) => evaluate(source, ctx.item))
      const styles: PreparedRecipe['styles'] = dynamicItems.length ? Object.create(null) : undefined
      const values: Record<string, Partial<TimelineRecipeStyleValues>> | undefined = styles && Object.create(null)
      if (read && styles && values) {
        for (const item of dynamicItems) {
          const style = resolveTimelineRecipeStyle(item.appearance!, read)
          values[item.id] = style
          styles[item.id] = { visible: style.visible, rect: applyTimelineRecipeStyle(item, style) }
        }
      }
      let hiddenContent: Set<string> | undefined
      for (const { id, content } of conditionalContent) {
        if (!isTimelineRecipeContentVisible(content, read)) {
          (hiddenContent ??= new Set()).add(id)
        }
      }
      const geometry = measureTimelineRecipe(layout, {
        bounds: { x: ctx.x, y: ctx.y, width: ctx.width, height: ctx.height },
        task: ctx.item,
        timeToPx: time => ctx.api.timeToPx(time),
        evaluate: read,
        styles: values,
      })
      return styles || hiddenContent ? { ...geometry, styles, hiddenContent } : geometry
    },
    rects: rects.flatMap(({ item, element, primitive, textured, styled }) => !element && !textured && typeof item.fill === 'string'
      ? [{
          ...primitive,
          color: hasStyle(item, 'fill') ? (ctx: RecipeContext) => styled(ctx).fill as string : item.fill,
          layer: layers.has(item.id) ? 'overlay' as const : 'base' as const,
          radius: hasStyle(item, 'radius') ? (ctx: RecipeContext) => styled(ctx).radius ?? 0 : item.radius,
          opacity: hasStyle(item, 'opacity') ? (ctx: RecipeContext) => styled(ctx).opacity ?? 1 : item.opacity,
        }]
      : []),
    stripes: assets
      ? rects.flatMap(({ item, element, primitive, textured, styled }) => {
          if (element || !textured) {
            return []
          }
          const base = assets.fill(item.fill)
          const textures = new Map(item.appearance?.textures?.map(({ fill }) => [fill, assets.fill(fill)]))
          return [{
            ...primitive,
            fill: textures.size
              ? (ctx: RecipeContext) => {
                  const fill = styled(ctx).fill
                  return typeof fill === 'string' ? base : textures.get(fill) ?? base
                }
              : typeof item.fill === 'string' && hasStyle(item, 'fill')
                ? (ctx: RecipeContext) => {
                    const color = styled(ctx).fill as string
                    if (color === item.fill) {
                      return base
                    }
                    let canvas = solidTextures.get(color)
                    if (!canvas) {
                      if (solidTextures.size >= 128) {
                        solidTextures.delete(solidTextures.keys().next().value!)
                      }
                      canvas = solidCanvas(color)
                      solidTextures.set(color, canvas)
                    }
                    return canvas
                  }
                : base,
          }]
        })
      : undefined,
    borders: rects.flatMap(({ item, element, primitive, styled }) => !element && (item.border || hasStyle(item, 'borderVisible'))
      ? [{
          ...primitive,
          active: hasStyle(item, 'borderVisible') ? (ctx: RecipeContext) => primitive.active(ctx) && Boolean(styled(ctx).border) : primitive.active,
          color: hasStyle(item, 'borderColor') ? (ctx: RecipeContext) => styled(ctx).border?.color ?? '#fff' : item.border?.color ?? '#fff',
          widthPx: hasStyle(item, 'borderWidth') ? (ctx: RecipeContext) => styled(ctx).border?.width ?? 1 : item.border?.width ?? 1,
          radius: hasStyle(item, 'radius') ? (ctx: RecipeContext) => styled(ctx).radius ?? 0 : item.radius,
          dashPattern: hasStyle(item, 'borderStyle')
            ? (ctx: RecipeContext) => styled(ctx).border?.style === 'dashed' ? [4, 2] as [number, number] : undefined
            : item.border?.style === 'dashed' ? [4, 2] as [number, number] : undefined,
        }]
      : []),
    labels: rects.flatMap(({ item, primitive, box, styled, contentActive }) => {
      const content = item.content
      if (content?.type !== 'text') {
        return []
      }
      const style = content.textStyle
      const clip = style?.clip ?? true
      const padding = style?.paddingX ?? 3
      const minWidth = style?.minWidth ?? 12
      const dynamicPadding = hasStyle(item, 'paddingX') || hasStyle(item, 'clip')
      const contentFor = (ctx: RecipeContext) => styled(ctx).content ?? content
      const styleFor = (ctx: RecipeContext) => contentFor(ctx).textStyle
      const fontFor = (textStyle = style) => ({
        size: textStyle?.size ?? 11,
        family: textStyle?.family ?? 'sans-serif',
        weight: textStyle?.bold ? 'bold' as const : 'normal' as const,
        style: textStyle?.italic ? 'italic' as const : 'normal' as const,
      })
      const alignFor = (value = content) => ({ horizontal: value.align, vertical: value.textStyle?.vertical ?? 'middle' as const })
      const inset = (ctx: RecipeContext) => Math.min(styleFor(ctx)?.paddingX ?? padding, box(ctx).width / 2)
      const ellipses = hasStyle(item, 'ellipsis') ? [true, false] : [style?.ellipsis ?? true]
      const lineHeights = new Set([style?.lineHeight, ...(item.appearance?.rules?.flatMap(rule => rule.values.lineHeight === undefined ? [] : [rule.values.lineHeight]) ?? [])])
      const variants = ellipses.length * lineHeights.size > 1
      return ellipses.flatMap(ellipsis => Array.from(lineHeights, lineHeight => ({
        ...primitive,
        id: variants ? `${primitive.id}-ellipsis-${ellipsis}-line-${lineHeight ?? 'auto'}` : primitive.id,
        active: variants
          ? (ctx: RecipeContext) => contentActive(ctx) && (styleFor(ctx)?.ellipsis ?? true) === ellipsis && styleFor(ctx)?.lineHeight === lineHeight
          : contentActive,
        ...(dynamicPadding
          ? {
              x: (ctx: RecipeContext) => box(ctx).x + inset(ctx),
              width: (ctx: RecipeContext) => Math.max(0, box(ctx).width - 2 * inset(ctx)),
            }
          : clip
            ? { padding: { left: padding, right: padding } }
            : {
                x: (ctx: RecipeContext) => box(ctx).x + Math.min(padding, box(ctx).width / 2),
                width: (ctx: RecipeContext) => Math.max(0, box(ctx).width - 2 * padding),
              }),
        text: content.expression || content.field
          ? (ctx: RecipeContext) => readTimelineRecipeText(content, ctx.item, evaluate && (source => evaluate(source, ctx.item)))
          : content.value,
        font: (['fontSize', 'fontFamily', 'bold', 'italic'] as const).some(key => hasStyle(item, key))
          ? (ctx: RecipeContext) => fontFor(styleFor(ctx))
          : fontFor(),
        color: hasStyle(item, 'textColor') ? (ctx: RecipeContext) => styleFor(ctx)?.color ?? '#fff' : style?.color ?? '#fff',
        align: hasStyle(item, 'align') || hasStyle(item, 'vertical') ? (ctx: RecipeContext) => alignFor(contentFor(ctx)) : alignFor(),
        lineHeight,
        minWidthPx: dynamicPadding || hasStyle(item, 'minWidth') || !clip
          ? (ctx: RecipeContext) => Math.max(0, (styleFor(ctx)?.minWidth ?? minWidth) - (dynamicPadding || !clip ? 2 * inset(ctx) : 0))
          : minWidth,
        minHeightPx: hasStyle(item, 'minHeight') ? (ctx: RecipeContext) => styleFor(ctx)?.minHeight ?? 0 : style?.minHeight,
        ellipsis,
        clip: hasStyle(item, 'clip') ? (ctx: RecipeContext) => styleFor(ctx)?.clip ?? clip : clip,
      })))
    }),
    icons: [
      ...rects.flatMap(({ item, element, primitive, box, styled }) => element
        ? [{
            ...primitive,
            asset: (ctx: RecipeContext) => timelineRecipeElementAsset(element.shape, styled(ctx), ctx.prepared.rectangles[item.id] ?? emptyBounds, box(ctx)),
          }]
        : []),
      ...rects.flatMap(({ item, element, primitive, box, styled, contentActive }) => {
        const content = item.content
        if (content?.type !== 'icon') {
          return []
        }
        const size = (ctx: RecipeContext) => Math.min(element ? Infinity : 12, Math.max(0, box(ctx).width - 2), Math.max(0, box(ctx).height - 2))
        const dynamicIcon = content.iconSource === 'asset'
          ? hasStyle(item, 'assetId')
          : hasStyle(item, 'iconColor') || (content.iconSource === 'lucide' && hasStyle(item, 'iconName'))
        const dynamicAlign = hasStyle(item, 'align')
        return [{
          ...primitive,
          active: contentActive,
          asset: dynamicIcon
            ? (ctx: RecipeContext) => timelineRecipeIconAsset(styled(ctx).content ?? content)
            : () => timelineRecipeIconAsset(content),
          x: (ctx: RecipeContext) => {
            const { x, width } = box(ctx)
            const align = dynamicAlign ? styled(ctx).content?.align : content.align
            if (align === 'left') {
              return x + 1
            }
            if (align === 'right') {
              return x + width - size(ctx) - 1
            }
            return x + (width - size(ctx)) / 2
          },
          y: (ctx: RecipeContext) => box(ctx).y + (box(ctx).height - size(ctx)) / 2,
          width: size,
          height: size,
        }]
      }),
    ],
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
  assetApi: typeof NovaAssets,
  assetNamespace: string,
): { taskProfiles: TaskProfiles, select: NonNullable<TaskProfileSelector>, assets?: ReturnType<typeof assetApi.define> } | undefined {
  if (!nodes.length) {
    return undefined
  }
  const profiles = { ...base.taskProfiles?.profiles }
  const assets = createRecipeAssets(assetApi, assetNamespace)
  let previousGroups: ChartData['groups']
  let groups = new Map<string, TimelineGroupInput>()
  function contextForTask(task: TimelineTaskInput): SFCVueRenderContext | undefined {
    const { data, context } = current()
    if (!context) {
      return
    }
    if (previousGroups !== data.groups) {
      previousGroups = data.groups
      groups = new Map(previousGroups?.flatMap(group => group ? [[group.id, group]] : []))
    }
    const group = task.groupId == null ? null : groups.get(task.groupId) ?? null
    return { ...context, locals: { ...context.locals, $task: task, $group: group } }
  }
  const entries = nodes.flatMap((node) => {
    const layout = node.props.recipe
    if (layout?.kind !== 'literal') {
      return []
    }
    let id = `endge:recipe:${node.id}`
    while (Object.hasOwn(profiles, id)) {
      id += ':local'
    }
    const evaluate = (source: string, task: TimelineTaskInput) => {
      const context = contextForTask(task)
      return context ? evaluateSFCValue(node.props[`${TIMELINE_RECIPE_EXPRESSION_PREFIX}${source}`], context) : undefined
    }
    const hasExpressions = Object.keys(node.props).some(key => key.startsWith(TIMELINE_RECIPE_EXPRESSION_PREFIX))
    profiles[id] = { recipe: createTimelineTaskRenderRecipe(layout.value as TimelineRecipeLayout, assets, hasExpressions ? evaluate : undefined) }
    const kind = node.props.kind?.kind === 'literal' ? node.props.kind.value : undefined
    return [{ id, kind, when: node.props.when }]
  })
  const defaultProfileId = options.profiles?.tasks?.default ?? base.defaultTaskProfile ?? base.taskProfiles?.defaultProfileId ?? 'default'
  return {
    taskProfiles: { ...base.taskProfiles, profiles, defaultProfileId },
    assets: assets.bundle(),
    select: (task) => {
      for (const entry of entries) {
        if (entry.kind && entry.kind !== task.kind) {
          continue
        }
        if (entry.when) {
          try {
            const recipeContext = contextForTask(task)
            if (!recipeContext || !evaluateSFCValue(entry.when, recipeContext)) {
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
