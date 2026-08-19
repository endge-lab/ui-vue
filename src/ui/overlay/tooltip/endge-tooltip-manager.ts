import type {
  EndgeTooltipAlign,
  EndgeTooltipConfiguration,
  EndgeTooltipSide,
} from '@endge/core'
import type { InjectionKey, VNodeChild } from 'vue'
import { shallowReactive } from 'vue'

export type EndgeTooltipContentKind = 'text' | 'markdown' | 'rich'
export type EndgeTooltipActivationReason = 'pointer' | 'focus'

export interface EndgeVueTooltipPolicy extends EndgeTooltipConfiguration {}

export interface EndgeVueTooltipRequest {
  ownerId: string
  domId: string
  anchor: HTMLElement
  kind: EndgeTooltipContentKind
  policy?: Partial<EndgeVueTooltipPolicy>
  className?: unknown
  authoredId?: string
  part?: string
  renderContent: () => VNodeChild
}

export interface EndgeVueTooltipState {
  phase: 'idle' | 'pending' | 'visible'
  ownerId: string | null
  domId: string | null
  anchor: HTMLElement | null
  kind: EndgeTooltipContentKind
  policy: EndgeVueTooltipPolicy
  className: unknown
  authoredId: string | null
  part: string | null
  content: VNodeChild | null
}

/** One lazy overlay manager owned by one mounted EndgeShell. */
export class EndgeVueTooltipManager {
  public readonly state: EndgeVueTooltipState
  public readonly adapterId: string

  private request: EndgeVueTooltipRequest | null = null
  private reasons = new Set<EndgeTooltipActivationReason>()
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  private disposed = false
  private readonly defaults: EndgeTooltipConfiguration

  public constructor(adapterId: string, defaults: EndgeTooltipConfiguration) {
    this.adapterId = adapterId
    this.defaults = { ...defaults }
    this.state = shallowReactive({
      phase: 'idle',
      ownerId: null,
      domId: null,
      anchor: null,
      kind: 'text',
      policy: { ...defaults },
      className: null,
      authoredId: null,
      part: null,
      content: null,
    })
  }

  public activate(request: EndgeVueTooltipRequest, reason: EndgeTooltipActivationReason): void {
    if (this.disposed || !request.anchor.isConnected) return
    this.clearCloseTimer()

    if (this.request?.ownerId !== request.ownerId) {
      this.hideNow()
      this.reasons.clear()
    }

    this.request = request
    this.reasons.add(reason)
    if (this.state.phase === 'visible' && this.state.ownerId === request.ownerId) return

    this.clearOpenTimer()
    this.state.phase = 'pending'
    this.state.ownerId = request.ownerId
    const generation = ++this.generation
    const policy = this.resolvePolicy(request.policy)
    if (policy.openDelay === 0) {
      this.show(generation, policy)
      return
    }
    this.openTimer = setTimeout(() => this.show(generation, policy), policy.openDelay)
  }

  public deactivate(ownerId: string, reason: EndgeTooltipActivationReason): void {
    if (this.request?.ownerId !== ownerId) return
    this.reasons.delete(reason)
    if (this.reasons.size > 0) return
    this.clearOpenTimer()
    const delay = this.resolvePolicy(this.request.policy).closeDelay
    if (delay === 0) {
      this.hideNow()
      return
    }
    this.clearCloseTimer()
    const generation = ++this.generation
    this.closeTimer = setTimeout(() => {
      if (generation === this.generation && this.reasons.size === 0) this.hideNow()
    }, delay)
  }

  public close(ownerId?: string): void {
    if (ownerId && this.request?.ownerId !== ownerId) return
    this.reasons.clear()
    this.hideNow()
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.reasons.clear()
    this.hideNow()
  }

  private show(generation: number, policy: EndgeVueTooltipPolicy): void {
    this.openTimer = null
    const request = this.request
    if (
      this.disposed
      || generation !== this.generation
      || !request
      || this.reasons.size === 0
      || !request.anchor.isConnected
    ) {
      this.hideNow()
      return
    }

    this.state.phase = 'visible'
    this.state.ownerId = request.ownerId
    this.state.domId = request.domId
    this.state.anchor = request.anchor
    this.state.kind = request.kind
    this.state.policy = policy
    this.state.className = request.className ?? null
    this.state.authoredId = request.authoredId ?? null
    this.state.part = request.part ?? null
    this.state.content = request.renderContent()
    addDescribedBy(request.anchor, request.domId)
  }

