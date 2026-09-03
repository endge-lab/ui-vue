import type {
  ComponentSFCEventRuntimeSource,
  ComponentSFCInteractionTrigger,
  ComponentSFCInteractionTriggerEvent,
  ComponentSFCInteractionTriggerPlatform,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_EventBinding,
  RComponentSFC_IR_EventModifier,
  RComponentSFC_IR_InteractionRule,
} from '@endge/core'
import type { KeyboardStateSnapshot } from '@endge/utils'
import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-vue-render.type'

import {
  matchesComponentSFCInteractionTrigger,
  normalizeComponentSFCInteractionTriggers,
  resolveComponentSFCInteractionTriggerPlatform,
} from '@endge/core'
import { getKeyboardStateSnapshot } from '@endge/utils'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

const claimedGroups = new WeakMap<Event, Set<string>>()
const occurredAtByEvent = new WeakMap<Event, string>()

type SFCInteractionGroup = NonNullable<RComponentSFC_IR_ElementNode['interactions']>[number]
interface SFCInteractionTriggerSet {
  triggers: RComponentSFC_IR_InteractionRule['trigger']
  events: string[]
  modifiers: RComponentSFC_IR_EventModifier[]
  reactions: RComponentSFC_IR_InteractionRule['reactions']
  sourceRange?: RComponentSFC_IR_InteractionRule['sourceRange']
}
type SFCInteractionGroupWithTriggerSet = SFCInteractionGroup & { triggerSet?: SFCInteractionTriggerSet }
interface EvaluatedSFCInteraction {
  trigger: ComponentSFCInteractionTrigger
  reactions: RComponentSFC_IR_InteractionRule['reactions']
  sourceRange?: RComponentSFC_IR_InteractionRule['sourceRange']
  ruleIndex: number
  triggerIndex: number
}

/** Adds conditional `:on` listeners to one renderer-owned visual node. */
export function attachSFCInteractionAttrs(
  attrs: Record<string, unknown>,
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): void {
  const boundary = context.eventBoundary
  if (!boundary || !node.interactions?.length || node.tag === 'Component') {
    return
  }
  const source: ComponentSFCEventRuntimeSource = {
    nodeId: node.id,
    ref: typeof props.ref === 'string' && props.ref.trim() ? props.ref.trim() : undefined,
    componentTag: node.componentTag ?? node.tag,
    target: {
      type: 'component.node',
      identity: String(props.id ?? props.ref ?? node.id),
      value: null,
    },
  }

  node.interactions.forEach((group, groupIndex) => {
    const evaluated = evaluateSFCInteractionGroup(group, context)
    const listenerKeys = [...new Set(evaluated.map(({ trigger }) => listenerKey(trigger)))]
    for (const key of listenerKeys) {
      const [eventName, captureToken, passiveToken] = key.split('|')
      const capture = captureToken === '1'
      const passive = passiveToken === '1'
      const propName = vueEventPropName(eventName, { capture, passive })
      chainSFCEventAttr(attrs, propName, (event: Event) => {
        const claimKey = `${context.consumerScope}:${node.id}:${groupIndex}`
        if (claimedGroups.get(event)?.has(claimKey)) {
          return
        }
        const snapshot = createSFCInteractionTriggerEvent(event)
        const selected = evaluated.find(({ trigger }) => (
          trigger.event === eventName
          && matchesComponentSFCInteractionTrigger(trigger, snapshot, resolveSFCInteractionPlatform())
        ))
        if (!selected || listenerKey(selected.trigger) !== key) {
          return
        }
        if (selected.trigger.once) {
          const onceKey = `${claimKey}:${selected.ruleIndex}:${selected.triggerIndex}:${selected.sourceRange?.start ?? 0}`
          if (!boundary.claimLocalOnce(onceKey)) {
            return
          }
        }
        let claims = claimedGroups.get(event)
        if (!claims) {
          claims = new Set()
          claimedGroups.set(event, claims)
        }
        claims.add(claimKey)
        if (selected.trigger.prevent && event.cancelable) {
          event.preventDefault()
        }
        if (selected.trigger.stop) {
          event.stopPropagation()
        }

        const runtimeSource: ComponentSFCEventRuntimeSource = {
          ...source,
          target: source.target ? { ...source.target, value: event.currentTarget } : undefined,
        }
        const modifiers = interactionBindingModifiers(selected.trigger)
        void boundary.routeChild(
          runtimeSource,
          eventName,
          normalizeSFCInteractionEvent(event, snapshot),
          [{
            name: eventName,
            modifiers,
            action: selected.reactions[0]!,
            actions: selected.reactions,
            sourceRange: selected.sourceRange,
          }],
          [],
          0,
          { ...context.props, ...context.locals },
        )
      })
    }
  })
}

