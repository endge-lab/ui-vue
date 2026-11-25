import type { ModuleTimelinePresetDescriptor, ModuleTimelinePresetReference, RuntimeScope, TimelineRecipeLayout } from '@endge/core'
import type { TimelineChartHandle, TimelineChartMountConfig } from '@nova-lab/timeline'

import { Endge, workspaceModuleAttachment } from '@endge/core'
import { VUE_MODULE_TIMELINE_PRESETS } from '@/services/modules/vue-module'

interface TimelinePresetFieldBase {
  label: string
}

export type TimelinePresetField = TimelinePresetFieldBase & (
  | { type: 'boolean', default?: boolean }
  | { type: 'number', default?: number }
  | { type: 'string' | 'color', default?: string, values?: readonly string[] }
)

export interface TimelinePresetDescriptor extends ModuleTimelinePresetDescriptor {
  fields: Readonly<Record<string, TimelinePresetField>>
  compact?: boolean
}

export interface TimelinePresetContext {
  settings: Readonly<Record<string, unknown>>
  collapsed: boolean
}

export interface TimelinePresetEditableRecipe {
  name?: string
  kind?: string
  when?: string
  recipe: TimelineRecipeLayout
}

export interface TimelinePresetProvider {
  // Optional Source templates keyed by the IDs returned in configure().taskProfiles.
  editableRecipes?: Readonly<Record<string, TimelinePresetEditableRecipe>>
  configure?: (context: TimelinePresetContext) => Partial<Omit<TimelineChartMountConfig, 'id'>>
  mounted?: (chart: TimelineChartHandle, context: TimelinePresetContext) => void | (() => void)
}

export interface TimelinePresetEntry {
  descriptor: TimelinePresetDescriptor
  provider?: TimelinePresetProvider
}

const presets = new Map<string, TimelinePresetEntry>()

// Компоненты разрешают только те реализации, которые явно зарегистрировал Vue-хост.
export function registerTimelinePreset(descriptor: TimelinePresetDescriptor, provider?: TimelinePresetProvider): () => void {
  const name = descriptor.name
  if (!name.trim() || presets.has(name)) {
    throw new Error(`Preset Timeline "${name}" уже зарегистрирован или не имеет имени.`)
  }
  const entry = { descriptor: structuredClone(descriptor), provider }
  presets.set(name, entry)
  return () => {
    if (presets.get(name) === entry) {
      presets.delete(name)
    }
  }
}

export function listTimelinePresets(scope?: RuntimeScope | null): TimelinePresetDescriptor[] {
  const available = new Map(presets)
  const workspaceScope = Endge.runtime.workspaceModuleScope
  for (const reference of workspaceTimelinePresets()) {
    const entry = resolveWorkspaceTimelinePreset(workspaceScope, reference)
    available.set(reference.name, entry?.value ?? { descriptor: { name: reference.name, fields: {} } })
  }
  for (const [name, { value }] of Endge.runtime.modules.list<TimelinePresetEntry>(scope ?? null, VUE_MODULE_TIMELINE_PRESETS, workspaceScope)) {
    available.set(name, value)
  }
  return [...available.values()].map(({ descriptor }) => structuredClone(descriptor))
}

export function resolveTimelinePresetContribution(
  scope: RuntimeScope | null,
  name: string,
): { value: TimelinePresetEntry, visualToken?: string } | undefined {
  const workspaceScope = Endge.runtime.workspaceModuleScope
  const local = Endge.runtime.modules.resolve<TimelinePresetEntry>(scope, VUE_MODULE_TIMELINE_PRESETS, name, workspaceScope)
  if (local) {
    return local
  }
  const reference = workspaceTimelinePresets().find(preset => preset.name === name)
  return reference && (resolveWorkspaceTimelinePreset(workspaceScope, reference)
    ?? { value: { descriptor: { name, fields: {} } } })
}

function workspaceTimelinePresets(): readonly ModuleTimelinePresetReference[] {
  return Endge.configuration.isResolved && Endge.mode !== 'debugger'
    ? Endge.configuration.current.timelinePresets ?? []
    : []
}

function resolveWorkspaceTimelinePreset(scope: RuntimeScope | null, reference: ModuleTimelinePresetReference) {
  return Endge.runtime.modules.resolveAttachment<TimelinePresetEntry>(
    scope,
    workspaceModuleAttachment(reference),
    VUE_MODULE_TIMELINE_PRESETS,
    reference.name,
  )
}

export function resolveTimelinePreset(name: unknown, settings: unknown, entry?: TimelinePresetEntry) {
  if (name == null || name === '') {
    if (settings != null && Object.keys(settings).length) {
      throw new Error('Укажите пресет Timeline для settings.')
    }
    return undefined
  }
  const preset = entry ?? (typeof name === 'string' ? presets.get(name) : undefined)
  if (!preset?.provider) {
    throw new Error(`Реализация пресета Timeline "${String(name)}" недоступна в текущем хосте.`)
  }
  if (settings != null && (typeof settings !== 'object' || Array.isArray(settings))) {
    throw new TypeError('Настройки пресета Timeline должны быть объектом.')
  }
  const authored = (settings ?? {}) as Record<string, unknown>
  const fields = preset.descriptor.fields
  for (const key of Object.keys(authored)) {
    if (!Object.hasOwn(fields, key)) {
      throw new Error(`Неизвестный параметр пресета Timeline: ${key}.`)
    }
  }
  const values = Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const value = authored[key] ?? field.default
    const valid = value === undefined || (
      field.type === 'number'
        ? typeof value === 'number' && Number.isFinite(value)
        : field.type === 'boolean'
          ? typeof value === 'boolean'
          : typeof value === 'string' && (!field.values || field.values.includes(value))
    )
    if (!valid) {
      throw new Error(`Некорректное значение параметра Timeline: ${key}.`)
    }
    return [key, value]
  }))
  return { provider: preset.provider, compact: preset.descriptor.compact === true, settings: Object.freeze(values) }
}