  private hideNow(): void {
    this.clearOpenTimer()
    this.clearCloseTimer()
    this.generation += 1
    if (this.state.anchor && this.state.domId)
      removeDescribedBy(this.state.anchor, this.state.domId)
    this.request = null
    this.state.phase = 'idle'
    this.state.ownerId = null
    this.state.domId = null
    this.state.anchor = null
    this.state.className = null
    this.state.authoredId = null
    this.state.part = null
    this.state.content = null
  }

  private resolvePolicy(local: Partial<EndgeVueTooltipPolicy> | undefined): EndgeVueTooltipPolicy {
    const next: EndgeTooltipConfiguration = { ...this.defaults }
    for (const [key, value] of Object.entries(local ?? {})) {
      if (value != null) (next as any)[key] = value
    }
    return {
      side: normalizeSide(next.side),
      align: normalizeAlign(next.align),
      openDelay: normalizeDelay(next.openDelay, this.defaults.openDelay),
      closeDelay: normalizeDelay(next.closeDelay, this.defaults.closeDelay),
    }
  }

  private clearOpenTimer(): void {
    if (this.openTimer != null) clearTimeout(this.openTimer)
    this.openTimer = null
  }

  private clearCloseTimer(): void {
    if (this.closeTimer != null) clearTimeout(this.closeTimer)
    this.closeTimer = null
  }
}

export const EndgeVueTooltipManagerKey: InjectionKey<EndgeVueTooltipManager> = Symbol('EndgeVueTooltipManager')

export function attachEndgeTooltipTriggerAttrs(
  attrs: Record<string, unknown>,
  manager: EndgeVueTooltipManager | null,
  createRequest: (anchor: HTMLElement) => EndgeVueTooltipRequest,
): void {
  if (!manager) return
  let ownerId = ''
  appendHandler(attrs, 'onMouseenter', (event: MouseEvent) => {
    const anchor = event.currentTarget as HTMLElement
    const request = createRequest(anchor)
    ownerId = request.ownerId
    manager.activate(request, 'pointer')
  })
  appendHandler(attrs, 'onMouseleave', () => ownerId && manager.deactivate(ownerId, 'pointer'))
  appendHandler(attrs, 'onFocusin', (event: FocusEvent) => {
    const anchor = event.currentTarget as HTMLElement
    const request = createRequest(anchor)
    ownerId = request.ownerId
    manager.activate(request, 'focus')
  })
  appendHandler(attrs, 'onFocusout', () => ownerId && manager.deactivate(ownerId, 'focus'))
  appendHandler(attrs, 'onKeydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !ownerId) return
    event.stopPropagation()
    manager.close(ownerId)
  })
  appendHandler(attrs, 'onVnodeUnmounted', () => ownerId && manager.close(ownerId))
  attrs['data-endge-tooltip-trigger'] = ''
}

function appendHandler(attrs: Record<string, unknown>, name: string, handler: (event: any) => void): void {
  const current = attrs[name]
  attrs[name] = current ? [current, handler] : handler
}

function normalizeSide(value: unknown): EndgeTooltipSide {
  return ['top', 'right', 'bottom', 'left'].includes(String(value)) ? value as EndgeTooltipSide : 'right'
}

function normalizeAlign(value: unknown): EndgeTooltipAlign {
  return ['start', 'center', 'end'].includes(String(value)) ? value as EndgeTooltipAlign : 'center'
}

function normalizeDelay(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.min(60_000, Math.round(number)) : fallback
}

function addDescribedBy(anchor: HTMLElement, id: string): void {
  const ids = new Set((anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean))
  ids.add(id)
  anchor.setAttribute('aria-describedby', [...ids].join(' '))
}

function removeDescribedBy(anchor: HTMLElement, id: string): void {
  const ids = (anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(value => value && value !== id)
  if (ids.length) anchor.setAttribute('aria-describedby', ids.join(' '))
  else anchor.removeAttribute('aria-describedby')
}