/** Projects `:on` groups of a nested SFC to its semantic Event boundary. */
export function createSFCSemanticInteractionBindings(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
): RComponentSFC_IR_EventBinding[] {
  return (node.interactions ?? []).flatMap((group) => {
    const seenEvents = new Set<string>()
    return evaluateSFCInteractionGroup(group, context).flatMap((evaluated) => {
      if (seenEvents.has(evaluated.trigger.event)) {
        return []
      }
      seenEvents.add(evaluated.trigger.event)
      const trigger = evaluated.trigger
      const bindingModifiers = interactionBindingModifiers(trigger)
      if (trigger.once) {
        bindingModifiers.push('once')
      }
      return [{
        name: trigger.event,
        modifiers: bindingModifiers,
        action: evaluated.reactions[0]!,
        actions: evaluated.reactions,
        sourceRange: evaluated.sourceRange,
      }]
    })
  })
}

export function applySuffixModifiers(
  trigger: ComponentSFCInteractionTrigger,
  modifiers: readonly RComponentSFC_IR_EventModifier[] = [],
): ComponentSFCInteractionTrigger {
  return {
    ...trigger,
    stop: trigger.stop || modifiers.includes('stop'),
    prevent: trigger.prevent || modifiers.includes('prevent'),
    self: trigger.self || modifiers.includes('self'),
    once: trigger.once || modifiers.includes('once'),
    capture: trigger.capture || modifiers.includes('capture'),
    passive: trigger.passive || modifiers.includes('passive'),
  }
}

function evaluateSFCInteractionGroup(
  group: SFCInteractionGroup,
  context: SFCVueRenderContext,
): EvaluatedSFCInteraction[] {
  const rules = group.rules.flatMap((rule, ruleIndex) => {
    const trigger = normalizeComponentSFCInteractionTriggers(evaluateSFCValue(rule.trigger, context))[0]
    if (!trigger) {
      return []
    }
    const normalized = normalizeEvaluatedTrigger(trigger, rule.modifiers)
    return normalized
      ? [{
          trigger: normalized,
          reactions: rule.reactions,
          sourceRange: rule.sourceRange,
          ruleIndex,
          triggerIndex: 0,
        }]
      : []
  })

  const descriptor = (group as SFCInteractionGroupWithTriggerSet).triggerSet
  if (!descriptor) {
    return rules
  }
  const supportedEvents = new Set(descriptor.events)
  const triggerSet = normalizeComponentSFCInteractionTriggers(evaluateSFCValue(descriptor.triggers, context))
    .flatMap((trigger, triggerIndex): EvaluatedSFCInteraction[] => {
      if (!supportedEvents.has(trigger.event)) {
        return []
      }
      const normalized = normalizeEvaluatedTrigger(trigger, descriptor.modifiers)
      return normalized
        ? [{
            trigger: normalized,
            reactions: descriptor.reactions,
            sourceRange: descriptor.sourceRange,
            ruleIndex: group.rules.length,
            triggerIndex,
          }]
        : []
    })
  return [...rules, ...triggerSet]
}

function normalizeEvaluatedTrigger(
  trigger: ComponentSFCInteractionTrigger,
  modifiers: readonly RComponentSFC_IR_EventModifier[],
): ComponentSFCInteractionTrigger | null {
  const normalized = applySuffixModifiers(trigger, modifiers)
  if (normalized.passive && normalized.prevent) {
    return null
  }
  if (normalized.held) {
    ensureSFCInteractionKeyState()
  }
  return normalized
}

export function createSFCInteractionTriggerEvent(event: Event): ComponentSFCInteractionTriggerEvent {
  const source = event as Event & {
    altKey?: unknown
    button?: unknown
    code?: unknown
    ctrlKey?: unknown
    getModifierState?: (keyArg: string) => boolean
    isComposing?: unknown
    key?: unknown
    metaKey?: unknown
    repeat?: unknown
    shiftKey?: unknown
  }
  return {
    ...(typeof source.key === 'string' ? { key: source.key } : {}),
    ...(typeof source.code === 'string' ? { code: source.code } : {}),
    ...(typeof source.repeat === 'boolean' ? { repeat: source.repeat } : {}),
    ...(typeof source.isComposing === 'boolean' ? { composing: source.isComposing } : {}),
    ...(typeof source.button === 'number' ? { button: source.button } : {}),
    targetIsCurrentTarget: event.target === event.currentTarget,
    held: sfcInteractionHeldKeys(),
    modifiers: {
      ctrl: source.ctrlKey === true,
      shift: source.shiftKey === true,
      alt: source.altKey === true,
      meta: source.metaKey === true,
      altGraph: source.getModifierState?.('AltGraph') === true,
    },
  }
}

export function normalizeSFCInteractionEvent(
  event: Event,
  snapshot = createSFCInteractionTriggerEvent(event),
): Record<string, unknown> {
  const source = event as Event & Record<string, unknown>
  const target = event.target as { value?: unknown, checked?: unknown, multiple?: boolean, selectedOptions?: Iterable<{ value: string }> } | null
  const payload: Record<string, unknown> = {
    type: event.type,
    occurredAt: interactionOccurredAt(event),
    held: snapshot.held ?? { key: [], code: [] },
    modifiers: snapshot.modifiers,
  }
  if ('clientX' in source) {
    payload.x = Number(source.clientX ?? 0)
    payload.y = Number(source.clientY ?? 0)
    payload.button = Number(source.button ?? 0)
    payload.buttons = Number(source.buttons ?? 0)
    payload.pointerType = typeof source.pointerType === 'string' ? source.pointerType : 'mouse'
  }
  if (snapshot.key !== undefined) {
    payload.key = snapshot.key
    payload.code = snapshot.code ?? ''
    payload.repeat = snapshot.repeat === true
    payload.composing = snapshot.composing === true
  }
  if ('deltaX' in source) {
    payload.deltaX = Number(source.deltaX ?? 0)
    payload.deltaY = Number(source.deltaY ?? 0)
  }
  if (target && ('value' in target || 'checked' in target)) {
    payload.value = target.multiple && target.selectedOptions
      ? Array.from(target.selectedOptions, option => option.value)
      : target.value
    if (typeof target.checked === 'boolean') {
      payload.checked = target.checked
    }
  }
  return payload
}

function interactionOccurredAt(event: Event): string {
  const existing = occurredAtByEvent.get(event)
  if (existing) {
    return existing
  }
  const value = new Date().toISOString()
  occurredAtByEvent.set(event, value)
  return value
}

export function ensureSFCInteractionKeyState(): KeyboardStateSnapshot | null {
  if (typeof document === 'undefined') {
    return null
  }
  return getKeyboardStateSnapshot(document)
}

export function resolveSFCInteractionPlatform(): ComponentSFCInteractionTriggerPlatform {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }
  const source = navigator as Navigator & { userAgentData?: { platform?: string } }
  return resolveComponentSFCInteractionTriggerPlatform(source.userAgentData?.platform ?? source.platform ?? source.userAgent)
}

function sfcInteractionHeldKeys(): NonNullable<ComponentSFCInteractionTriggerEvent['held']> {
  const state = ensureSFCInteractionKeyState()
  return state ? { key: [...state.held.key], code: [...state.held.code] } : { key: [], code: [] }
}

function listenerKey(trigger: ComponentSFCInteractionTrigger): string {
  return `${trigger.event}|${trigger.capture ? '1' : '0'}|${trigger.passive ? '1' : '0'}`
}

function interactionBindingModifiers(trigger: ComponentSFCInteractionTrigger): RComponentSFC_IR_EventModifier[] {
  return (['stop', 'prevent', 'self', 'capture', 'passive'] as const).filter(name => trigger[name] === true)
}

function vueEventPropName(name: string, options: { capture: boolean, passive: boolean }): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}${options.capture ? 'Capture' : ''}${options.passive ? 'Passive' : ''}`
}

export function chainSFCEventAttr(attrs: Record<string, unknown>, name: string, next: (event: any) => void): void {
  const previous = attrs[name]
  attrs[name] = (event: Event) => {
    if (typeof previous === 'function') {
      previous(event)
    }
    next(event)
  }
}
